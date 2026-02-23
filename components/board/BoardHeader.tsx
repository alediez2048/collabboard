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
        <div className="flex items-center justify-between gap-4 rounded-lg border-2 border-black bg-white px-4 py-2 shadow-[4px_4px_0px_#000]">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            data-testid="back-to-boards-button"
            onClick={() => router.push('/')}
            className="nb-btn inline-flex h-9 w-9 items-center justify-center bg-white text-black"
            title="Back to boards"
            aria-label="Back to boards"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--nb-text-muted)]">Board</p>
            <h1
              data-testid="board-header-name"
              className="truncate text-sm font-bold text-black"
              title={displayName}
            >
              {displayName}
            </h1>
          </div>

          <div className="hidden items-center gap-2 rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black sm:inline-flex">
            <span
              className={`h-2.5 w-2.5 rounded-full border-2 border-black ${
                saveState === 'saving' ? 'bg-[var(--nb-accent-orange)]' : 'bg-[var(--nb-accent-green)]'
              }`}
            />
            <span data-testid="board-save-status">{statusLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {provider && currentUserId ? (
            <PresenceBar provider={provider} currentUserId={currentUserId} inline />
          ) : (
            <div className="hidden rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-bold text-[var(--nb-text-muted)] md:block">
              No collaborators
            </div>
          )}

          <button
            type="button"
            data-testid="clear-board-button"
            onClick={onClearBoard}
            disabled={!canClearBoard || isClearingBoard}
            title={clearButtonTitle}
            className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold uppercase text-black bg-[var(--nb-accent-red)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isClearingBoard ? 'Clearing...' : 'Clear'}
          </button>

          <ShareButton boardId={boardId} inline />
        </div>
      </div>
    </div>
  );
}
