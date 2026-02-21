import { DashboardSectionContent } from '@/components/dashboard/DashboardSectionContent';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopStrip } from '@/components/dashboard/DashboardTopStrip';
import { buildDashboardBoardList } from '@/lib/dashboard/discovery';
import {
  getDashboardSectionMeta,
  parseDashboardSearchQuery,
  parseDashboardSection,
} from '@/lib/dashboard/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Board, BoardUserState } from '@/types/board';
import { redirect } from 'next/navigation';

interface HomePageSearchParams {
  section?: string | string[];
  q?: string | string[];
}

interface HomePageProps {
  searchParams?: Promise<HomePageSearchParams> | HomePageSearchParams;
}

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

  const boardList = buildDashboardBoardList({
    boards,
    states: boardStates,
    section: activeSection,
    searchQuery,
  });

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          activeSection={activeSection}
          userEmail={user.email ?? null}
          searchQuery={searchQuery}
        />
      }
      topStrip={<DashboardTopStrip sectionMeta={sectionMeta} userId={user.id} />}
    >
      {loadErrorMessage && (
        <div
          role="alert"
          data-testid="dashboard-load-error"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <h2 className="font-semibold">Unable to load boards</h2>
          <p className="mt-1 text-sm">
            {loadErrorMessage || 'Please refresh the page and try again.'}
          </p>
        </div>
      )}

      <DashboardSectionContent
        boards={boardList}
        userId={user.id}
        activeSection={activeSection}
        searchQuery={searchQuery}
      />
    </DashboardShell>
  );
}
