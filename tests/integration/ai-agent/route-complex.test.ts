import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai-agent/executor', () => ({
  executeToolCalls: vi.fn(),
}));

vi.mock('@/lib/ai-agent/tracing', () => ({
  createTracedCompletion: vi.fn(),
}));

vi.mock('openai', () => {
  function MockOpenAI() {
    return {};
  }
  return { default: MockOpenAI };
});

import { createClient } from '@/lib/supabase/server';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import { createTracedCompletion } from '@/lib/ai-agent/tracing';
import { POST } from '@/app/api/ai/command/route';

const mockCreateClient = vi.mocked(createClient);
const mockExecute = vi.mocked(executeToolCalls);
const mockTracing = vi.mocked(createTracedCompletion);

function makeAuthenticatedSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      }),
    },
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ai/command', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/ai/command complex planning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
  });

  it('gets board state first for SWOT template, then runs planned steps without OpenAI call', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      actions: [
        { tool: 'createFrame', args: { title: 'Strengths' }, result: 'Affected: frame-1' },
        { tool: 'createFrame', args: { title: 'Weaknesses' }, result: 'Affected: frame-2' },
      ],
      objectsAffected: ['frame-1', 'frame-2'],
      toolOutputs: [{
        toolCallId: 'call-state',
        tool: 'getBoardState',
        output: { totalObjects: 0, returnedCount: 0, objects: [] },
      }],
    });
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 0 of 0 objects' }],
      objectsAffected: [],
      toolOutputs: [{
        toolCallId: 'call-state',
        tool: 'getBoardState',
        output: { totalObjects: 0, returnedCount: 0, objects: [] },
      }],
    });
    mockExecute.mockResolvedValueOnce({
      success: true,
      actions: [
        { tool: 'createFrame', args: { title: 'Strengths' }, result: 'Affected: frame-1' },
        { tool: 'createStickyNote', args: { text: 'Strengths' }, result: 'Affected: sticky-1' },
      ],
      objectsAffected: ['frame-1', 'sticky-1'],
      toolOutputs: [],
    });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Create a SWOT analysis' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const firstCallArgs = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(firstCallArgs[0]?.function?.name).toBe('getBoardState');
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('uses getBoardState first for layout command, then executes layout mutation steps', async () => {
    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 2 of 2 objects' }],
        objectsAffected: [],
        toolOutputs: [{
          toolCallId: 'call-state',
          tool: 'getBoardState',
          output: {
            totalObjects: 2,
            returnedCount: 2,
            objects: [
              {
                id: 'note-1',
                type: 'sticky_note',
                x: 100,
                y: 100,
                width: 200,
                height: 200,
                rotation: 0,
                zIndex: 1,
                properties: {},
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'note-2',
                type: 'sticky_note',
                x: 500,
                y: 100,
                width: 200,
                height: 200,
                rotation: 0,
                zIndex: 2,
                properties: {},
                createdBy: 'user-1',
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'note-1', x: 100, y: 100 }, result: 'Affected: note-1' }],
        objectsAffected: ['note-1', 'note-2'],
        toolOutputs: [],
      });

    const response = await POST(
      makeRequest({ boardId: 'board-1', command: 'Arrange these sticky notes in a grid' }),
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockTracing).not.toHaveBeenCalled();
  });
});
