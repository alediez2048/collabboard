'use client';

import type { CommentMessage } from '@/lib/yjs/board-doc';

interface CommentThreadPanelProps {
  isOpen: boolean;
  isResolved: boolean;
  draftText: string;
  messages: CommentMessage[];
  position: { left: number; top: number } | null;
  onDraftTextChange: (nextText: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onToggleResolved: () => void;
}

function formatMessageTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Just now';
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CommentThreadPanel({
  isOpen,
  isResolved,
  draftText,
  messages,
  position,
  onDraftTextChange,
  onSubmit,
  onClose,
  onToggleResolved,
}: CommentThreadPanelProps) {
  if (!isOpen || !position) {
    return null;
  }

  return (
    <div
      data-testid="comment-thread-panel"
      className="absolute z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Comment thread</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close comment thread"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="rounded-md bg-blue-50 px-2 py-2 text-xs text-blue-700">
            Add the first message to start this thread.
          </p>
        ) : (
          messages.map((message) => (
            <article key={message.id} className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">{message.authorName}</span>
                <span className="text-[11px] text-gray-500">{formatMessageTimestamp(message.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{message.text}</p>
            </article>
          ))
        )}
      </div>

      <div className="mt-3">
        <textarea
          value={draftText}
          onChange={(event) => onDraftTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={isResolved ? 'Thread is resolved' : 'Write a reply...'}
          disabled={isResolved}
          rows={3}
          className="w-full resize-none rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleResolved}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {isResolved ? 'Reopen' : 'Resolve'}
        </button>
        <button
          type="button"
          data-testid="comment-submit-button"
          onClick={onSubmit}
          disabled={isResolved || draftText.trim().length === 0}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}
