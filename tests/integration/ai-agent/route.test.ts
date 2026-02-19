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
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeUnauthenticatedSupabase() as never);

    const response = await POST(makeRequest({ boardId: 'board-1', command: 'Add a note' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when boardId is missing', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);

    const response = await POST(makeRequest({ command: 'Add a note' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when command is missing', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);

    const response = await POST(makeRequest({ boardId: 'board-1' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when command is empty or only whitespace', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);

    const response = await POST(makeRequest({ boardId: 'board-1', command: '   ' }));
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
      error: undefined,
    });

    const response = await POST(makeRequest({ boardId: 'board-1', command: 'Add a yellow sticky note' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('actions');
    expect(body).toHaveProperty('objectsAffected');
    expect(Array.isArray(body.objectsAffected)).toBe(true);
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
      error: 'Object not found on board',
    });

    const response = await POST(makeRequest({ boardId: 'board-1', command: 'Move the missing note' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it('returns 200 with no-op when OpenAI returns no tool calls', async () => {
    mockCreateClient.mockResolvedValue(makeAuthenticatedSupabase() as never);
    mockTracing.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'I cannot do that.', tool_calls: undefined }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
    } as never);

    const response = await POST(makeRequest({ boardId: 'board-1', command: 'Tell me a joke' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.objectsAffected).toHaveLength(0);
  });
});
