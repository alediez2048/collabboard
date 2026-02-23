import Link from 'next/link';
import type { DashboardBoard } from '@/types/board';
import { BoardNameEditable } from '@/components/board-name-editable';
import { DeleteBoardButton } from '@/components/delete-board-button';
import { DashboardBoardPreview } from '@/components/dashboard/DashboardBoardPreview';
import { DashboardStarButton } from '@/components/dashboard/DashboardStarButton';
import { SaveAsTemplateButton } from '@/components/dashboard/SaveAsTemplateButton';
import type { DashboardViewMode } from '@/lib/dashboard/navigation';
import type { ReactElement } from 'react';

interface DashboardBoardCardProps {
  board: DashboardBoard;
  isOwnedByCurrentUser: boolean;
  viewMode: DashboardViewMode;
}

function formatBoardDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  return parsedDate.toLocaleDateString();
}

function metadataDateLabel(board: DashboardBoard, isOwnedByCurrentUser: boolean): string {
  const prefix = isOwnedByCurrentUser ? 'Created' : 'Joined';
  return `${prefix} ${formatBoardDate(board.created_at)}`;
}

function renderBoardTitle(board: DashboardBoard, isOwnedByCurrentUser: boolean): ReactElement {
  if (isOwnedByCurrentUser) {
    return <BoardNameEditable boardId={board.id} initialName={board.name} />;
  }

  return (
    <div className="flex items-center gap-2">
      <h3 className="text-lg font-bold text-black">{board.name}</h3>
      <span className="rounded-md border-2 border-black bg-[var(--nb-accent-pink)] px-2 py-0.5 text-xs font-bold uppercase text-black">
        Shared
      </span>
    </div>
  );
}

export function DashboardBoardCard({
  board,
  isOwnedByCurrentUser,
  viewMode,
}: DashboardBoardCardProps): ReactElement {
  return (
    <article
      data-testid={`board-card-${board.id}`}
      className={`group overflow-hidden rounded-lg border-2 border-black bg-white shadow-[4px_4px_0px_#000] transition-all hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] ${
        viewMode === 'list' ? 'p-4 md:flex md:items-stretch md:gap-4' : 'p-4'}`}
    >
      <div
        className={viewMode === 'list' ? 'mb-3 h-28 md:mb-0 md:h-auto md:w-56 md:shrink-0' : 'h-36'}
      >
        <DashboardBoardPreview boardId={board.id} thumbnail={board.thumbnail} />
      </div>

      <div className={viewMode === 'list' ? 'flex min-w-0 flex-1 flex-col gap-3' : 'mt-4 space-y-3'}>
        <div className="space-y-1">
          {renderBoardTitle(board, isOwnedByCurrentUser)}
          <p className="text-sm font-medium text-[var(--nb-text-muted)]">{metadataDateLabel(board, isOwnedByCurrentUser)}</p>
          {board.last_opened_at && (
            <p className="text-xs font-medium text-[var(--nb-text-muted)]">Last opened {formatBoardDate(board.last_opened_at)}</p>
          )}
        </div>

        {board.thumbnail && (
          <p className="text-xs font-medium text-[var(--nb-text-muted)]">
            {board.thumbnail.objectCount > 0
              ? `${board.thumbnail.objectCount} object${board.thumbnail.objectCount === 1 ? '' : 's'} in preview`
              : 'No board objects yet'}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/board/${board.id}`}
            className="nb-btn inline-flex px-3 py-1 text-sm font-bold uppercase text-black bg-[var(--nb-accent-blue)]"
          >
            Open board
          </Link>
          <div className="flex items-center gap-2">
            {isOwnedByCurrentUser && <SaveAsTemplateButton boardId={board.id} boardName={board.name} />}
            <DashboardStarButton boardId={board.id} initialIsStarred={board.is_starred} />
            {isOwnedByCurrentUser && <DeleteBoardButton boardId={board.id} boardName={board.name} />}
          </div>
        </div>
      </div>
    </article>
  );
}
