import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai-agent/executor', () => ({
  executeToolCalls: vi.fn(),
}));

vi.mock('@/lib/ai-agent/tracing', () => ({
  createTracedCompletion: vi.fn(),
  startCommandTrace: vi.fn(),
  setCommandTraceExecutionPath: vi.fn(),
  recordCommandTraceEvent: vi.fn(),
  finishCommandTrace: vi.fn(),
}));

// Mock OpenAI SDK to prevent "browser-like environment" error in jsdom.
// Must use a regular function (not arrow) because new OpenAI() is a constructor call.
vi.mock('openai', () => {
  function MockOpenAI() {
    return {};
  }
  return { default: MockOpenAI };
});

import { createClient } from '@/lib/supabase/server';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import {
  createTracedCompletion,
  startCommandTrace,
  setCommandTraceExecutionPath,
  recordCommandTraceEvent,
  finishCommandTrace,
} from '@/lib/ai-agent/tracing';
import { POST } from '@/app/api/ai/command/route';

const BOARD_ID = 'b0a2d1c4-1111-4111-8111-111111111111';

const mockCreateClient = vi.mocked(createClient);
const mockExecute = vi.mocked(executeToolCalls);
const mockTracing = vi.mocked(createTracedCompletion);
const mockStartTrace = vi.mocked(startCommandTrace);
const mockSetTracePath = vi.mocked(setCommandTraceExecutionPath);
const mockRecordTraceEvent = vi.mocked(recordCommandTraceEvent);
const mockFinishTrace = vi.mocked(finishCommandTrace);

const mockTraceContext = {
  traceId: 'trace-1',
  traceName: 'ai-board-command',
  boardId: BOARD_ID,
  userId: 'user-123',
  command: 'Add a note',
  startedAtMs: 0,
  executionPath: 'unknown',
  events: [],
};

function makeBoardQuery(board: { id: string } | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: board, error: null }),
  };
  return query;
}

function makeAuthenticatedSupabase(board: { id: string } | null = { id: BOARD_ID }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => makeBoardQuery(board)),
  };
}

function makeUnauthenticatedSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
  };
}

