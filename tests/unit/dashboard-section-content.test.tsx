import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSectionContent } from '@/components/dashboard/DashboardSectionContent';
import type { Board } from '@/types/board';

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

function makeBoard(partial: Partial<Board> & Pick<Board, 'id' | 'name'>): Board {
  return {
    id: partial.id,
    name: partial.name,
    created_by: partial.created_by ?? 'owner-1',
    created_at: partial.created_at ?? '2026-02-20T00:00:00.000Z',
  };
}

describe('DashboardSectionContent', () => {
  it('renders a home empty state when there are no boards', () => {
    render(<DashboardSectionContent boards={[]} userId="owner-1" activeSection="home" />);
    expect(screen.getByText('No boards yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first board to start collaborating.')).toBeInTheDocument();
  });

  it('renders owned and shared board groups on home section', () => {
    const boards = [
      makeBoard({ id: 'owned-1', name: 'Owned Board', created_by: 'owner-1' }),
      makeBoard({ id: 'shared-1', name: 'Shared Board', created_by: 'other-user' }),
    ];

    render(<DashboardSectionContent boards={boards} userId="owner-1" activeSection="home" />);
    expect(screen.getByTestId('board-card-owned-1')).toBeInTheDocument();
    expect(screen.getByTestId('board-card-shared-1')).toBeInTheDocument();
    expect(screen.getByText('Shared with me')).toBeInTheDocument();
  });
});
