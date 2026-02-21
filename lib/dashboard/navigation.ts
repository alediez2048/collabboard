export const DASHBOARD_SECTIONS = ['home', 'recent', 'starred'] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export interface DashboardSectionMeta {
  title: string;
  description: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
}

const DASHBOARD_SECTION_SET = new Set<DashboardSection>(DASHBOARD_SECTIONS);

const DASHBOARD_SECTION_META: Record<DashboardSection, DashboardSectionMeta> = {
  home: {
    title: 'Home',
    description: 'All boards you can access right now.',
    emptyStateTitle: 'No boards yet',
    emptyStateDescription: 'Create your first board to start collaborating.',
  },
  recent: {
    title: 'Recent',
    description: 'Boards you recently worked on will appear here.',
    emptyStateTitle: 'No recent boards yet',
    emptyStateDescription: 'Open or create a board to build your recent history.',
  },
  starred: {
    title: 'Starred',
    description: 'Pin important boards for quick access.',
    emptyStateTitle: 'No starred boards yet',
    emptyStateDescription: 'Star boards to pin them here for quick access.',
  },
};

function normalizeSectionValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeSearchValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return (value[0] ?? '').trim();
  }

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export function isDashboardSection(value: string): value is DashboardSection {
  return DASHBOARD_SECTION_SET.has(value as DashboardSection);
}

export function parseDashboardSection(value: string | string[] | undefined): DashboardSection {
  const normalized = normalizeSectionValue(value);
  if (!normalized) {
    return 'home';
  }

  return isDashboardSection(normalized) ? normalized : 'home';
}

export function parseDashboardSearchQuery(value: string | string[] | undefined): string {
  return normalizeSearchValue(value);
}

export function getDashboardSectionMeta(section: DashboardSection): DashboardSectionMeta {
  return DASHBOARD_SECTION_META[section];
}
