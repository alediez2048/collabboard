import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
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

function makeServiceClientMock(args?: { upsertError?: QueryError | null }): ReturnType<typeof vi.fn> {
  const upsertFn = vi.fn().mockResolvedValue({
    error: args?.upsertError ?? null,
  });
  const fromFn = vi.fn(() => ({
    upsert: upsertFn,
  }));

  return vi.fn(() => ({ from: fromFn }));
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

const mockCreateServerClient = vi.mocked(createServerClient);
const mockCreateServiceClient = vi.mocked(createServiceClient);

describe('POST /api/boards/template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns 401 when user is unauthenticated', async () => {
    const supabase = makeSupabaseMock({ userId: null });
    mockCreateServerClient.mockResolvedValue(supabase.client as never);

    const response = await POST(makeRequest({ template: 'swot' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid template payload', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-1' });
    mockCreateServerClient.mockResolvedValue(supabase.client as never);

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
    mockCreateServerClient.mockResolvedValue(supabase.client as never);

    const response = await POST(makeRequest({ template: 'kanban' }));
    expect(response.status).toBe(500);
  });

  it('rolls back board creation when snapshot save fails', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-1' });
    mockCreateServerClient.mockResolvedValue(supabase.client as never);
    mockCreateServiceClient.mockReturnValue(
      makeServiceClientMock({ upsertError: { message: 'Snapshot save failed' } })() as never,
    );

    const response = await POST(makeRequest({ template: 'retrospective' }));
    expect(response.status).toBe(500);
    expect(supabase.boardsTable.delete).toHaveBeenCalledTimes(1);
    expect(supabase.deleteEqFirst).toHaveBeenCalledWith('id', 'board-1');
  });

  it('creates a board and seeds template objects via direct Yjs snapshot', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-123' });
    mockCreateServerClient.mockResolvedValue(supabase.client as never);
    mockCreateServiceClient.mockReturnValue(
      makeServiceClientMock()() as never,
    );

    const response = await POST(makeRequest({ template: 'swot' }));
    const body = (await response.json()) as {
      board?: { id: string; name: string };
      template?: string;
    };

    expect(response.status).toBe(201);
    expect(body.board?.id).toBe('board-1');
    expect(body.template).toBe('swot');
  });

  it('accepts lean_canvas template id for board creation', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-123' });
    mockCreateServerClient.mockResolvedValue(supabase.client as never);
    mockCreateServiceClient.mockReturnValue(
      makeServiceClientMock()() as never,
    );

    const response = await POST(makeRequest({ template: 'lean_canvas' }));
    const body = (await response.json()) as {
      board?: { id: string; name: string };
      template?: string;
    };

    expect(response.status).toBe(201);
    expect(body.template).toBe('lean_canvas');
  });

  it('normalizes legacy brainstorm template id to lean_canvas', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-123' });
    mockCreateServerClient.mockResolvedValue(supabase.client as never);
    mockCreateServiceClient.mockReturnValue(
      makeServiceClientMock()() as never,
    );

    const response = await POST(makeRequest({ template: 'brainstorm' }));
    const body = (await response.json()) as {
      template?: string;
    };

    expect(response.status).toBe(201);
    expect(body.template).toBe('lean_canvas');
  });
});
