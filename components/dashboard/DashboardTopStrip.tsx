import { CreateBoardButton } from '@/components/create-board-button';
import type { DashboardSectionMeta } from '@/lib/dashboard/navigation';
import type { ReactElement } from 'react';

interface DashboardTopStripProps {
  sectionMeta: DashboardSectionMeta;
  userId: string;
}

export function DashboardTopStrip({ sectionMeta, userId }: DashboardTopStripProps): ReactElement {
  return (
    <header
      data-testid="dashboard-top-strip"
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-start md:justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Boards</h1>
        <p className="text-sm text-gray-600">
          {sectionMeta.title}: {sectionMeta.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CreateBoardButton userId={userId} dataTestId="dashboard-create-board-button" />
      </div>
    </header>
  );
}
