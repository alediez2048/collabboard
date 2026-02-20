'use client';

import { useRouter } from 'next/navigation';

interface BoardHeaderProps {
  boardName: string;
}

export function BoardHeader({ boardName }: BoardHeaderProps) {
  const router = useRouter();
  const displayName = boardName.trim().length > 0 ? boardName : 'Untitled Board';

  return (
    <div className="absolute top-4 left-4 z-20 max-w-[min(48vw,36rem)]">
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
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
      </div>
    </div>
  );
}
