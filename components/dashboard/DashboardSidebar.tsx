import {
  buildDashboardHref,
  DASHBOARD_SECTIONS,
  type DashboardSection,
  type DashboardViewMode,
} from '@/lib/dashboard/navigation';
import Link from 'next/link';
import { DashboardSignOutButton } from '@/components/dashboard/DashboardSignOutButton';
import type { ReactElement } from 'react';

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  userEmail: string | null;
  searchQuery: string;
  viewMode: DashboardViewMode;
}

const NAV_LABELS: Record<DashboardSection, string> = {
  home: 'Home',
  recent: 'Recent',
  starred: 'Starred',
};

export function DashboardSidebar({
  activeSection,
  userEmail,
  searchQuery,
  viewMode,
}: DashboardSidebarProps): ReactElement {
  return (
    <aside
      data-testid="dashboard-sidebar"
      className="flex h-full flex-col rounded-lg border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000]"
      aria-label="Dashboard navigation"
    >
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--nb-text-muted)]">Workspace</p>
        <h2 className="text-lg font-black text-black">CollabBoard</h2>
        {userEmail && <p className="text-xs font-medium text-[var(--nb-text-muted)]">{userEmail}</p>}
      </div>

      <form className="mb-5 space-y-2" method="get" action="/">
        <input type="hidden" name="section" value={activeSection} />
        <input type="hidden" name="view" value={viewMode} />
        <label htmlFor="dashboard-nav-search" className="sr-only">
          Search boards
        </label>
        <input
          id="dashboard-nav-search"
          name="q"
          type="search"
          placeholder="Search boards"
          defaultValue={searchQuery}
          className="nb-input w-full px-3 py-2 text-sm text-black"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="nb-btn inline-flex items-center px-2.5 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-blue)]"
          >
            Search
          </button>
          {searchQuery && (
            <Link
              href={buildDashboardHref({
                section: activeSection,
                searchQuery: '',
                viewMode,
              })}
              className="text-xs font-bold text-black underline underline-offset-2 hover:text-[var(--nb-accent-blue)]"
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
              href={buildDashboardHref({
                section,
                searchQuery,
                viewMode,
              })}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`dashboard-nav-${section}`}
              className={`block rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-[var(--nb-accent-blue)] text-black border-2 border-black'
                  : 'text-black hover:bg-[var(--nb-bg)] border-2 border-transparent'
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
