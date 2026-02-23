'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import {
  TEMPLATE_CATALOG,
  type TemplateId,
} from '@/lib/templates/template-seeds';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface TemplateCreateResponse {
  board?: {
    id: string;
    name: string;
  };
  template?: string;
  error?: string;
}

interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  object_count: number;
  created_at: string;
}

interface BoardOption {
  id: string;
  name: string;
}

interface DashboardTemplateGalleryProps {
  boards?: BoardOption[];
}

export function DashboardTemplateGallery({ boards = [] }: DashboardTemplateGalleryProps): ReactElement {
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // "Create your own" modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createBoardId, setCreateBoardId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/templates')
      .then((res) => res.json() as Promise<{ templates?: CustomTemplate[] }>)
      .then((data) => {
        if (!cancelled && Array.isArray(data.templates)) {
          setCustomTemplates(data.templates);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleCreateBuiltIn = async (templateId: TemplateId): Promise<void> => {
    if (loadingTemplate) return;
    setLoadingTemplate(templateId);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/boards/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateId }),
      });
      const payload = (await response.json().catch(() => ({}))) as TemplateCreateResponse;
      if (!response.ok || !payload.board?.id) {
        throw new Error(payload.error ?? 'Failed to create template board');
      }
      router.push(`/board/${payload.board.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create template board');
    } finally {
      setLoadingTemplate(null);
    }
  };

  const handleUseCustom = async (templateId: string): Promise<void> => {
    if (loadingTemplate) return;
    setLoadingTemplate(templateId);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/templates/${templateId}`, { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as TemplateCreateResponse;
      if (!response.ok || !payload.board?.id) {
        throw new Error(payload.error ?? 'Failed to create board from template');
      }
      router.push(`/board/${payload.board.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create board from template');
    } finally {
      setLoadingTemplate(null);
    }
  };

  const handleDeleteCustom = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/templates/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to delete template');
      }
      setCustomTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete template');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget]);

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) setDeleteTarget(null);
  }, [isDeleting]);

  // "Create your own" handlers
  const openCreateModal = useCallback(() => {
    setCreateName('');
    setCreateDescription('');
    setCreateBoardId(boards.length > 0 ? boards[0].id : '');
    setCreateError(null);
    setCreateSuccess(null);
    setIsCreateOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [boards]);

  const closeCreateModal = useCallback(() => {
    if (!isCreating) setIsCreateOpen(false);
  }, [isCreating]);

  const handleSaveCustom = useCallback(async () => {
    if (!createName.trim()) {
      setCreateError('Template name is required');
      return;
    }
    if (!createBoardId) {
      setCreateError('Select a board to save as template');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: createBoardId,
          name: createName.trim(),
          description: createDescription.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        template?: CustomTemplate;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save template');
      }
      if (data.template) {
        setCustomTemplates((prev) => [data.template!, ...prev]);
      }
      setCreateSuccess('Template saved!');
      setTimeout(() => {
        setIsCreateOpen(false);
        setCreateSuccess(null);
      }, 1200);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsCreating(false);
    }
  }, [createName, createDescription, createBoardId]);

  const handleCreateKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSaveCustom();
      }
    },
    [handleSaveCustom],
  );

  return (
    <section
      data-testid="dashboard-template-gallery"
      className="rounded-lg border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000]"
    >
      <h2 className="text-lg font-bold text-black">Start from Template</h2>
      <p className="mt-1 text-sm font-medium text-[var(--nb-text-muted)]">
        Launch a board with a prebuilt structure, then customize it with your team.
      </p>

      {/* Built-in templates + "Create your own" card */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TEMPLATE_CATALOG.map((template) => {
          const isLoading = loadingTemplate === template.id;
          return (
            <article
              key={template.id}
              data-testid={`template-card-${template.id}`}
              className="rounded-lg border-2 border-black bg-white p-3 shadow-[3px_3px_0px_#000]"
            >
              <h3 className="text-sm font-bold text-black">{template.title}</h3>
              <p className="mt-1 text-xs font-medium text-[var(--nb-text-muted)]">{template.description}</p>
              <button
                type="button"
                data-testid={`template-create-${template.id}`}
                onClick={() => { void handleCreateBuiltIn(template.id); }}
                disabled={loadingTemplate !== null}
                className="nb-btn mt-3 inline-flex items-center px-2.5 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-lime)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Creating...' : 'Use template'}
              </button>
            </article>
          );
        })}

        {/* Create your own card */}
        <article
          data-testid="template-card-custom-create"
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-black bg-[var(--nb-bg)] p-3 text-center"
        >
          <svg className="h-8 w-8 text-[var(--nb-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <h3 className="mt-2 text-sm font-bold text-black">Create Your Own</h3>
          <p className="mt-1 text-xs font-medium text-[var(--nb-text-muted)]">
            Save any board as a reusable template.
          </p>
          <button
            type="button"
            data-testid="template-create-custom"
            onClick={openCreateModal}
            disabled={boards.length === 0}
            className="nb-btn mt-3 inline-flex items-center px-2.5 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-purple)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {boards.length === 0 ? 'Create a board first' : 'Create template'}
          </button>
        </article>
      </div>

      {/* Custom templates */}
      {customTemplates.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-bold uppercase text-black">Your Templates</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {customTemplates.map((template) => {
              const isLoading = loadingTemplate === template.id;
              return (
                <article
                  key={template.id}
                  data-testid={`custom-template-card-${template.id}`}
                  className="group relative rounded-lg border-2 border-black bg-[var(--nb-accent-yellow)] p-3 shadow-[3px_3px_0px_#000]"
                >
                  <h3 className="text-sm font-bold text-black">{template.name}</h3>
                  {template.description && (
                    <p className="mt-1 text-xs font-medium text-[var(--nb-text-muted)]">{template.description}</p>
                  )}
                  <p className="mt-1 text-xs font-medium text-[var(--nb-text-muted)]">
                    {template.object_count} object{template.object_count === 1 ? '' : 's'}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { void handleUseCustom(template.id); }}
                      disabled={loadingTemplate !== null}
                      className="nb-btn inline-flex items-center px-2.5 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-lime)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? 'Creating...' : 'Use template'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(template); }}
                      disabled={loadingTemplate !== null}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md border-2 border-transparent text-black hover:bg-[var(--nb-accent-red)] hover:border-black"
                      aria-label={`Delete template "${template.name}"`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {errorMessage && (
        <p role="alert" className="mt-3 text-xs font-bold text-black bg-[var(--nb-accent-red)] border-2 border-black rounded-md px-2 py-1 inline-block">
          {errorMessage}
        </p>
      )}

      {/* Delete template confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="This will permanently remove the template. Boards created from it won't be affected."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete template'}
        isLoading={isDeleting}
        onConfirm={handleDeleteCustom}
        onCancel={closeDeleteDialog}
        confirmButtonTestId="confirm-delete-template"
        cancelButtonTestId="cancel-delete-template"
      />

      {/* "Create your own" modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => { if (!isCreating) closeCreateModal(); }}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(245, 240, 232, 0.8)' }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create custom template"
            data-testid="create-template-dialog"
            className="relative w-full max-w-md rounded-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0px_#000]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-black">Create Custom Template</h2>
            <p className="mt-1 text-sm font-medium text-[var(--nb-text-muted)]">
              Pick an existing board to save as a reusable template.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="ct-board" className="block text-xs font-bold uppercase text-black">
                  Source board
                </label>
                <select
                  id="ct-board"
                  value={createBoardId}
                  onChange={(e) => setCreateBoardId(e.target.value)}
                  disabled={isCreating}
                  className="mt-1 w-full rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:shadow-[3px_3px_0px_#000] disabled:opacity-60"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ct-name" className="block text-xs font-bold uppercase text-black">
                  Template name
                </label>
                <input
                  ref={nameInputRef}
                  id="ct-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  maxLength={100}
                  disabled={isCreating}
                  className="mt-1 w-full rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:shadow-[3px_3px_0px_#000] disabled:opacity-60"
                  placeholder="My Template"
                />
              </div>
              <div>
                <label htmlFor="ct-desc" className="block text-xs font-bold uppercase text-black">
                  Description <span className="font-medium normal-case text-[var(--nb-text-muted)]">(optional)</span>
                </label>
                <textarea
                  id="ct-desc"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  maxLength={300}
                  rows={2}
                  disabled={isCreating}
                  className="mt-1 w-full resize-none rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:shadow-[3px_3px_0px_#000] disabled:opacity-60"
                  placeholder="A short description..."
                />
              </div>
            </div>

            {createError && (
              <p role="alert" className="mt-3 text-xs font-bold text-black bg-[var(--nb-accent-red)] border-2 border-black rounded-md px-2 py-1">
                {createError}
              </p>
            )}
            {createSuccess && (
              <p role="status" className="mt-3 text-xs font-bold text-black bg-[var(--nb-accent-green)] border-2 border-black rounded-md px-2 py-1">
                {createSuccess}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isCreating}
                className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold text-black bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCustom()}
                disabled={isCreating || !createName.trim() || !createBoardId}
                data-testid="confirm-create-template"
                className="nb-btn inline-flex items-center px-3 py-2 text-sm font-bold text-black bg-[var(--nb-accent-purple)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? 'Saving...' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
