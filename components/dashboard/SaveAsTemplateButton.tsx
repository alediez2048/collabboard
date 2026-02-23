'use client';

import { useCallback, useState, useRef, type ReactElement, type KeyboardEvent } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface SaveAsTemplateButtonProps {
  boardId: string;
  boardName: string;
}

export function SaveAsTemplateButton({ boardId, boardName }: SaveAsTemplateButtonProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setName(boardName);
    setDescription('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOpen(true);
    setTimeout(() => nameInputRef.current?.select(), 50);
  }, [boardName]);

  const closeModal = useCallback(() => {
    if (loading) return;
    setIsOpen(false);
  }, [loading]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setErrorMessage('Template name is required');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save template');
      }

      setSuccessMessage('Template saved!');
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage(null);
      }, 1200);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setLoading(false);
    }
  }, [boardId, name, description]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSave();
      }
    },
    [handleSave],
  );

  return (
    <>
      <button
        onClick={openModal}
        title="Save as template"
        data-testid={`save-template-${boardId}`}
        className="opacity-70 group-hover:opacity-100 transition-opacity p-1.5 rounded-md border-2 border-transparent text-black hover:text-black hover:bg-[var(--nb-accent-purple)] hover:border-black"
        aria-label="Save as template"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => {
            if (!loading) closeModal();
          }}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(245, 240, 232, 0.8)' }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Save as template"
            data-testid="save-template-dialog"
            className="relative w-full max-w-md rounded-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-black">Save as Template</h2>
            <p className="mt-1 text-sm font-medium text-[var(--nb-text-muted)]">
              Save this board&apos;s current state as a reusable template.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="template-name" className="block text-xs font-bold uppercase text-black">
                  Template name
                </label>
                <input
                  ref={nameInputRef}
                  id="template-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={100}
                  disabled={loading}
                  className="mt-1 w-full rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:shadow-[3px_3px_0px_#000] disabled:opacity-60"
                  placeholder="My Template"
                />
              </div>
              <div>
                <label htmlFor="template-description" className="block text-xs font-bold uppercase text-black">
                  Description <span className="font-medium normal-case text-[var(--nb-text-muted)]">(optional)</span>
                </label>
                <textarea
                  id="template-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={300}
                  rows={2}
                  disabled={loading}
                  className="mt-1 w-full resize-none rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:shadow-[3px_3px_0px_#000] disabled:opacity-60"
                  placeholder="A short description of what this template contains..."
                />
              </div>
            </div>

            {errorMessage && (
              <p role="alert" className="mt-3 text-xs font-bold text-black bg-[var(--nb-accent-red)] border-2 border-black rounded-md px-2 py-1">
                {errorMessage}
              </p>
            )}
            {successMessage && (
              <p role="status" className="mt-3 text-xs font-bold text-black bg-[var(--nb-accent-green)] border-2 border-black rounded-md px-2 py-1">
                {successMessage}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold text-black bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={loading || !name.trim()}
                data-testid="confirm-save-template"
                className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold text-black bg-[var(--nb-accent-purple)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
