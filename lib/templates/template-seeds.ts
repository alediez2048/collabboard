import type { LayoutRect } from '@/lib/ai-agent/layout';

export type TemplateId = 'kanban' | 'swot' | 'lean_canvas' | 'retrospective';

export interface TemplateCatalogItem {
  id: TemplateId;
  title: string;
  description: string;
  boardName: string;
}

export interface TemplateSeedDefinition {
  tool: 'createFrame' | 'createStickyNote';
  args: Record<string, unknown>;
  footprint: LayoutRect;
}

export interface TemplateSeedStep {
  tool: 'createFrame' | 'createStickyNote';
  args: Record<string, unknown>;
}

interface Point {
  x: number;
  y: number;
}

const RETRO_COLUMNS = ['What Went Well', "What Didn't", 'Action Items'] as const;
const SWOT_COLUMNS = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'] as const;
const KANBAN_COLUMNS = ['To Do', 'In Progress', 'Done'] as const;

export const TEMPLATE_CATALOG: readonly TemplateCatalogItem[] = [
  {
    id: 'kanban',
    title: 'Kanban Board',
    description: 'Organize tasks across To Do, In Progress, and Done.',
    boardName: 'Kanban Board',
  },
  {
    id: 'swot',
    title: 'SWOT Analysis',
    description: 'Map strengths, weaknesses, opportunities, and threats.',
    boardName: 'SWOT Analysis',
  },
  {
    id: 'lean_canvas',
    title: 'Lean Canvas',
    description: 'Map your problem, solution, channels, and revenue model.',
    boardName: 'Lean Canvas',
  },
  {
    id: 'retrospective',
    title: 'Retrospective',
    description: 'Capture wins, issues, and follow-up action items.',
    boardName: 'Retrospective',
  },
] as const;

const TEMPLATE_IDS = new Set<TemplateId>(TEMPLATE_CATALOG.map((template) => template.id));
const LEGACY_TEMPLATE_ALIASES: Record<string, TemplateId> = {
  brainstorm: 'lean_canvas',
};

export function isTemplateId(value: string): value is TemplateId {
  return TEMPLATE_IDS.has(value as TemplateId);
}

export function normalizeTemplateId(value: string): TemplateId | null {
  const normalized = value.trim().toLowerCase();
  if (isTemplateId(normalized)) {
    return normalized;
  }

  return LEGACY_TEMPLATE_ALIASES[normalized] ?? null;
}

function withOrigin(definitions: TemplateSeedDefinition[], origin: Point): TemplateSeedStep[] {
  return definitions.map((definition) => ({
    tool: definition.tool,
    args: {
      ...definition.args,
      x: origin.x + definition.footprint.x,
      y: origin.y + definition.footprint.y,
    },
  }));
}

function buildSwotTemplateDefinitions(): TemplateSeedDefinition[] {
  const frameWidth = 320;
  const frameHeight = 300;
  const gapX = 40;
  const gapY = 40;
  const headerColors = ['#bfdbfe', '#fecaca', '#d9f99d', '#f5d0fe'] as const;

  return SWOT_COLUMNS.flatMap((title, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const frameX = column * (frameWidth + gapX);
    const frameY = row * (frameHeight + gapY);

    return [
      {
        tool: 'createFrame' as const,
        args: {
          title,
          width: frameWidth,
          height: frameHeight,
        },
        footprint: {
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: title,
          color: headerColors[index],
        },
        footprint: {
          x: frameX + 16,
          y: frameY + 16,
          width: 200,
          height: 200,
        },
      },
    ];
  });
}

function buildRetrospectiveTemplateDefinitions(): TemplateSeedDefinition[] {
  const columnWidth = 320;
  const columnHeight = 440;
  const gap = 40;
  const headerColors = ['#86efac', '#fca5a5', '#93c5fd'] as const;

  return RETRO_COLUMNS.flatMap((title, index) => {
    const x = index * (columnWidth + gap);
    const y = 0;
    return [
      {
        tool: 'createFrame' as const,
        args: {
          title,
          width: columnWidth,
          height: columnHeight,
        },
        footprint: {
          x,
          y,
          width: columnWidth,
          height: columnHeight,
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: title,
          color: headerColors[index % headerColors.length],
        },
        footprint: {
          x: x + 16,
          y: y + 16,
          width: 200,
          height: 200,
        },
      },
    ];
  });
}

