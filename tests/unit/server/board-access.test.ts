import { describe, expect, it, vi } from 'vitest';
import { canAccessBoard } from '../../../server/src/board-access';

const BOARD = 'b0a2d1c4-1111-4111-8111-111111111111';
const OWNER = 'owner-id';
const MEMBER = 'member-id';
const STRANGER = 'stranger-id';

/** Minimal stand-in for the Supabase query builder used by canAccessBoard. */
function fakeClient(rows: { board: { id: string; created_by: string } | null; members: string[] }) {
  return {
    from: vi.fn((table: string) => {
      const filters: Record<string, string> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: async () => {
          if (table === 'boards') {
            return { data: rows.board && rows.board.id === filters.id ? rows.board : null, error: null };
          }
          const isMember = rows.members.includes(filters.user_id) && filters.board_id === BOARD;
          return { data: isMember ? { user_id: filters.user_id } : null, error: null };
        },
      };
      return query;
    }),
  } as never;
}

describe('canAccessBoard', () => {
  const client = () => fakeClient({ board: { id: BOARD, created_by: OWNER }, members: [MEMBER] });

  it('lets the owner in', async () => {
    await expect(canAccessBoard(OWNER, BOARD, client())).resolves.toBe(true);
  });

  it('lets a member who joined by link in', async () => {
    await expect(canAccessBoard(MEMBER, BOARD, client())).resolves.toBe(true);
  });

  it('rejects a signed-in user who is neither owner nor member', async () => {
    await expect(canAccessBoard(STRANGER, BOARD, client())).resolves.toBe(false);
  });

  it('rejects a board that does not exist', async () => {
    const empty = fakeClient({ board: null, members: [MEMBER] });
    await expect(canAccessBoard(MEMBER, BOARD, empty)).resolves.toBe(false);
  });

  it('rejects a room name that is not a board id without querying', async () => {
    const c = client();
    await expect(canAccessBoard(OWNER, '../other-room', c)).resolves.toBe(false);
    expect((c as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it('fails closed when the lookup throws', async () => {
    const broken = { from: () => { throw new Error('network'); } } as never;
    await expect(canAccessBoard(OWNER, BOARD, broken)).resolves.toBe(false);
  });
});
