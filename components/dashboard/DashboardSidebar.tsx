import { DASHBOARD_SECTIONS, type DashboardSection } from '@/lib/dashboard/navigation';
import Link from 'next/link';
import { DashboardSignOutButton } from '@/components/dashboard/DashboardSignOutButton';
import type { ReactElement } from 'react';

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  userEmail: string | null;
}

const NAV_LABELS: Record<DashboardSection, string> = {
  home: 'Home',
  recent: 'Recent',
  starred: 'Starred',
};

function buildSectionHref(section: DashboardSection): string {
  const query = new URLSearchParams({ section });
  return `/?${query.toString()}`;
}

export function DashboardSidebar({ activeSection, userEmail }: DashboardSidebarProps): ReactElement {
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

      <div className="mb-5">
        <label htmlFor="dashboard-nav-search" className="sr-only">
          Search boards
        </label>
        <input
          id="dashboard-nav-search"
          type="search"
          placeholder="Search boards (coming soon)"
          disabled
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      </div>

      <nav className="space-y-1" aria-label="Sections">
        {DASHBOARD_SECTIONS.map((section) => {
          const isActive = activeSection === section;

          return (
            <Link
              key={section}
              href={buildSectionHref(section)}
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
