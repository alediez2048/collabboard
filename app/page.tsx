import { DashboardSectionContent } from '@/components/dashboard/DashboardSectionContent';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopStrip } from '@/components/dashboard/DashboardTopStrip';
import {
  getDashboardSectionMeta,
  parseDashboardSection,
} from '@/lib/dashboard/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Board } from '@/types/board';
import { redirect } from 'next/navigation';

interface HomePageSearchParams {
  section?: string | string[];
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

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all boards the user can access (owned + shared via RLS policy)
  const { data: boards, error } = await supabase
    .from('boards')
    .select('id, name, created_by, created_at')
    .order('created_at', { ascending: false });

  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const activeSection = parseDashboardSection(resolvedSearchParams.section);
  const sectionMeta = getDashboardSectionMeta(activeSection);
  const boardList = (boards ?? []) as Board[];

  return (
    <DashboardShell
      sidebar={<DashboardSidebar activeSection={activeSection} userEmail={user.email ?? null} />}
      topStrip={<DashboardTopStrip sectionMeta={sectionMeta} userId={user.id} />}
    >
      {error && (
        <div
          role="alert"
          data-testid="dashboard-load-error"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <h2 className="font-semibold">Unable to load boards</h2>
          <p className="mt-1 text-sm">
            {error.message || 'Please refresh the page and try again.'}
          </p>
        </div>
      )}

      <DashboardSectionContent boards={boardList} userId={user.id} activeSection={activeSection} />
    </DashboardShell>
  );
}
