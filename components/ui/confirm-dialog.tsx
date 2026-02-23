'use client';

import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmButtonTestId?: string;
  cancelButtonTestId?: string;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  isLoading = false,
  errorMessage = null,
  onConfirm,
  onCancel,
  confirmButtonTestId,
  cancelButtonTestId,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    cancelButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={() => {
        if (!isLoading) {
          onCancel();
        }
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(245, 240, 232, 0.8)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="confirm-dialog"
        className="relative w-full max-w-md rounded-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id={titleId} className="text-lg font-bold text-black">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm font-medium text-[var(--nb-text-muted)]">
          {description}
        </p>

        {errorMessage && (
          <p role="alert" className="mt-3 text-sm font-bold text-black">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            data-testid={cancelButtonTestId}
            onClick={onCancel}
            disabled={isLoading}
            className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold text-black bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid={confirmButtonTestId}
            onClick={onConfirm}
            disabled={isLoading}
            className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold text-black bg-[var(--nb-accent-red)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
