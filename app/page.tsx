import { DashboardSectionContent } from '@/components/dashboard/DashboardSectionContent';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopStrip } from '@/components/dashboard/DashboardTopStrip';
import { buildDashboardBoardList } from '@/lib/dashboard/discovery';
import { buildDashboardThumbnailMap, type BoardSnapshotRow } from '@/lib/dashboard/thumbnail';
import {
  getDashboardSectionMeta,
  parseDashboardSearchQuery,
  parseDashboardSection,
  parseDashboardViewMode,
} from '@/lib/dashboard/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Board, BoardUserState } from '@/types/board';
import { redirect } from 'next/navigation';

interface HomePageSearchParams {
  section?: string | string[];
  q?: string | string[];
  view?: string | string[];
}

interface HomePageProps {
  searchParams?: Promise<HomePageSearchParams> | HomePageSearchParams;
}

const DASHBOARD_THUMBNAIL_FETCH_LIMIT = 24;

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'then' in value && typeof value.then === 'function';
}

async function resolveSearchParams(
  searchParams: HomePageProps['searchParams'],
): Promise<HomePageSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromiseLike<HomePageSearchParams>(searchParams)) {
    return await searchParams;
  }

  return searchParams;
}

function escapeIlikeQuery(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const activeSection = parseDashboardSection(resolvedSearchParams.section);
  const searchQuery = parseDashboardSearchQuery(resolvedSearchParams.q);
  const viewMode = parseDashboardViewMode(resolvedSearchParams.view);
  const hasExplicitViewModeParam = resolvedSearchParams.view !== undefined;
  const sectionMeta = getDashboardSectionMeta(activeSection);

  let boards: Board[] = [];
  let boardStates: BoardUserState[] = [];
  let loadErrorMessage: string | null = null;

  let stateQuery = supabase
    .from('board_user_state')
    .select('board_id, user_id, is_starred, last_opened_at, updated_at')
    .eq('user_id', user.id);

  if (activeSection === 'starred') {
    stateQuery = stateQuery.eq('is_starred', true);
  }

  if (activeSection === 'recent') {
    stateQuery = stateQuery.not('last_opened_at', 'is', null).order('last_opened_at', {
      ascending: false,
    });
  }

  const { data: statesData, error: statesError } = await stateQuery;
  if (statesError) {
    loadErrorMessage = statesError.message;
  } else {
    boardStates = (statesData ?? []) as BoardUserState[];
  }

  if (activeSection === 'home') {
    let boardQuery = supabase
      .from('boards')
      .select('id, name, created_by, created_at')
      .order('created_at', { ascending: false });

    if (searchQuery) {
      boardQuery = boardQuery.ilike('name', `%${escapeIlikeQuery(searchQuery)}%`);
    }

    const { data: boardData, error: boardError } = await boardQuery;
    if (boardError) {
      loadErrorMessage = loadErrorMessage ?? boardError.message;
    } else {
      boards = (boardData ?? []) as Board[];
    }
  } else {
    const boardIds = boardStates.map((state) => state.board_id);

    if (boardIds.length > 0) {
      let boardQuery = supabase.from('boards').select('id, name, created_by, created_at').in('id', boardIds);

      if (searchQuery) {
        boardQuery = boardQuery.ilike('name', `%${escapeIlikeQuery(searchQuery)}%`);
      }

      const { data: boardData, error: boardError } = await boardQuery;
      if (boardError) {
        loadErrorMessage = loadErrorMessage ?? boardError.message;
      } else {
        boards = (boardData ?? []) as Board[];
      }
    }
  }

  const baseBoardList = buildDashboardBoardList({
    boards,
    states: boardStates,
    section: activeSection,
    searchQuery,
  });
  const allVisibleBoardIds = baseBoardList.map((board) => board.id);
  const snapshotFetchBoardIds = allVisibleBoardIds.slice(0, DASHBOARD_THUMBNAIL_FETCH_LIMIT);

  let snapshotRows: BoardSnapshotRow[] = [];
  if (snapshotFetchBoardIds.length > 0) {
    const { data: snapshotData } = await supabase
      .from('board_snapshots')
      .select('board_id, yjs_state, snapshot_at')
      .in('board_id', snapshotFetchBoardIds);
    snapshotRows = (snapshotData ?? []) as BoardSnapshotRow[];
  }

  const thumbnailsByBoardId = buildDashboardThumbnailMap(allVisibleBoardIds, snapshotRows);
  const boardList = baseBoardList.map((board) => ({
    ...board,
    thumbnail: thumbnailsByBoardId.get(board.id),
  }));

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          activeSection={activeSection}
          userEmail={user.email ?? null}
          searchQuery={searchQuery}
          viewMode={viewMode}
        />
      }
      topStrip={(
        <DashboardTopStrip
          sectionMeta={sectionMeta}
          userId={user.id}
          activeSection={activeSection}
          searchQuery={searchQuery}
          viewMode={viewMode}
          hasExplicitViewModeParam={hasExplicitViewModeParam}
        />
      )}
    >
      {loadErrorMessage && (
        <div
          role="alert"
          data-testid="dashboard-load-error"
          className="rounded-lg border-2 border-black bg-[var(--nb-accent-red)] p-4 text-black shadow-[4px_4px_0px_#000]"
        >
          <h2 className="font-bold">Unable to load boards</h2>
          <p className="mt-1 text-sm font-medium">
            {loadErrorMessage || 'Please refresh the page and try again.'}
          </p>
        </div>
      )}

      <DashboardSectionContent
        boards={boardList}
        userId={user.id}
        activeSection={activeSection}
        searchQuery={searchQuery}
        viewMode={viewMode}
      />
    </DashboardShell>
  );
}
