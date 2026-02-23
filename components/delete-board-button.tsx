'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface DeleteBoardButtonProps {
  boardId: string;
  boardName: string;
}

export function DeleteBoardButton({ boardId, boardName }: DeleteBoardButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Failed to delete board');
      }

      setIsConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete board');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmDialog = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setErrorMessage(null);
    setIsConfirmOpen(true);
  };

  const closeConfirmDialog = (): void => {
    if (loading) return;
    setIsConfirmOpen(false);
    setErrorMessage(null);
  };

  return (
    <>
      <button
        onClick={openConfirmDialog}
        disabled={loading}
        title="Delete board"
        data-testid={`delete-board-${boardId}`}
        className="opacity-70 group-hover:opacity-100 transition-opacity p-1.5 rounded-md border-2 border-transparent text-black hover:text-black hover:bg-[var(--nb-accent-red)] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Delete board"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        )}
      </button>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={`Delete "${boardName}"?`}
        description="This cannot be undone."
        confirmLabel={loading ? 'Deleting...' : 'Delete board'}
        isLoading={loading}
        errorMessage={errorMessage}
        onConfirm={handleDelete}
        onCancel={closeConfirmDialog}
        confirmButtonTestId="confirm-delete-board"
        cancelButtonTestId="cancel-delete-board"
      />
    </>
  );
}
