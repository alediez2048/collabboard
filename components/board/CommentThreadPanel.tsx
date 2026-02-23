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
      className="absolute z-30 w-[min(22rem,calc(100vw-2rem))] rounded-lg border-2 border-black bg-white p-3 shadow-[6px_6px_0px_#000]"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-black">Comment thread</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-transparent text-black hover:border-black hover:bg-[var(--nb-bg)]"
          aria-label="Close comment thread"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="rounded-md border-2 border-black bg-[var(--nb-accent-blue)] px-2 py-2 text-xs font-bold text-black">
            Add the first message to start this thread.
          </p>
        ) : (
          messages.map((message) => (
            <article key={message.id} className="rounded-md border-2 border-black p-2" style={{ background: 'var(--nb-bg)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-black">{message.authorName}</span>
                <span className="text-[11px] font-medium text-[var(--nb-text-muted)]">{formatMessageTimestamp(message.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-black">{message.text}</p>
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
          className="nb-input w-full resize-none px-2 py-2 text-sm text-black disabled:cursor-not-allowed disabled:bg-[var(--nb-bg)] disabled:text-[var(--nb-text-muted)]"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleResolved}
          className="nb-btn inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase text-black bg-white"
        >
          {isResolved ? 'Reopen' : 'Resolve'}
        </button>
        <button
          type="button"
          data-testid="comment-submit-button"
          onClick={onSubmit}
          disabled={isResolved || draftText.trim().length === 0}
          className="nb-btn inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-blue)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}
