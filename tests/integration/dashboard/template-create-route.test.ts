import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai-agent/executor', () => ({
  executeToolCalls: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { executeToolCalls } from '@/lib/ai-agent/executor';
import { POST } from '@/app/api/boards/template/route';

interface QueryError {
  message: string;
}

interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
}

interface BoardRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface SupabaseMockBundle {
  client: {
    auth: {
      getUser: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };
  boardsTable: {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  deleteEqFirst: ReturnType<typeof vi.fn>;
  deleteEqSecond: ReturnType<typeof vi.fn>;
}

function makeSupabaseMock(args: {
  userId: string | null;
  createResult?: QueryResult<BoardRow>;
  deleteResult?: { error: QueryError | null };
}): SupabaseMockBundle {
  const insertSingle = vi.fn().mockResolvedValue(
    args.createResult ?? {
      data: {
        id: 'board-1',
        name: 'Kanban Board',
        created_by: 'user-1',
        created_at: '2026-02-20T00:00:00.000Z',
      },
      error: null,
    },
  );
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const deleteEqSecond = vi.fn().mockResolvedValue(args.deleteResult ?? { error: null });
  const deleteEqFirst = vi.fn(() => ({ eq: deleteEqSecond }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqFirst }));

  const boardsTable = {
    insert,
    delete: deleteFn,
  };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        args.userId
          ? {
              data: { user: { id: args.userId, email: 'test@example.com' } },
              error: null,
            }
          : {
              data: { user: null },
              error: { message: 'Not authenticated' },
            },
      ),
    },
    from: vi.fn((table: string) => {
      if (table === 'boards') {
        return boardsTable;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { client, boardsTable, deleteEqFirst, deleteEqSecond };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/boards/template', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const mockCreateClient = vi.mocked(createClient);
const mockExecuteToolCalls = vi.mocked(executeToolCalls);

describe('POST /api/boards/template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is unauthenticated', async () => {
    const supabase = makeSupabaseMock({ userId: null });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await POST(makeRequest({ template: 'swot' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid template payload', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-1' });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await POST(makeRequest({ template: 'invalid-template' }));
    expect(response.status).toBe(400);
  });

  it('returns 500 when board creation fails', async () => {
    const supabase = makeSupabaseMock({
      userId: 'user-1',
      createResult: {
        data: null,
        error: { message: 'Insert failed' },
      },
    });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await POST(makeRequest({ template: 'kanban' }));
    expect(response.status).toBe(500);
  });

  it('rolls back board creation when template seeding fails', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-1' });
    mockCreateClient.mockResolvedValue(supabase.client as never);
    mockExecuteToolCalls.mockResolvedValue({
      success: false,
      actions: [],
      objectsAffected: [],
      toolOutputs: [],
      error: 'Bridge seed failure',
    });

    const response = await POST(makeRequest({ template: 'retrospective' }));
    expect(response.status).toBe(500);
    expect(supabase.boardsTable.delete).toHaveBeenCalledTimes(1);
    expect(supabase.deleteEqFirst).toHaveBeenCalledWith('id', 'board-1');
  });

  it('creates a board and seeds template through executor path', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-123' });
    mockCreateClient.mockResolvedValue(supabase.client as never);
    mockExecuteToolCalls.mockResolvedValue({
      success: true,
      actions: [{ tool: 'createFrame', args: {}, result: 'Affected: object-1' }],
      objectsAffected: ['object-1'],
      toolOutputs: [],
    });

    const response = await POST(makeRequest({ template: 'swot' }));
    const body = (await response.json()) as {
      board?: { id: string; name: string };
      template?: string;
    };

    expect(response.status).toBe(201);
    expect(body.board?.id).toBe('board-1');
    expect(body.template).toBe('swot');
    expect(mockExecuteToolCalls).toHaveBeenCalledTimes(1);
    expect(mockExecuteToolCalls.mock.calls[0]?.[1]).toBe('board-1');
    expect(mockExecuteToolCalls.mock.calls[0]?.[2]).toBe('user-123');
  });

  it('accepts lean_canvas template id for board creation', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-123' });
    mockCreateClient.mockResolvedValue(supabase.client as never);
    mockExecuteToolCalls.mockResolvedValue({
      success: true,
      actions: [{ tool: 'createFrame', args: {}, result: 'Affected: object-1' }],
      objectsAffected: ['object-1'],
      toolOutputs: [],
    });

    const response = await POST(makeRequest({ template: 'lean_canvas' }));
    const body = (await response.json()) as {
      board?: { id: string; name: string };
      template?: string;
    };

    expect(response.status).toBe(201);
    expect(body.template).toBe('lean_canvas');
    expect(mockExecuteToolCalls).toHaveBeenCalledTimes(1);
  });

  it('normalizes legacy brainstorm template id to lean_canvas', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-123' });
    mockCreateClient.mockResolvedValue(supabase.client as never);
    mockExecuteToolCalls.mockResolvedValue({
      success: true,
      actions: [{ tool: 'createFrame', args: {}, result: 'Affected: object-1' }],
      objectsAffected: ['object-1'],
      toolOutputs: [],
    });

    const response = await POST(makeRequest({ template: 'brainstorm' }));
    const body = (await response.json()) as {
      template?: string;
    };

    expect(response.status).toBe(201);
    expect(body.template).toBe('lean_canvas');
    expect(mockExecuteToolCalls).toHaveBeenCalledTimes(1);
  });
});
