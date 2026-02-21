'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  TEMPLATE_CATALOG,
  type TemplateId,
} from '@/lib/templates/template-seeds';

interface TemplateCreateResponse {
  board?: {
    id: string;
    name: string;
  };
  template?: string;
  error?: string;
}

export function DashboardTemplateGallery(): ReactElement {
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState<TemplateId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateTemplate = async (templateId: TemplateId): Promise<void> => {
    if (loadingTemplate) {
      return;
    }

    setLoadingTemplate(templateId);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/boards/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  return (
    <section
      data-testid="dashboard-template-gallery"
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">Start from Template</h2>
      <p className="mt-1 text-sm text-gray-600">
        Launch a board with a prebuilt structure, then customize it with your team.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TEMPLATE_CATALOG.map((template) => {
          const isLoading = loadingTemplate === template.id;
          return (
            <article
              key={template.id}
              data-testid={`template-card-${template.id}`}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <h3 className="text-sm font-semibold text-gray-900">{template.title}</h3>
              <p className="mt-1 text-xs text-gray-600">{template.description}</p>
              <button
                type="button"
                data-testid={`template-create-${template.id}`}
                onClick={() => {
                  void handleCreateTemplate(template.id);
                }}
                disabled={loadingTemplate !== null}
                className="mt-3 inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Creating...' : 'Use template'}
              </button>
            </article>
          );
        })}
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
