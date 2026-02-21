import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSectionContent } from '@/components/dashboard/DashboardSectionContent';
import type { DashboardBoard } from '@/types/board';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/board-name-editable', () => ({
  BoardNameEditable: ({ initialName }: { initialName: string }) => <span>{initialName}</span>,
}));

vi.mock('@/components/delete-board-button', () => ({
  DeleteBoardButton: ({ boardId }: { boardId: string }) => (
    <button type="button">Delete {boardId}</button>
  ),
}));

vi.mock('@/components/dashboard/DashboardStarButton', () => ({
  DashboardStarButton: ({ boardId }: { boardId: string }) => (
    <button type="button">Star {boardId}</button>
  ),
}));

vi.mock('@/components/dashboard/DashboardTemplateGallery', () => ({
  DashboardTemplateGallery: () => (
    <section data-testid="dashboard-template-gallery">
      <h2>Start from Template</h2>
    </section>
  ),
}));

function makeBoard(
  partial: Partial<DashboardBoard> & Pick<DashboardBoard, 'id' | 'name'>,
): DashboardBoard {
  return {
    id: partial.id,
    name: partial.name,
    created_by: partial.created_by ?? 'owner-1',
    created_at: partial.created_at ?? '2026-02-20T00:00:00.000Z',
    is_starred: partial.is_starred ?? false,
    last_opened_at: partial.last_opened_at ?? null,
  };
}

describe('DashboardSectionContent', () => {
  it('renders home empty state when there are no boards', () => {
    render(
      <DashboardSectionContent boards={[]} userId="owner-1" activeSection="home" searchQuery="" />,
    );
    expect(screen.queryByTestId('dashboard-template-gallery')).not.toBeInTheDocument();
    expect(screen.getByText('No boards yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first board to start collaborating.')).toBeInTheDocument();
  });

  it('renders owned and shared board groups on home section', () => {
    const boards = [
      makeBoard({ id: 'owned-1', name: 'Owned Board', created_by: 'owner-1' }),
      makeBoard({ id: 'shared-1', name: 'Shared Board', created_by: 'other-user' }),
    ];

    render(
      <DashboardSectionContent
        boards={boards}
        userId="owner-1"
        activeSection="home"
        searchQuery=""
      />,
    );
    expect(screen.getByTestId('board-card-owned-1')).toBeInTheDocument();
    expect(screen.getByTestId('board-card-shared-1')).toBeInTheDocument();
    expect(screen.getByText('Shared with me')).toBeInTheDocument();
  });

  it('renders search-specific empty state when no boards match', () => {
    render(
      <DashboardSectionContent
        boards={[]}
        userId="owner-1"
        activeSection="starred"
        searchQuery="roadmap"
      />,
    );

    expect(screen.getByText('No boards match "roadmap"')).toBeInTheDocument();
    expect(
      screen.getByText('Try another search or clear the query to see more boards.'),
    ).toBeInTheDocument();
  });

  it('does not render scaffold messaging for recent section', () => {
    render(
      <DashboardSectionContent
        boards={[
          makeBoard({
            id: 'recent-1',
            name: 'Recent Board',
            last_opened_at: '2026-02-20T12:00:00.000Z',
          }),
        ]}
        userId="owner-1"
        activeSection="recent"
        searchQuery=""
      />,
    );

    expect(screen.queryByTestId('dashboard-section-scaffold-note')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-section-recent')).toBeInTheDocument();
  });

  it('does not render template gallery outside of home section', () => {
    render(
      <DashboardSectionContent
        boards={[makeBoard({ id: 'starred-1', name: 'Starred Board', is_starred: true })]}
        userId="owner-1"
        activeSection="starred"
        searchQuery=""
      />,
    );

    expect(screen.queryByTestId('dashboard-template-gallery')).not.toBeInTheDocument();
  });
});
