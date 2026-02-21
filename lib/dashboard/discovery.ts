import type { DashboardSection } from '@/lib/dashboard/navigation';
import type { Board, BoardUserState, DashboardBoard } from '@/types/board';

interface BuildDashboardBoardListParams {
  boards: Board[];
  states: BoardUserState[];
  section: DashboardSection;
  searchQuery: string;
}

function toTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mergeBoardState(boards: Board[], states: BoardUserState[]): DashboardBoard[] {
  const stateByBoardId = new Map<string, BoardUserState>();
  states.forEach((state) => {
    stateByBoardId.set(state.board_id, state);
  });

  return boards.map((board) => {
    const state = stateByBoardId.get(board.id);
    return {
      ...board,
      is_starred: state?.is_starred ?? false,
      last_opened_at: state?.last_opened_at ?? null,
    };
  });
}

function filterBySection(boards: DashboardBoard[], section: DashboardSection): DashboardBoard[] {
  if (section === 'starred') {
    return boards.filter((board) => board.is_starred);
  }

  if (section === 'recent') {
    return boards.filter((board) => board.last_opened_at !== null);
  }

  return boards;
}

function applySearch(boards: DashboardBoard[], searchQuery: string): DashboardBoard[] {
  if (!searchQuery) {
    return boards;
  }

  const normalizedQuery = searchQuery.toLowerCase();
  return boards.filter((board) => board.name.toLowerCase().includes(normalizedQuery));
}

function sortForSection(boards: DashboardBoard[], section: DashboardSection): DashboardBoard[] {
  if (section !== 'recent') {
    return boards;
  }

  return [...boards].sort((left, right) => toTimestamp(right.last_opened_at) - toTimestamp(left.last_opened_at));
}

export function buildDashboardBoardList({
  boards,
  states,
  section,
  searchQuery,
}: BuildDashboardBoardListParams): DashboardBoard[] {
  const mergedBoards = mergeBoardState(boards, states);
  const sectionScopedBoards = filterBySection(mergedBoards, section);
  const searchedBoards = applySearch(sectionScopedBoards, searchQuery);
  return sortForSection(searchedBoards, section);
}
