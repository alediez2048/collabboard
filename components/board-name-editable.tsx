'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BoardNameEditableProps {
  boardId: string;
  initialName: string;
}

interface RenameBoardResponse {
  board?: {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
  };
  error?: string;
}

const MAX_BOARD_NAME_LENGTH = 100;

function validateBoardName(rawName: string): string | null {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    return 'Board name cannot be empty.';
  }
  if (trimmed.length > MAX_BOARD_NAME_LENGTH) {
    return 'Board name must be 100 characters or fewer.';
  }
  return null;
}

export function BoardNameEditable({ boardId, initialName }: BoardNameEditableProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentName, setCurrentName] = useState(initialName);
  const [draftName, setDraftName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setCurrentName(initialName);
      setDraftName(initialName);
    }
  }, [initialName, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraftName(currentName);
    setErrorMessage(null);
    setIsEditing(true);
  };

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditing(false);
    setDraftName(currentName);
    setErrorMessage(null);
  };

  const handleSave = async (
    event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>,
  ): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();

    const validationError = validateBoardName(draftName);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const nextName = draftName.trim();
    if (nextName === currentName) {
      setIsEditing(false);
      setErrorMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: nextName }),
      });

      const payload = (await response.json().catch(() => ({}))) as RenameBoardResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to rename board');
      }

      setCurrentName(payload.board?.name ?? nextName);
      setDraftName(payload.board?.name ?? nextName);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to rename board');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): Promise<void> => {
    if (event.key === 'Enter') {
      await handleSave(event);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsEditing(false);
      setDraftName(currentName);
      setErrorMessage(null);
    }
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        data-testid={`board-name-display-${boardId}`}
        onClick={handleStartEditing}
        className="text-left w-full group"
      >
        <span className="block text-xl font-bold text-black mb-2 pr-8 break-words">
          {currentName}
        </span>
        <span className="text-xs font-medium text-[var(--nb-text-muted)] group-hover:text-black transition-colors">
          Click to rename
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`board-name-input-${boardId}`} className="sr-only">
        Board name
      </label>
      <input
        ref={inputRef}
        id={`board-name-input-${boardId}`}
        data-testid={`board-name-input-${boardId}`}
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onKeyDown={handleInputKeyDown}
        disabled={isSaving}
        maxLength={MAX_BOARD_NAME_LENGTH}
        className="nb-input w-full px-3 py-2 text-sm text-black disabled:bg-[var(--nb-bg)]"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Save board name"
          onClick={handleSave}
          disabled={isSaving}
          className="nb-btn inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-green)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="nb-btn inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase text-black bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <span className="ml-auto text-xs font-medium text-[var(--nb-text-muted)]">
          {draftName.trim().length}/{MAX_BOARD_NAME_LENGTH}
        </span>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs font-bold text-black">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
