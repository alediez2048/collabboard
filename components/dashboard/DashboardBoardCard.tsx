import Link from 'next/link';
import type { Board } from '@/types/board';
import { BoardNameEditable } from '@/components/board-name-editable';
import { DeleteBoardButton } from '@/components/delete-board-button';
import type { ReactElement } from 'react';

interface DashboardBoardCardProps {
  board: Board;
  isOwnedByCurrentUser: boolean;
}

function formatBoardDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  return parsedDate.toLocaleDateString();
}

export function DashboardBoardCard({
  board,
  isOwnedByCurrentUser,
}: DashboardBoardCardProps): ReactElement {
  if (!isOwnedByCurrentUser) {
    return (
      <div
        data-testid={`board-card-${board.id}`}
        className="group relative rounded-lg border border-blue-100 bg-white shadow-sm transition-shadow hover:shadow-md"
      >
        <Link href={`/board/${board.id}`} className="block p-6">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="pr-8 text-xl font-semibold text-gray-900">{board.name}</h3>
            <span className="ml-2 shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
              Shared
            </span>
          </div>
          <p className="text-sm text-gray-500">Joined {formatBoardDate(board.created_at)}</p>
          <span className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            Open board
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid={`board-card-${board.id}`}
      className="group relative rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="p-6 pr-12">
        <BoardNameEditable boardId={board.id} initialName={board.name} />
        <p className="text-sm text-gray-500">Created {formatBoardDate(board.created_at)}</p>
        <Link
          href={`/board/${board.id}`}
          className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Open board
        </Link>
      </div>
      <div className="absolute right-4 top-4">
        <DeleteBoardButton boardId={board.id} boardName={board.name} />
      </div>
    </div>
  );
}
