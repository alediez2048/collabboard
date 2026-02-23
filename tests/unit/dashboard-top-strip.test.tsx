import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardTopStrip } from '@/components/dashboard/DashboardTopStrip';
import type { DashboardSectionMeta } from '@/lib/dashboard/navigation';

vi.mock('@/components/create-board-button', () => ({
  CreateBoardButton: ({ dataTestId }: { dataTestId?: string }) => (
    <button type="button" data-testid={dataTestId}>
      Create Board
    </button>
  ),
}));

vi.mock('@/components/dashboard/DashboardViewToggle', () => ({
  DashboardViewToggle: () => (
    <div data-testid="dashboard-view-controls">
      <button type="button">Grid</button>
      <button type="button">List</button>
    </div>
  ),
}));

const sectionMeta: DashboardSectionMeta = {
  title: 'Home',
  description: 'All boards you can access right now.',
  emptyStateTitle: 'No boards yet',
  emptyStateDescription: 'Create your first board to start collaborating.',
};

describe('DashboardTopStrip', () => {
  it('shows section context, create action, and view-mode controls', () => {
    render(
      <DashboardTopStrip
        sectionMeta={sectionMeta}
        userId="user-1"
        activeSection="home"
        searchQuery=""
        viewMode="grid"
        hasExplicitViewModeParam={false}
      />,
    );

    expect(screen.getByText('Your Boards')).toBeInTheDocument();
    expect(screen.getByText('Home: All boards you can access right now.')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-create-board-button')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-view-controls')).toBeInTheDocument();
    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
  });
});
