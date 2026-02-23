import { CreateBoardButton } from '@/components/create-board-button';
import { DashboardViewToggle } from '@/components/dashboard/DashboardViewToggle';
import type {
  DashboardSection,
  DashboardSectionMeta,
  DashboardViewMode,
} from '@/lib/dashboard/navigation';
import type { ReactElement } from 'react';

interface DashboardTopStripProps {
  sectionMeta: DashboardSectionMeta;
  userId: string;
  activeSection: DashboardSection;
  searchQuery: string;
  viewMode: DashboardViewMode;
  hasExplicitViewModeParam: boolean;
}

export function DashboardTopStrip({
  sectionMeta,
  userId,
  activeSection,
  searchQuery,
  viewMode,
  hasExplicitViewModeParam,
}: DashboardTopStripProps): ReactElement {
  return (
    <header
      data-testid="dashboard-top-strip"
      className="flex flex-col gap-4 rounded-lg border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] md:flex-row md:items-start md:justify-between"
    >
      <div>
        <h1 className="text-3xl font-black text-black">Your Boards</h1>
        <p className="text-sm font-medium text-[var(--nb-text-muted)]">
          {sectionMeta.title}: {sectionMeta.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DashboardViewToggle
          activeSection={activeSection}
          searchQuery={searchQuery}
          viewMode={viewMode}
          hasExplicitViewModeParam={hasExplicitViewModeParam}
        />
        <CreateBoardButton userId={userId} dataTestId="dashboard-create-board-button" />
      </div>
    </header>
  );
}