function buildKanbanTemplateDefinitions(): TemplateSeedDefinition[] {
  const columnWidth = 320;
  const columnHeight = 700;
  const gap = 40;
  const headerColors = ['#bfdbfe', '#fde68a', '#bbf7d0'] as const;
  const seedCardColor = '#ffeb3b';

  return KANBAN_COLUMNS.flatMap((title, columnIndex) => {
    const x = columnIndex * (columnWidth + gap);
    const y = 0;

    return [
      {
        tool: 'createFrame' as const,
        args: {
          title,
          width: columnWidth,
          height: columnHeight,
        },
        footprint: {
          x,
          y,
          width: columnWidth,
          height: columnHeight,
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: title,
          color: headerColors[columnIndex],
        },
        footprint: {
          x: x + 16,
          y: y + 16,
          width: 200,
          height: 200,
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: `${title} task 1`,
          color: seedCardColor,
        },
        footprint: {
          x: x + 16,
          y: y + 240,
          width: 200,
          height: 200,
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: `${title} task 2`,
          color: seedCardColor,
        },
        footprint: {
          x: x + 16,
          y: y + 460,
          width: 200,
          height: 200,
        },
      },
    ];
  });
}

function buildLeanCanvasTemplateDefinitions(): TemplateSeedDefinition[] {
  const gap = 24;
  const leftColumnWidth = 280;
  const splitColumnWidth = 300;
  const centerColumnWidth = 320;
  const rightSplitColumnWidth = 300;
  const rightColumnWidth = 280;
  const topHalfHeight = 308;
  const topSectionHeight = (topHalfHeight * 2) + gap;
  const bottomSectionHeight = 240;

  const xProblem = 0;
  const xSolution = xProblem + leftColumnWidth + gap;
  const xUniqueValue = xSolution + splitColumnWidth + gap;
  const xUnfairAdvantage = xUniqueValue + centerColumnWidth + gap;
  const xCustomerSegments = xUnfairAdvantage + rightSplitColumnWidth + gap;

  const yTop = 0;
  const yLowerTop = topHalfHeight + gap;
  const yBottom = topSectionHeight + gap;

  const totalWidth = xCustomerSegments + rightColumnWidth;
  const bottomLeftWidth = Math.floor((totalWidth - gap) / 2);
  const bottomRightWidth = totalWidth - gap - bottomLeftWidth;
  const xRevenueStreams = bottomLeftWidth + gap;

  const section = (
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    stickyText: string,
  ): TemplateSeedDefinition[] => [
    {
      tool: 'createFrame',
      args: {
        title,
        width,
        height,
      },
      footprint: {
        x,
        y,
        width,
        height,
      },
    },
    {
      tool: 'createStickyNote',
      args: {
        text: stickyText,
        color: '#ffeb3b',
      },
      footprint: {
        x: x + 16,
        y: y + 16,
        width: 200,
        height: 200,
      },
    },
  ];

  return [
    ...section('Problem', xProblem, yTop, leftColumnWidth, topHalfHeight, 'Top 3 problems'),
    ...section('Existing Alternatives', xProblem, yLowerTop, leftColumnWidth, topHalfHeight, 'Current alternatives'),
    ...section('Solution', xSolution, yTop, splitColumnWidth, topHalfHeight, 'Proposed solution'),
    ...section('Key Metrics', xSolution, yLowerTop, splitColumnWidth, topHalfHeight, 'Key metrics'),
    ...section(
      'Unique Value Proposition',
      xUniqueValue,
      yTop,
      centerColumnWidth,
      topSectionHeight,
      'High-Level Concept',
    ),
    ...section('Unfair Advantage', xUnfairAdvantage, yTop, rightSplitColumnWidth, topHalfHeight, 'Unfair advantage'),
    ...section('Channels', xUnfairAdvantage, yLowerTop, rightSplitColumnWidth, topHalfHeight, 'Primary channels'),
    ...section('Customer Segments', xCustomerSegments, yTop, rightColumnWidth, topHalfHeight, 'Target customers'),
    ...section('Early Adopters', xCustomerSegments, yLowerTop, rightColumnWidth, topHalfHeight, 'Early adopters'),
    ...section('Cost Structure', xProblem, yBottom, bottomLeftWidth, bottomSectionHeight, 'Major costs'),
    ...section('Revenue Streams', xRevenueStreams, yBottom, bottomRightWidth, bottomSectionHeight, 'Revenue sources'),
  ];
}

export function buildTemplateSeedDefinitions(templateId: TemplateId): TemplateSeedDefinition[] {
  switch (templateId) {
    case 'kanban':
      return buildKanbanTemplateDefinitions();
    case 'swot':
      return buildSwotTemplateDefinitions();
    case 'lean_canvas':
      return buildLeanCanvasTemplateDefinitions();
    case 'retrospective':
      return buildRetrospectiveTemplateDefinitions();
  }
}

export function buildTemplateSeedSteps(templateId: TemplateId, origin: Point = { x: 120, y: 120 }): TemplateSeedStep[] {
  return withOrigin(buildTemplateSeedDefinitions(templateId), origin);
}

export function getTemplateCatalogItem(templateId: TemplateId): TemplateCatalogItem {
  const match = TEMPLATE_CATALOG.find((item) => item.id === templateId);
  if (!match) {
    throw new Error(`Unknown template id: ${templateId}`);
  }
  return match;
}
