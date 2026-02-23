import { DashboardBoardCard } from '@/components/dashboard/DashboardBoardCard';
import { DashboardTemplateGallery } from '@/components/dashboard/DashboardTemplateGallery';
import {
  getDashboardSectionMeta,
  type DashboardSection,
  type DashboardViewMode,
} from '@/lib/dashboard/navigation';
import type { DashboardBoard } from '@/types/board';
import type { ReactElement } from 'react';

interface DashboardSectionContentProps {
  boards: DashboardBoard[];
  userId: string;
  activeSection: DashboardSection;
  searchQuery: string;
  viewMode: DashboardViewMode;
}

function boardCollectionClassName(viewMode: DashboardViewMode): string {
  if (viewMode === 'list') {
    return 'space-y-4';
  }

  return 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3';
}

function EmptySection({
  title,
  description,
  testId,
}: {
  title: string;
  description: string;
  testId: string;
}): ReactElement {
  return (
    <section
      data-testid={testId}
      className="rounded-lg border-2 border-dashed border-black bg-white px-6 py-10 text-center"
    >
      <h2 className="text-lg font-bold text-black">{title}</h2>
      <p className="mt-2 text-sm font-medium text-[var(--nb-text-muted)]">{description}</p>
    </section>
  );
}

export function DashboardSectionContent({
  boards,
  userId,
  activeSection,
  searchQuery,
  viewMode,
}: DashboardSectionContentProps): ReactElement {
  const sectionMeta = getDashboardSectionMeta(activeSection);
  const ownedBoards = boards.filter((board) => board.created_by === userId);
  const sharedBoards = boards.filter((board) => board.created_by !== userId);
  const emptyStateTitle = searchQuery
    ? `No boards match "${searchQuery}"`
    : sectionMeta.emptyStateTitle;
  const emptyStateDescription = searchQuery
    ? 'Try another search or clear the query to see more boards.'
    : sectionMeta.emptyStateDescription;

  if (activeSection === 'home') {
    if (boards.length === 0) {
      return (
        <section data-testid="dashboard-section-home" className="space-y-6">
          <DashboardTemplateGallery />
          <EmptySection
            testId="dashboard-empty-home"
            title={emptyStateTitle}
            description={emptyStateDescription}
          />
        </section>
      );
    }

    return (
      <section data-testid="dashboard-section-home" className="space-y-6">
        <DashboardTemplateGallery />
        <div data-testid={`dashboard-board-layout-${viewMode}`} className="sr-only" aria-hidden />
        {ownedBoards.length > 0 && (
          <div className={boardCollectionClassName(viewMode)}>
            {ownedBoards.map((board) => (
              <DashboardBoardCard
                key={board.id}
                board={board}
                isOwnedByCurrentUser
                viewMode={viewMode}
              />
            ))}
          </div>
        )}

        {sharedBoards.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-black">Shared with me</h2>
            <div className={boardCollectionClassName(viewMode)}>
              {sharedBoards.map((board) => (
                <DashboardBoardCard
                  key={board.id}
                  board={board}
                  isOwnedByCurrentUser={false}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  if (boards.length === 0) {
    return (
      <EmptySection
        testId={`dashboard-empty-${activeSection}`}
        title={emptyStateTitle}
        description={emptyStateDescription}
      />
    );
  }

  return (
    <section data-testid={`dashboard-section-${activeSection}`} className="space-y-4">
      <div
        data-testid={`dashboard-board-layout-${viewMode}`}
        className={boardCollectionClassName(viewMode)}
      >
        {boards.map((board) => (
          <DashboardBoardCard
            key={board.id}
            board={board}
            isOwnedByCurrentUser={board.created_by === userId}
            viewMode={viewMode}
          />
        ))}
      </div>
    </section>
  );
}
