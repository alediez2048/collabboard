'use client';

import { useState } from 'react';

interface ShareButtonProps {
  boardId: string;
  inline?: boolean;
  className?: string;
}

/**
 * ShareButton — copies the board URL to clipboard so the user can
 * send it to collaborators. When they open the link they'll see
 * the JoinBoardPrompt and can self-onboard.
 */
export function ShareButton({ boardId, inline = false, className = '' }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const setStatusForDuration = (nextStatus: 'success' | 'error', durationMs: number): void => {
    setStatus(nextStatus);
    window.setTimeout(() => setStatus('idle'), durationMs);
  };

  const fallbackCopy = (value: string): boolean => {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      const didCopy = document.execCommand('copy');
      document.body.removeChild(el);
      return didCopy;
    } catch {
      return false;
    }
  };

  const handleCopy = async (): Promise<void> => {
    const url = `${window.location.origin}/board/${boardId}`;

    try {
      if (!navigator.clipboard?.writeText) {
        const didFallbackCopy = fallbackCopy(url);
        if (!didFallbackCopy) {
          setStatusForDuration('error', 3000);
          return;
        }
        setStatusForDuration('success', 2000);
        return;
      }

      await navigator.clipboard.writeText(url);
      setStatusForDuration('success', 2000);
    } catch {
      const didFallbackCopy = fallbackCopy(url);
      setStatusForDuration(didFallbackCopy ? 'success' : 'error', didFallbackCopy ? 2000 : 3000);
    }
  };

  return (
    <button
      data-testid="share-board-button"
      onClick={handleCopy}
      title="Copy shareable link"
      className={`nb-btn flex items-center gap-2 px-3 py-2 text-sm font-bold text-black transition-all ${
        inline
          ? 'bg-white'
          : 'absolute top-4 right-4 z-10 bg-white'
      } ${className}`.trim()}
    >
      {status === 'success' ? (
        <>
          {/* Checkmark icon */}
          <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-black">Copied!</span>
        </>
      ) : status === 'error' ? (
        <>
          <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <span className="text-black">Failed</span>
        </>
      ) : (
        <>
          {/* Share icon */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </>
      )}
    </button>
  );
}
