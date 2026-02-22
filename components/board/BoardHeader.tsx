'use client';

import { useRouter } from 'next/navigation';
import type { WebsocketProvider } from 'y-websocket';
import { PresenceBar } from './PresenceBar';
import { ShareButton } from './ShareButton';

type BoardSaveState = 'saving' | 'saved';

interface BoardHeaderProps {
  boardName: string;
  boardId: string;
  saveState: BoardSaveState;
  canClearBoard: boolean;
  isClearingBoard: boolean;
  onClearBoard: () => void;
  provider: WebsocketProvider | null;
  currentUserId: string;
}

export function BoardHeader({
  boardName,
  boardId,
  saveState,
  canClearBoard,
  isClearingBoard,
  onClearBoard,
  provider,
  currentUserId,
}: BoardHeaderProps) {
  const router = useRouter();
  const displayName = boardName.trim().length > 0 ? boardName : 'Untitled Board';
  const statusLabel = saveState === 'saving' ? 'Saving...' : 'Saved';
  const clearButtonTitle = canClearBoard
    ? 'Clear board'
    : 'Only the board owner can clear this board';

  return (
    <div className="absolute left-4 right-4 top-4 z-20">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            data-testid="back-to-boards-button"
            onClick={() => router.push('/')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            title="Back to boards"
            aria-label="Back to boards"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Board</p>
            <h1
              data-testid="board-header-name"
              className="truncate text-sm font-semibold text-gray-900"
              title={displayName}
            >
              {displayName}
            </h1>
          </div>

          <div className="hidden items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 sm:inline-flex">
            <span
              className={`h-2 w-2 rounded-full ${
                saveState === 'saving' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span data-testid="board-save-status">{statusLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {provider && currentUserId ? (
            <PresenceBar provider={provider} currentUserId={currentUserId} inline />
          ) : (
            <div className="hidden rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500 md:block">
              No collaborators
            </div>
          )}

          <button
            type="button"
            data-testid="clear-board-button"
            onClick={onClearBoard}
            disabled={!canClearBoard || isClearingBoard}
            title={clearButtonTitle}
            className="inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isClearingBoard ? 'Clearing...' : 'Clear'}
          </button>

          <ShareButton boardId={boardId} inline />
        </div>
      </div>
    </div>
  );
}