function makeOpenAIToolResponse(toolName: string, args: Record<string, unknown>) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ai/command', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/ai/command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key';
    mockStartTrace.mockReturnValue(mockTraceContext as never);
    mockRecordTraceEvent.mockResolvedValue(undefined);
    mockFinishTrace.mockResolvedValue(undefined);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeUnauthenticatedSupabase() as never);

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Add a note' }));
    expect(response.status).toBe(401);
  });

  it('returns 403 when the user is neither owner nor member of the board', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase(null) as never);
    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Add a note' }));
    expect(response.status).toBe(403);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('returns 400 when boardId is not a UUID', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    const response = await POST(makeRequest({ boardId: '../other', command: 'Add a note' }));
    expect(response.status).toBe(400);
  });

  it('returns 413 when the command is too long', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'a'.repeat(2001) }));
    expect(response.status).toBe(413);
    expect(mockTracing).not.toHaveBeenCalled();
  });

  it('returns 400 when boardId is missing', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);

    const response = await POST(makeRequest({ command: 'Add a note' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when command is missing', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);

    const response = await POST(makeRequest({ boardId: BOARD_ID }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when command is empty or only whitespace', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: '   ' }));
    expect(response.status).toBe(400);
  });

  it('returns success response with expected shape on valid command', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing.mockResolvedValue(
      makeOpenAIToolResponse('createStickyNote', { text: 'User Research', x: 100, y: 200, color: '#ffeb3b' }) as never,
    );
    mockExecute.mockResolvedValue({
      success: true,
      actions: [{ tool: 'createStickyNote', args: { text: 'User Research', x: 100, y: 200, color: '#ffeb3b' }, result: 'created' }],
      objectsAffected: ['obj-new-1'],
      toolOutputs: [],
      error: undefined,
    });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Add a yellow sticky note' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('actions');
    expect(body).toHaveProperty('objectsAffected');
    expect(Array.isArray(body.objectsAffected)).toBe(true);
    expect(mockStartTrace).toHaveBeenCalledTimes(1);
    expect(mockSetTracePath).toHaveBeenCalledWith(mockTraceContext, 'llm-single-step');
    expect(mockFinishTrace).toHaveBeenCalledWith(
      mockTraceContext,
      expect.objectContaining({ success: true }),
    );
  });

  it('returns 200 with success: false when executor fails', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing.mockResolvedValue(
      makeOpenAIToolResponse('moveObject', { objectId: 'missing', x: 0, y: 0 }) as never,
    );
    mockExecute.mockResolvedValue({
      success: false,
      actions: [],
      objectsAffected: [],
      toolOutputs: [],
      error: 'Object not found on board',
    });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Move the missing note' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
    expect(mockFinishTrace).toHaveBeenCalledWith(
      mockTraceContext,
      expect.objectContaining({ success: false }),
    );
  });

  it('returns 200 with no-op when OpenAI returns no tool calls', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'I cannot do that.', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
    } as never);

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Tell me a joke' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.objectsAffected).toHaveLength(0);
    expect(mockRecordTraceEvent).toHaveBeenCalledWith(
      mockTraceContext,
      'route-no-tool-calls',
      expect.any(Object),
    );
  });

  it('runs a follow-up completion after getBoardState-only first pass', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('getBoardState', {}) as never,
      )
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'obj-1', x: 500, y: 300 }) as never,
      );

    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 1 of 1 objects' }],
        objectsAffected: [],
        toolOutputs: [{ toolCallId: 'call-1', tool: 'getBoardState', output: { totalObjects: 1, returnedCount: 1, objects: [{ id: 'obj-1' }] } }],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'obj-1', x: 500, y: 300 }, result: 'Affected: obj-1' }],
        objectsAffected: ['obj-1'],
        toolOutputs: [{ toolCallId: 'call-1', tool: 'moveObject', output: { success: true, affectedObjectIds: ['obj-1'] } }],
      });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Move the note to x 500 y 300' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.objectsAffected).toEqual(['obj-1']);
    expect(mockTracing).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockSetTracePath).toHaveBeenCalledWith(mockTraceContext, 'llm-followup');
    expect(mockRecordTraceEvent).toHaveBeenCalledWith(
      mockTraceContext,
      'route-followup-triggered',
      expect.any(Object),
    );
  });

  it('runs a follow-up completion after findObjects-only first pass', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('findObjects', { type: 'sticky_note', textContains: 'roadmap' }) as never,
      )
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'obj-1', x: 640, y: 240 }) as never,
      );

    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'findObjects', args: { type: 'sticky_note', textContains: 'roadmap' }, result: 'Found 1 objects' }],
        objectsAffected: [],
        toolOutputs: [
          {
            toolCallId: 'call-1',
            tool: 'findObjects',
            output: {
              totalObjects: 5,
              returnedCount: 1,
              objectIds: ['obj-1'],
              objects: [{ id: 'obj-1', type: 'sticky_note' }],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'obj-1', x: 640, y: 240 }, result: 'Affected: obj-1' }],
        objectsAffected: ['obj-1'],
        toolOutputs: [{ toolCallId: 'call-1', tool: 'moveObject', output: { success: true, affectedObjectIds: ['obj-1'] } }],
      });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Move roadmap note to the right' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.objectsAffected).toEqual(['obj-1']);
    expect(mockTracing).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockSetTracePath).toHaveBeenCalledWith(mockTraceContext, 'llm-followup');
  });

  it('records structured accuracy telemetry in trace metadata', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('getBoardState', {}) as never,
      )
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'obj-1', x: 480, y: 260 }) as never,
      );

    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 2 of 2 objects' }],
        objectsAffected: [],
        toolOutputs: [
          {
            toolCallId: 'call-1',
            tool: 'getBoardState',
            output: { totalObjects: 2, returnedCount: 2, objects: [{ id: 'obj-1' }, { id: 'obj-2' }] },
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'obj-1', x: 480, y: 260 }, result: 'Affected: obj-1' }],
        objectsAffected: ['obj-1'],
        toolOutputs: [],
      });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Move the first object to x 480 y 260' }));
    expect(response.status).toBe(200);
    expect(mockFinishTrace).toHaveBeenCalledWith(
      mockTraceContext,
      expect.objectContaining({
        metadata: expect.objectContaining({
          resolutionSource: 'getBoardState',
          candidateCount: 2,
          retryCount: 0,
        }),
      }),
    );
  });

  it('enforces a read pass before mutating edit-intent commands', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'obj-1', x: 700, y: 280 }) as never,
      )
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'obj-1', x: 700, y: 280 }) as never,
      );

    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: { command: 'Move the sticky note to the right' }, result: 'Returned 1 of 1 objects' }],
        objectsAffected: [],
        toolOutputs: [{ toolCallId: 'state-1', tool: 'getBoardState', output: { totalObjects: 1, returnedCount: 1, objects: [{ id: 'obj-1' }] } }],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'obj-1', x: 700, y: 280 }, result: 'Affected: obj-1' }],
        objectsAffected: ['obj-1'],
        toolOutputs: [],
      });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Move the sticky note to the right' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.objectsAffected).toEqual(['obj-1']);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const firstCallArgs = mockExecute.mock.calls[0]?.[0] ?? [];
    expect(firstCallArgs[0]?.function?.name).toBe('getBoardState');
  });

  it('retries once with refreshed state when mutation fails with stale object id', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('getBoardState', {}) as never,
      )
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'stale-id', x: 500, y: 300 }) as never,
      )
      .mockResolvedValueOnce(
        makeOpenAIToolResponse('moveObject', { objectId: 'obj-2', x: 500, y: 300 }) as never,
      );

    mockExecute
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 1 of 1 objects' }],
        objectsAffected: [],
        toolOutputs: [{ toolCallId: 'state-1', tool: 'getBoardState', output: { totalObjects: 1, returnedCount: 1, objects: [{ id: 'obj-2' }] } }],
      })
      .mockResolvedValueOnce({
        success: false,
        actions: [{ tool: 'moveObject', args: { objectId: 'stale-id', x: 500, y: 300 }, result: 'failed' }],
        objectsAffected: [],
        toolOutputs: [],
        error: 'Object stale-id not found',
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'getBoardState', args: {}, result: 'Returned 1 of 1 objects' }],
        objectsAffected: [],
        toolOutputs: [{ toolCallId: 'state-2', tool: 'getBoardState', output: { totalObjects: 1, returnedCount: 1, objects: [{ id: 'obj-2' }] } }],
      })
      .mockResolvedValueOnce({
        success: true,
        actions: [{ tool: 'moveObject', args: { objectId: 'obj-2', x: 500, y: 300 }, result: 'Affected: obj-2' }],
        objectsAffected: ['obj-2'],
        toolOutputs: [{ toolCallId: 'retry-1', tool: 'moveObject', output: { success: true, affectedObjectIds: ['obj-2'] } }],
      });

    const response = await POST(makeRequest({ boardId: BOARD_ID, command: 'Move the note to x 500 y 300' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.objectsAffected).toEqual(['obj-2']);
    expect(mockExecute).toHaveBeenCalledTimes(4);
    expect(mockTracing).toHaveBeenCalledTimes(3);
    expect(mockRecordTraceEvent).toHaveBeenCalledWith(
      mockTraceContext,
      'route-stale-id-retry',
      expect.any(Object),
    );
  });
});
