'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import {
  buildDashboardHref,
  isDashboardViewMode,
  type DashboardSection,
  type DashboardViewMode,
} from '@/lib/dashboard/navigation';

interface DashboardViewToggleProps {
  activeSection: DashboardSection;
  searchQuery: string;
  viewMode: DashboardViewMode;
  hasExplicitViewModeParam: boolean;
}

export const DASHBOARD_VIEW_MODE_STORAGE_KEY = 'collabboard.dashboard.view-mode';

export function DashboardViewToggle({
  activeSection,
  searchQuery,
  viewMode,
  hasExplicitViewModeParam,
}: DashboardViewToggleProps): ReactElement {
  const router = useRouter();

  useEffect(() => {
    const storedValue = window.localStorage.getItem(DASHBOARD_VIEW_MODE_STORAGE_KEY);

    if (
      !hasExplicitViewModeParam
      && storedValue
      && isDashboardViewMode(storedValue)
      && storedValue !== viewMode
    ) {
      router.replace(
        buildDashboardHref({
          section: activeSection,
          searchQuery,
          viewMode: storedValue,
        }),
      );
      return;
    }

    window.localStorage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [activeSection, hasExplicitViewModeParam, router, searchQuery, viewMode]);

  const handleSelect = (nextMode: DashboardViewMode): void => {
    if (nextMode === viewMode) {
      return;
    }

    window.localStorage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, nextMode);
    router.push(
      buildDashboardHref({
        section: activeSection,
        searchQuery,
        viewMode: nextMode,
      }),
    );
  };

  return (
    <div
      data-testid="dashboard-view-controls"
      className="inline-flex items-center rounded-lg border-2 border-black bg-white p-1 shadow-[3px_3px_0px_#000]"
      aria-label="Board view mode"
    >
      {(['grid', 'list'] as const).map((mode) => {
        const selected = mode === viewMode;
        return (
          <button
            key={mode}
            type="button"
            data-testid={`dashboard-view-${mode}`}
            aria-pressed={selected}
            onClick={() => {
              handleSelect(mode);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-colors ${
              selected
                ? 'bg-[var(--nb-accent-blue)] text-black border-2 border-black'
                : 'text-black hover:bg-[var(--nb-bg)] border-2 border-transparent'
            }`}
          >
            {mode === 'grid' ? 'Grid' : 'List'}
          </button>
        );
      })}
    </div>
  );
}
