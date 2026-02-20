import type { ReactElement, ReactNode } from 'react';

interface DashboardShellProps {
  sidebar: ReactNode;
  topStrip: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ sidebar, topStrip, children }: DashboardShellProps): ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div>{sidebar}</div>
          <main className="space-y-4" data-testid="dashboard-main-content">
            {topStrip}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
