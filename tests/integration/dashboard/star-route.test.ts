import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { PATCH } from '@/app/api/boards/[id]/star/route';

interface QueryError {
  message: string;
}

interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
}

interface TableChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

interface SupabaseMockBundle {
  client: {
    auth: {
      getUser: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };
  boardsChain: TableChain;
  stateChain: TableChain;
}

interface BoardStateRow {
  board_id: string;
  user_id: string;
  is_starred: boolean;
  last_opened_at: string | null;
  updated_at: string;
}

function makeTableChain<T>(result: QueryResult<T>): TableChain {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(result),
  };

  return chain;
}

function makeSupabaseMock(args: {
  userId: string | null;
  boardsResult?: QueryResult<{ id: string }>;
  stateResult?: QueryResult<BoardStateRow>;
}): SupabaseMockBundle {
  const boardsChain = makeTableChain(args.boardsResult ?? { data: { id: 'board-1' }, error: null });
  const stateChain = makeTableChain(
    args.stateResult ?? {
      data: {
        board_id: 'board-1',
        user_id: 'user-1',
        is_starred: true,
        last_opened_at: null,
        updated_at: '2026-02-20T00:00:00.000Z',
      },
      error: null,
    },
  );

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
        return boardsChain;
      }

      if (table === 'board_user_state') {
        return stateChain;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { client, boardsChain, stateChain };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/boards/board-1/star', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const mockCreateClient = vi.mocked(createClient);

describe('PATCH /api/boards/[id]/star', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const supabase = makeSupabaseMock({ userId: null });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await PATCH(makeRequest({ isStarred: true }), {
      params: Promise.resolve({ id: 'board-1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid payload', async () => {
    const supabase = makeSupabaseMock({ userId: 'user-1' });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await PATCH(makeRequest({ isStarred: 'yes' }), {
      params: Promise.resolve({ id: 'board-1' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 when board is not accessible', async () => {
    const supabase = makeSupabaseMock({
      userId: 'user-1',
      boardsResult: { data: null, error: { message: 'Board not found' } },
    });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await PATCH(makeRequest({ isStarred: true }), {
      params: Promise.resolve({ id: 'board-1' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 500 when persistence fails', async () => {
    const supabase = makeSupabaseMock({
      userId: 'user-1',
      stateResult: { data: null, error: { message: 'Write failed' } },
    });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await PATCH(makeRequest({ isStarred: true }), {
      params: Promise.resolve({ id: 'board-1' }),
    });

    expect(response.status).toBe(500);
  });

  it('persists star state for the authenticated user', async () => {
    const supabase = makeSupabaseMock({
      userId: 'user-123',
      stateResult: {
        data: {
          board_id: 'board-1',
          user_id: 'user-123',
          is_starred: true,
          last_opened_at: null,
          updated_at: '2026-02-20T12:00:00.000Z',
        },
        error: null,
      },
    });
    mockCreateClient.mockResolvedValue(supabase.client as never);

    const response = await PATCH(makeRequest({ isStarred: true }), {
      params: Promise.resolve({ id: 'board-1' }),
    });
    const body = (await response.json()) as { state?: { is_starred: boolean } };

    expect(response.status).toBe(200);
    expect(body.state?.is_starred).toBe(true);
    expect(supabase.stateChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        board_id: 'board-1',
        user_id: 'user-123',
        is_starred: true,
      }),
      { onConflict: 'board_id,user_id' },
    );
  });
});
