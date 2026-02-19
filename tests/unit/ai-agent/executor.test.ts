import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import type { ToolCallInput } from '@/lib/ai-agent/executor';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeBridgeSuccess(affectedObjectIds: string[] = ['new-obj-id']) {
  return {
    ok: true,
    json: async () => ({ success: true, affectedObjectIds }),
  };
}

function makeBridgeFailure(error = 'Object not found') {
  return {
    ok: false,
    json: async () => ({ success: false, error }),
  };
}

function makeToolCall(name: string, args: Record<string, unknown>): ToolCallInput {
  return {
    id: `call-${crypto.randomUUID()}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

describe('executeToolCalls', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.REALTIME_SERVER_URL = 'http://localhost:4000';
    process.env.AI_BRIDGE_SECRET = 'test-secret';
  });

  it('executes createStickyNote and returns affected IDs', async () => {
    mockFetch.mockResolvedValueOnce(makeBridgeSuccess(['note-123']));

    const result = await executeToolCalls(
      [makeToolCall('createStickyNote', { text: 'Test', x: 100, y: 200, color: '#ffeb3b' })],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(true);
    expect(result.objectsAffected).toContain('note-123');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('createStickyNote');
  });

  it('executes multiple tool calls sequentially (in order)', async () => {
    const callOrder: string[] = [];
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string) as { action: { tool: string } };
      callOrder.push(body.action.tool);
      return { ok: true, json: async () => ({ success: true, affectedObjectIds: [`id-${callOrder.length}`] }) };
    });

    await executeToolCalls(
      [
        makeToolCall('createStickyNote', { text: 'First', x: 0, y: 0, color: '#ffeb3b' }),
        makeToolCall('createStickyNote', { text: 'Second', x: 200, y: 0, color: '#f87171' }),
        makeToolCall('moveObject', { objectId: 'id-1', x: 300, y: 300 }),
      ],
      'board-abc',
      'user-1',
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(callOrder[0]).toBe('createStickyNote');
    expect(callOrder[1]).toBe('createStickyNote');
    expect(callOrder[2]).toBe('moveObject');
  });

  it('accumulates all affected object IDs across multiple calls', async () => {
    mockFetch
      .mockResolvedValueOnce(makeBridgeSuccess(['note-1']))
      .mockResolvedValueOnce(makeBridgeSuccess(['note-2']));

    const result = await executeToolCalls(
      [
        makeToolCall('createStickyNote', { text: 'A', x: 0, y: 0, color: '#ffeb3b' }),
        makeToolCall('createStickyNote', { text: 'B', x: 200, y: 0, color: '#a3e635' }),
      ],
      'board-abc',
      'user-1',
    );

    expect(result.objectsAffected).toHaveLength(2);
    expect(result.objectsAffected).toContain('note-1');
    expect(result.objectsAffected).toContain('note-2');
  });

  it('returns failure when bridge returns an error', async () => {
    mockFetch.mockResolvedValueOnce(makeBridgeFailure('Object not found'));

    const result = await executeToolCalls(
      [makeToolCall('moveObject', { objectId: 'ghost-id', x: 100, y: 100 })],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('stops execution after first bridge error', async () => {
    mockFetch
      .mockResolvedValueOnce(makeBridgeFailure('Error on first call'))
      .mockResolvedValueOnce(makeBridgeSuccess(['note-2']));

    const result = await executeToolCalls(
      [
        makeToolCall('moveObject', { objectId: 'ghost', x: 0, y: 0 }),
        makeToolCall('createStickyNote', { text: 'B', x: 0, y: 0, color: '#ffeb3b' }),
      ],
      'board-abc',
      'user-1',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('returns validation failure for invalid createStickyNote args (missing coords)', async () => {
    const result = await executeToolCalls(
      [makeToolCall('createStickyNote', { text: 'Hi' })],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns failure for unknown tool name', async () => {
    const result = await executeToolCalls(
      [makeToolCall('destroyEverything', {})],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles createShape tool call', async () => {
    mockFetch.mockResolvedValueOnce(makeBridgeSuccess(['shape-1']));

    const result = await executeToolCalls(
      [makeToolCall('createShape', { type: 'rectangle', x: 0, y: 0, width: 200, height: 100, color: '#3b82f6' })],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(true);
    expect(result.objectsAffected).toContain('shape-1');
  });

  it('handles changeColor tool call', async () => {
    mockFetch.mockResolvedValueOnce(makeBridgeSuccess(['obj-1']));

    const result = await executeToolCalls(
      [makeToolCall('changeColor', { objectId: 'obj-1', color: '#a3e635' })],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(true);
  });

  it('handles getBoardState tool call without calling mutate bridge', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        totalObjects: 5,
        returnedCount: 5,
        objects: [],
      }),
    });

    const result = await executeToolCalls(
      [makeToolCall('getBoardState', {})],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
