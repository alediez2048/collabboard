import {
  computeEvenHorizontalSpacing,
  computeGridLayout,
  findNonOverlappingOrigin,
  type LayoutObjectInput,
  type LayoutRect,
} from '@/lib/ai-agent/layout';
import type { ScopedBoardState } from '@/lib/ai-agent/scoped-state';

export interface PlannedToolStep {
  tool: string;
  args: Record<string, unknown>;
}

export interface ComplexCommandPlan {
  requiresBoardState: boolean;
  steps: PlannedToolStep[];
}

const RETRO_COLUMNS = ['What Went Well', "What Didn't", 'Action Items'] as const;
const SWOT_COLUMNS = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'] as const;
const STAGE_COLORS = ['#60a5fa', '#a3e635', '#c084fc', '#fb923c', '#f472b6'] as const;

interface TemplateStepDefinition {
  tool: 'createFrame' | 'createStickyNote';
  args: Record<string, unknown>;
  footprint: LayoutRect;
}

function parseJourneyStageCount(command: string): number {
  const match = command.match(/with\s+(\d+)\s+stages?/i);
  if (!match) {
    return 5;
  }

  const parsed = Number.parseInt(match[1] ?? '5', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5;
  }

  return Math.min(parsed, 10);
}

function planColumnsFrameLayout(titles: readonly string[], startX: number, startY: number): PlannedToolStep[] {
  const columnWidth = 320;
  const columnHeight = 440;
  const gap = 40;

  return titles.map((title, index) => ({
    tool: 'createFrame',
    args: {
      title,
      x: startX + (index * (columnWidth + gap)),
      y: startY,
      width: columnWidth,
      height: columnHeight,
    },
  }));
}

function toOccupiedRects(state: ScopedBoardState): LayoutRect[] {
  return state.objects.map((object) => ({
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  }));
}

function templateSize(items: TemplateStepDefinition[]): { width: number; height: number } {
  if (items.length === 0) {
    return { width: 0, height: 0 };
  }

  const maxRight = Math.max(...items.map((item) => item.footprint.x + item.footprint.width));
  const maxBottom = Math.max(...items.map((item) => item.footprint.y + item.footprint.height));
  return { width: maxRight, height: maxBottom };
}

function placeTemplate(items: TemplateStepDefinition[], state: ScopedBoardState): PlannedToolStep[] {
  const origin = findNonOverlappingOrigin(
    toOccupiedRects(state),
    templateSize(items),
    { startX: 120, startY: 120, step: 40, maxColumns: 60, maxRows: 60, padding: 24 },
  );

  return items.map((item) => ({
    tool: item.tool,
    args: {
      ...item.args,
      x: origin.x + item.footprint.x,
      y: origin.y + item.footprint.y,
    },
  }));
}

