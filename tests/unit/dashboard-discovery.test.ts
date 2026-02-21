import { describe, expect, it } from 'vitest';
import { buildDashboardBoardList } from '@/lib/dashboard/discovery';
import type { Board, BoardUserState } from '@/types/board';

function makeBoard(id: string, name: string, createdBy = 'owner-1'): Board {
  return {
    id,
    name,
    created_by: createdBy,
    created_at: '2026-02-20T00:00:00.000Z',
  };
}

function makeState(partial: Partial<BoardUserState> & Pick<BoardUserState, 'board_id'>): BoardUserState {
  return {
    board_id: partial.board_id,
    user_id: partial.user_id ?? 'user-1',
    is_starred: partial.is_starred ?? false,
    last_opened_at: partial.last_opened_at ?? null,
    updated_at: partial.updated_at ?? '2026-02-20T00:00:00.000Z',
  };
}

describe('buildDashboardBoardList', () => {
  it('merges per-user metadata into the home board list', () => {
    const boards = [makeBoard('b-1', 'Roadmap'), makeBoard('b-2', 'Design Sprint')];
    const states = [makeState({ board_id: 'b-2', is_starred: true })];

    const result = buildDashboardBoardList({
      boards,
      states,
      section: 'home',
      searchQuery: '',
    });

    expect(result).toEqual([
      expect.objectContaining({ id: 'b-1', is_starred: false, last_opened_at: null }),
      expect.objectContaining({ id: 'b-2', is_starred: true, last_opened_at: null }),
    ]);
  });

  it('returns only starred boards for the starred section', () => {
    const boards = [makeBoard('b-1', 'Roadmap'), makeBoard('b-2', 'Design Sprint')];
    const states = [
      makeState({ board_id: 'b-1', is_starred: true }),
      makeState({ board_id: 'b-2', is_starred: false }),
    ];

    const result = buildDashboardBoardList({
      boards,
      states,
      section: 'starred',
      searchQuery: '',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('b-1');
    expect(result[0]?.is_starred).toBe(true);
  });

  it('sorts recent boards by last opened descending', () => {
    const boards = [makeBoard('b-1', 'Roadmap'), makeBoard('b-2', 'Design Sprint'), makeBoard('b-3', 'Retro')];
    const states = [
      makeState({ board_id: 'b-1', last_opened_at: '2026-02-20T10:30:00.000Z' }),
      makeState({ board_id: 'b-2', last_opened_at: '2026-02-20T13:15:00.000Z' }),
      makeState({ board_id: 'b-3', last_opened_at: null }),
    ];

    const result = buildDashboardBoardList({
      boards,
      states,
      section: 'recent',
      searchQuery: '',
    });

    expect(result.map((board) => board.id)).toEqual(['b-2', 'b-1']);
  });

  it('applies case-insensitive search within the active section', () => {
    const boards = [makeBoard('b-1', 'Roadmap'), makeBoard('b-2', 'Design Sprint')];
    const states = [
      makeState({ board_id: 'b-1', is_starred: true }),
      makeState({ board_id: 'b-2', is_starred: true }),
    ];

    const result = buildDashboardBoardList({
      boards,
      states,
      section: 'starred',
      searchQuery: 'sprint',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('b-2');
  });
});
