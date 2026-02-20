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

const sectionMeta: DashboardSectionMeta = {
  title: 'Home',
  description: 'All boards you can access right now.',
  emptyStateTitle: 'No boards yet',
  emptyStateDescription: 'Create your first board to start collaborating.',
};

describe('DashboardTopStrip', () => {
  it('shows only section context and create action without placeholder controls', () => {
    render(<DashboardTopStrip sectionMeta={sectionMeta} userId="user-1" />);

    expect(screen.getByText('Your Boards')).toBeInTheDocument();
    expect(screen.getByText('Home: All boards you can access right now.')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-create-board-button')).toBeInTheDocument();

    expect(screen.queryByTestId('dashboard-view-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-ai-placeholder')).not.toBeInTheDocument();
    expect(screen.queryByText('Grid')).not.toBeInTheDocument();
    expect(screen.queryByText('List')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Assistant (Soon)')).not.toBeInTheDocument();
  });
});
