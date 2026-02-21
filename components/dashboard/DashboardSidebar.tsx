import { DASHBOARD_SECTIONS, type DashboardSection } from '@/lib/dashboard/navigation';
import Link from 'next/link';
import { DashboardSignOutButton } from '@/components/dashboard/DashboardSignOutButton';
import type { ReactElement } from 'react';

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  userEmail: string | null;
  searchQuery: string;
}

const NAV_LABELS: Record<DashboardSection, string> = {
  home: 'Home',
  recent: 'Recent',
  starred: 'Starred',
};

function buildSectionHref(section: DashboardSection, searchQuery: string): string {
  const query = new URLSearchParams({ section });
  if (searchQuery) {
    query.set('q', searchQuery);
  }
  return `/?${query.toString()}`;
}

export function DashboardSidebar({
  activeSection,
  userEmail,
  searchQuery,
}: DashboardSidebarProps): ReactElement {
  return (
    <aside
      data-testid="dashboard-sidebar"
      className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label="Dashboard navigation"
    >
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workspace</p>
        <h2 className="text-lg font-semibold text-gray-900">CollabBoard</h2>
        {userEmail && <p className="text-xs text-gray-500">{userEmail}</p>}
      </div>

      <form className="mb-5 space-y-2" method="get" action="/">
        <input type="hidden" name="section" value={activeSection} />
        <label htmlFor="dashboard-nav-search" className="sr-only">
          Search boards
        </label>
        <input
          id="dashboard-nav-search"
          name="q"
          type="search"
          placeholder="Search boards"
          defaultValue={searchQuery}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
          {searchQuery && (
            <Link
              href={`/?section=${activeSection}`}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <nav className="space-y-1" aria-label="Sections">
        {DASHBOARD_SECTIONS.map((section) => {
          const isActive = activeSection === section;

          return (
            <Link
              key={section}
              href={buildSectionHref(section, searchQuery)}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`dashboard-nav-${section}`}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {NAV_LABELS[section]}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <DashboardSignOutButton />
      </div>
    </aside>
  );
}
