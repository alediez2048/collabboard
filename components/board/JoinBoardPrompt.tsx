'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JoinBoardPromptProps {
  boardId: string;
}

/**
 * Shown when a user navigates to a board they don't own yet.
 * Lets them join as a collaborator via the shared link.
 */
export function JoinBoardPrompt({ boardId }: JoinBoardPromptProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoin = async (): Promise<void> => {
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/boards/${boardId}/join`, { method: 'POST' });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      // Successfully joined — navigate to the board
      router.push(`/board/${boardId}`);
      router.refresh();
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--nb-bg)' }}>
      <div className="bg-white rounded-lg border-2 border-black shadow-[6px_6px_0px_#000] p-10 max-w-md w-full mx-4 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-[var(--nb-accent-blue)] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-black text-black mb-2">
          You&apos;ve been invited to collaborate
        </h1>
        <p className="font-medium text-[var(--nb-text-muted)] mb-8">
          Someone shared this board with you. Join to start collaborating in real time.
        </p>

        {/* Error message */}
        {status === 'error' && (
          <div className="mb-6 p-3 bg-[var(--nb-accent-red)] border-2 border-black rounded-lg text-sm font-bold text-black">
            {errorMsg}
          </div>
        )}

        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={status === 'loading'}
          className="nb-btn w-full bg-[var(--nb-accent-green)] text-black font-bold uppercase py-3 px-6 disabled:opacity-60"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Joining…
            </span>
          ) : (
            'Join Board'
          )}
        </button>

        {/* Back link */}
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-sm font-bold text-[var(--nb-text-muted)] underline underline-offset-2 hover:text-black transition-colors"
        >
          Back to my boards
        </button>
      </div>
    </div>
  );
}