function buildSwotTemplate(): TemplateStepDefinition[] {
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

function buildUserJourneyTemplate(stageCount: number): TemplateStepDefinition[] {
  const columnWidth = 240;
  const gap = 20;
  const detailColor = '#fde68a';

  return Array.from({ length: stageCount }, (_, index) => {
    const x = index * (columnWidth + gap);
    const headerColor = STAGE_COLORS[index % STAGE_COLORS.length];
    return [
      {
        tool: 'createStickyNote' as const,
        args: {
          text: `Stage ${index + 1}`,
          color: headerColor,
        },
        footprint: {
          x,
          y: 0,
          width: 200,
          height: 200,
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: `Touchpoints for Stage ${index + 1}`,
          color: detailColor,
        },
        footprint: {
          x,
          y: 240,
          width: 200,
          height: 200,
        },
      },
    ];
  }).flat();
}

function buildRetroTemplate(): TemplateStepDefinition[] {
  const baseSteps = planColumnsFrameLayout(RETRO_COLUMNS, 0, 0);
  const headerColors = ['#86efac', '#fca5a5', '#93c5fd'] as const;

  return baseSteps.flatMap((step, index) => {
    const frameX = Number(step.args.x ?? 0);
    const frameY = Number(step.args.y ?? 0);
    const title = String(step.args.title ?? RETRO_COLUMNS[index] ?? 'Column');
    return [
      {
        tool: 'createFrame' as const,
        args: {
          title,
          width: Number(step.args.width ?? 320),
          height: Number(step.args.height ?? 440),
        },
        footprint: {
          x: frameX,
          y: frameY,
          width: Number(step.args.width ?? 320),
          height: Number(step.args.height ?? 440),
        },
      },
      {
        tool: 'createStickyNote' as const,
        args: {
          text: title,
          color: headerColors[index % headerColors.length],
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

function toLayoutInput(state: ScopedBoardState): LayoutObjectInput[] {
  return state.objects.map((object) => ({
    id: object.id,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  }));
}

function planGridFromExistingNotes(state: ScopedBoardState): ComplexCommandPlan {
  const stickyNotes = state.objects.filter((object) => object.type === 'sticky_note');
  if (stickyNotes.length === 0) {
    return { requiresBoardState: false, steps: [] };
  }

  const items = stickyNotes.map((note) => ({
    id: note.id,
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
  }));

  const columns = Math.ceil(Math.sqrt(items.length));
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const positions = computeGridLayout(items, {
    columns,
    startX: minX,
    startY: minY,
    horizontalGap: 40,
    verticalGap: 40,
  });

  return {
    requiresBoardState: false,
    steps: positions.map((position) => ({
      tool: 'moveObject',
      args: {
        objectId: position.objectId,
        x: position.x,
        y: position.y,
      },
    })),
  };
}

function planEvenSpacing(state: ScopedBoardState): ComplexCommandPlan {
  const items = toLayoutInput(state);
  const positions = computeEvenHorizontalSpacing(items);
  return {
    requiresBoardState: false,
    steps: positions.map((position) => ({
      tool: 'moveObject',
      args: {
        objectId: position.objectId,
        x: position.x,
        y: position.y,
      },
    })),
  };
}

function planProsConsGrid(command: string, state?: ScopedBoardState): ComplexCommandPlan | null {
  const match = command.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) {
    return null;
  }

  if (!state) {
    return { requiresBoardState: true, steps: [] };
  }

  const rows = Math.max(1, Number.parseInt(match[1] ?? '1', 10));
  const columns = Math.max(1, Number.parseInt(match[2] ?? '1', 10));
  const total = Math.min(rows * columns, 24);
  const positions = computeGridLayout(
    Array.from({ length: total }, (_, index) => ({
      id: `planned-note-${index + 1}`,
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    })),
    {
      columns,
      startX: 0,
      startY: 0,
      horizontalGap: 40,
      verticalGap: 40,
    },
  );

  const template: TemplateStepDefinition[] = positions.map((position, index) => {
    const isPro = index < Math.ceil(total / 2);
    const label = isPro ? `Pro ${index + 1}` : `Con ${index - Math.ceil(total / 2) + 1}`;

    return {
      tool: 'createStickyNote',
      args: {
        text: label,
        color: isPro ? '#a3e635' : '#fca5a5',
      },
      footprint: {
        x: position.x,
        y: position.y,
        width: 200,
        height: 200,
      },
    };
  });

  return { requiresBoardState: false, steps: placeTemplate(template, state) };
}

export function planComplexCommand(command: string, boardState?: ScopedBoardState): ComplexCommandPlan | null {
  const normalized = command.trim().toLowerCase();

  if (normalized.includes('create a swot analysis')) {
    if (!boardState) {
      return { requiresBoardState: true, steps: [] };
    }
    return {
      requiresBoardState: false,
      steps: placeTemplate(buildSwotTemplate(), boardState),
    };
  }

  if (normalized.includes('user journey map')) {
    if (!boardState) {
      return { requiresBoardState: true, steps: [] };
    }
    const stageCount = parseJourneyStageCount(command);
    return {
      requiresBoardState: false,
      steps: placeTemplate(buildUserJourneyTemplate(stageCount), boardState),
    };
  }

  if (normalized.includes('retrospective board')) {
    if (!boardState) {
      return { requiresBoardState: true, steps: [] };
    }
    return {
      requiresBoardState: false,
      steps: placeTemplate(buildRetroTemplate(), boardState),
    };
  }

  if (normalized.includes('grid of sticky notes') && normalized.includes('pros and cons')) {
    return planProsConsGrid(command, boardState);
  }

  if (normalized.includes('arrange') && normalized.includes('sticky notes') && normalized.includes('grid')) {
    if (!boardState) {
      return { requiresBoardState: true, steps: [] };
    }
    return planGridFromExistingNotes(boardState);
  }

  if (normalized.includes('space these elements evenly')) {
    if (!boardState) {
      return { requiresBoardState: true, steps: [] };
    }
    return planEvenSpacing(boardState);
  }

  return null;
}
