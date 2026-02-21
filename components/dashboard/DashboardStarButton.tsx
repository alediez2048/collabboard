'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

interface ToggleStarResponse {
  state?: {
    is_starred: boolean;
  };
  error?: string;
}

interface DashboardStarButtonProps {
  boardId: string;
  initialIsStarred: boolean;
}

export function DashboardStarButton({
  boardId,
  initialIsStarred,
}: DashboardStarButtonProps): ReactElement {
  const router = useRouter();
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [initialIsStarred]);

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();

    if (isSaving) {
      return;
    }

    const nextIsStarred = !isStarred;
    setIsStarred(nextIsStarred);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/boards/${boardId}/star`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isStarred: nextIsStarred }),
      });

      const payload = (await response.json().catch(() => ({}))) as ToggleStarResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update star state');
      }

      setIsStarred(payload.state?.is_starred ?? nextIsStarred);
      router.refresh();
    } catch (error) {
      setIsStarred(!nextIsStarred);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update star state');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isSaving}
        aria-pressed={isStarred}
        aria-label={isStarred ? 'Unstar board' : 'Star board'}
        data-testid={`toggle-star-${boardId}`}
        className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isStarred ? 'Starred' : 'Star'}
      </button>
      {errorMessage && (
        <span role="alert" className="max-w-24 text-right text-[10px] text-red-600">
          Failed to save
        </span>
      )}
    </div>
  );
}
