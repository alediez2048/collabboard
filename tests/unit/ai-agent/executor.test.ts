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

function makeBridgeBatchSuccess(results: Array<{ affectedObjectIds: string[] }>) {
  return {
    ok: true,
    json: async () => ({ success: true, results }),
  };
}

function makeBridgeHtmlErrorResponse() {
  return {
    ok: false,
    json: async () => {
      throw new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON");
    },
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

  it('handles resizeObject tool call', async () => {
    mockFetch.mockResolvedValueOnce(makeBridgeSuccess(['obj-1']));

    const result = await executeToolCalls(
      [makeToolCall('resizeObject', { objectId: 'obj-1', width: 320, height: 180 })],
      'board-abc',
      'user-1',
    );

    expect(result.success).toBe(true);
    expect(result.objectsAffected).toContain('obj-1');
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

  it('batches high-volume mutation runs into a single bridge request', async () => {
    const calls = Array.from({ length: 12 }, (_, index) =>
      makeToolCall('createStickyNote', {
        text: `Note ${index + 1}`,
        x: 100 + (index * 20),
        y: 100 + (index * 20),
        color: '#ffeb3b',
      }),
    );

    mockFetch.mockResolvedValueOnce(
      makeBridgeBatchSuccess(
        calls.map((_, index) => ({ affectedObjectIds: [`note-${index + 1}`] })),
      ),
    );

    const result = await executeToolCalls(calls, 'board-abc', 'user-1');

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/ai/mutate-batch');
    const payload = JSON.parse(String(calledInit.body)) as {
      actions: Array<{ tool: string; args: Record<string, unknown> }>;
    };
    expect(payload.actions).toHaveLength(12);
    expect(result.objectsAffected).toHaveLength(12);
  });

  it('falls back to sequential mutate calls when batch response is non-JSON', async () => {
    let mutateCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/ai/mutate-batch')) {
        return makeBridgeHtmlErrorResponse();
      }
      mutateCount += 1;
      return makeBridgeSuccess([`note-${mutateCount}`]);
    });

    const calls = Array.from({ length: 12 }, (_, index) =>
      makeToolCall('createStickyNote', {
        text: `Note ${index + 1}`,
        x: 100 + (index * 20),
        y: 100 + (index * 20),
        color: '#ffeb3b',
      }),
    );

    const result = await executeToolCalls(calls, 'board-abc', 'user-1');

    expect(result.success).toBe(true);
    expect(result.objectsAffected).toHaveLength(12);
    const batchCalls = mockFetch.mock.calls.filter(([url]) => String(url).includes('/ai/mutate-batch'));
    const singleMutateCalls = mockFetch.mock.calls.filter(
      ([url]) => String(url).includes('/ai/mutate') && !String(url).includes('/ai/mutate-batch'),
    );
    expect(batchCalls).toHaveLength(1);
    expect(singleMutateCalls).toHaveLength(12);
  });

  it('emits batch attempt and fallback telemetry markers', async () => {
    const telemetry = vi.fn();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/ai/mutate-batch')) {
        return makeBridgeHtmlErrorResponse();
      }
      return makeBridgeSuccess([`note-${crypto.randomUUID()}`]);
    });

    const calls = Array.from({ length: 12 }, (_, index) =>
      makeToolCall('createStickyNote', {
        text: `Note ${index + 1}`,
        x: 100 + (index * 20),
        y: 100 + (index * 20),
        color: '#ffeb3b',
      }),
    );

    const result = await executeToolCalls(calls, 'board-abc', 'user-1', {
      onEvent: telemetry,
      traceId: 'trace-telemetry-1',
    });

    expect(result.success).toBe(true);
    const eventNames = telemetry.mock.calls.map((call) => call[0]?.name);
    expect(eventNames).toContain('executor-batch-attempt');
    expect(eventNames).toContain('executor-batch-fallback');
  });

  it('propagates trace id to bridge headers when telemetry options are present', async () => {
    mockFetch.mockResolvedValueOnce(makeBridgeSuccess(['note-1']));

    const result = await executeToolCalls(
      [makeToolCall('createStickyNote', { text: 'Traced', x: 100, y: 200, color: '#ffeb3b' })],
      'board-abc',
      'user-1',
      { traceId: 'trace-header-1' },
    );

    expect(result.success).toBe(true);
    const requestInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['X-AI-Trace-Id']).toBe('trace-header-1');
  });
});
