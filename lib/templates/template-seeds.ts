import { computeGridLayout, type LayoutRect } from '@/lib/ai-agent/layout';

export type TemplateId = 'kanban' | 'swot' | 'brainstorm' | 'retrospective';

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
    id: 'brainstorm',
    title: 'Brainstorm',
    description: 'Start with a large idea space and ready-to-edit prompts.',
    boardName: 'Brainstorm Session',
  },
  {
    id: 'retrospective',
    title: 'Retrospective',
    description: 'Capture wins, issues, and follow-up action items.',
    boardName: 'Retrospective',
  },
] as const;

const TEMPLATE_IDS = new Set<TemplateId>(TEMPLATE_CATALOG.map((template) => template.id));

export function isTemplateId(value: string): value is TemplateId {
  return TEMPLATE_IDS.has(value as TemplateId);
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

function buildBrainstormTemplateDefinitions(): TemplateSeedDefinition[] {
  const frameWidth = 960;
  const frameHeight = 760;
  const promptNotes = [
    'Crazy idea',
    'Small experiment',
    'Customer pain point',
    'Feature concept',
    'Automation idea',
    'Cost-saving idea',
    'Growth idea',
    'Support improvement',
    'Onboarding boost',
    'Retention lever',
    'Quality improvement',
    'Wild card',
  ];

  const gridPositions = computeGridLayout(
    promptNotes.map((_, index) => ({
      id: `brainstorm-note-${index + 1}`,
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    })),
    {
      columns: 4,
      startX: 24,
      startY: 72,
      horizontalGap: 20,
      verticalGap: 20,
    },
  );

  const stickyDefinitions: TemplateSeedDefinition[] = gridPositions.map((position, index) => ({
    tool: 'createStickyNote',
    args: {
      text: promptNotes[index] ?? `Idea ${index + 1}`,
      color: '#ffeb3b',
    },
    footprint: {
      x: position.x,
      y: position.y,
      width: 200,
      height: 200,
    },
  }));

  return [
    {
      tool: 'createFrame',
      args: {
        title: 'Brainstorm',
        width: frameWidth,
        height: frameHeight,
      },
      footprint: {
        x: 0,
        y: 0,
        width: frameWidth,
        height: frameHeight,
      },
    },
    ...stickyDefinitions,
  ];
}

export function buildTemplateSeedDefinitions(templateId: TemplateId): TemplateSeedDefinition[] {
  switch (templateId) {
    case 'kanban':
      return buildKanbanTemplateDefinitions();
    case 'swot':
      return buildSwotTemplateDefinitions();
    case 'brainstorm':
      return buildBrainstormTemplateDefinitions();
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
