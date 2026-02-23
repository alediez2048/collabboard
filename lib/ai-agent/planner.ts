import {
  computeEvenHorizontalSpacing,
  computeGridLayout,
  findNonOverlappingOrigin,
  type LayoutObjectInput,
  type LayoutRect,
} from '@/lib/ai-agent/layout';
import type { ScopedBoardState } from '@/lib/ai-agent/scoped-state';
import {
  buildTemplateSeedDefinitions,
  type TemplateId,
  type TemplateSeedDefinition,
} from '@/lib/templates/template-seeds';

export interface PlannedToolStep {
  tool: string;
  args: Record<string, unknown>;
}

export interface KanbanColumnPlan {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KanbanStickyPlacement {
  objectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KanbanVerificationSpec {
  type: 'kanban-layout';
  tolerancePx: number;
  columns: KanbanColumnPlan[];
  stickyPlacements: KanbanStickyPlacement[];
}

export interface ColorMovePlacement {
  objectId: string;
  x: number;
  y: number;
}

export interface ColorMoveVerificationSpec {
  type: 'color-move-group';
  tolerancePx: number;
  color: string;
  placements: ColorMovePlacement[];
}

export type PlanVerificationSpec = KanbanVerificationSpec | ColorMoveVerificationSpec;

export interface ComplexCommandPlan {
  requiresBoardState: boolean;
  steps: PlannedToolStep[];
  verification?: PlanVerificationSpec;
}

export interface PlanVerificationResult {
  passed: boolean;
  correctiveSteps: PlannedToolStep[];
  issues: string[];
}

const STAGE_COLORS = ['#60a5fa', '#a3e635', '#c084fc', '#fb923c', '#f472b6'] as const;
const MAX_BULK_STICKY_NOTES = 5000;
const MIN_BULK_STICKY_NOTES_FAST_PATH = 10;
const DEFAULT_KANBAN_COLUMNS = ['To Do', 'In Progress', 'Done'] as const;
const KANBAN_COLUMN_WIDTH = 320;
const KANBAN_COLUMN_GAP = 40;
const KANBAN_COLUMN_PADDING = 16;
const KANBAN_STICKY_GAP = 16;
const KANBAN_DEFAULT_STICKY_WIDTH = 180;
const KANBAN_DEFAULT_STICKY_HEIGHT = 120;

const COLOR_NAME_TO_HEX: Record<string, string> = {
  red: '#f87171',
  blue: '#60a5fa',
  green: '#a3e635',
  purple: '#c084fc',
  orange: '#fb923c',
  yellow: '#ffeb3b',
  pink: '#ec4899',
};

interface BulkStickyGenerationIntent {
  count: number;
  color: string;
}

interface BulkLineGenerationIntent {
  count: number;
  color: string;
}

interface KanbanIntent {
  columnTitles: string[];
  shouldArrangeExistingStickies: boolean;
  shouldResizeStickies: boolean;
}

interface ColorMoveIntent {
  color: string;
  direction: 'left' | 'right';
}

const NUMBER_WORD_VALUES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function parseNumberWords(tokens: string[]): number | null {
  let current = 0;
  let hasNumberWord = false;

  for (const token of tokens) {
    if (token === 'and') continue;

    if (token === 'hundred') {
      if (current === 0) {
        current = 100;
      } else {
        current *= 100;
      }
      hasNumberWord = true;
      continue;
    }

    const value = NUMBER_WORD_VALUES[token];
    if (value === undefined) {
      break;
    }

    current += value;
    hasNumberWord = true;
  }

  if (!hasNumberWord || current <= 0) return null;
  return current;
}

function parseCountFromPhrase(phrase: string): number | null {
  const digitMatch = phrase.match(/\b(\d{1,4})\b/);
  if (digitMatch) {
    const parsed = Number.parseInt(digitMatch[1] ?? '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const tokens = phrase.toLowerCase().match(/[a-z]+/g) ?? [];
  for (let start = 0; start < tokens.length; start += 1) {
    const candidate: string[] = [];
    for (let end = start; end < tokens.length; end += 1) {
      const token = tokens[end];
      if (token === 'and' || token === 'hundred' || token in NUMBER_WORD_VALUES) {
        candidate.push(token);
        continue;
      }
      break;
    }

    if (candidate.length === 0) continue;
    const parsed = parseNumberWords(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
}

function parseBulkStickyGenerationIntent(command: string): BulkStickyGenerationIntent | null {
  const normalized = command.trim().toLowerCase();
  const hasActionVerb = /\b(create|generate|add|make)\b/.test(normalized);
  if (!hasActionVerb) {
    return null;
  }

  const quantityPhraseBeforeSticky = normalized.match(
    /(?:create|generate|add|make)\s+(.+?)\s+(?:sticky\s*notes?|stickies|notes?)\b/,
  );
  const quantityPhraseBeforeObjects = normalized.match(
    /(?:create|generate|add|make)\s+(.+?)\s+objects?\b/,
  );
  const quantityPhraseBeforeOnes = normalized.match(
    /(?:create|generate|add|make)\s+(.+?)\s+ones?\b/,
  );

  const parsedCount =
    (quantityPhraseBeforeSticky?.[1] ? parseCountFromPhrase(quantityPhraseBeforeSticky[1]) : null)
    ?? (quantityPhraseBeforeObjects?.[1] ? parseCountFromPhrase(quantityPhraseBeforeObjects[1]) : null)
    ?? (quantityPhraseBeforeOnes?.[1] ? parseCountFromPhrase(quantityPhraseBeforeOnes[1]) : null)
    ?? parseCountFromPhrase(normalized);

  if (!parsedCount || parsedCount < MIN_BULK_STICKY_NOTES_FAST_PATH) {
    return null;
  }

  const hasStickyTarget = /\b(sticky\s*notes?|stickies|notes?)\b/.test(normalized);
  const hasGenericObjectTarget = /\bobjects?\b/.test(normalized);
  const hasOnesTarget = /\bones?\b/.test(normalized);
  const hasExplicitShapeTarget = /\b(shape|shapes|rectangle|rectangles|circle|circles|line|lines|arrow|arrows|frame|frames|connector|connectors)\b/.test(normalized);
  const hasStickyLikeTarget = hasStickyTarget || hasGenericObjectTarget || hasOnesTarget;

  // Ambiguous high-count commands like "create 1000" default to sticky notes,
  // but explicit shape/connectors should not be reinterpreted as sticky intent.
  if (!hasStickyLikeTarget && hasExplicitShapeTarget) {
    return null;
  }

  const namedColor = Object.keys(COLOR_NAME_TO_HEX).find((name) => normalized.includes(name));

  return {
    count: Math.min(parsedCount, MAX_BULK_STICKY_NOTES),
    color: namedColor ? COLOR_NAME_TO_HEX[namedColor] : '#ffeb3b',
  };
}

function planBulkStickyGeneration(intent: BulkStickyGenerationIntent): ComplexCommandPlan {
  const columns = Math.ceil(Math.sqrt(intent.count));
  const positions = computeGridLayout(
    Array.from({ length: intent.count }, (_, index) => ({
      id: `bulk-note-${index + 1}`,
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    })),
    {
      columns,
      startX: 120,
      startY: 120,
      horizontalGap: 40,
      verticalGap: 40,
    },
  );

  return {
    requiresBoardState: false,
    steps: positions.map((position, index) => ({
      tool: 'createStickyNote',
      args: {
        text: `Item ${index + 1}`,
        x: position.x,
        y: position.y,
        color: intent.color,
      },
    })),
  };
}

function parseBulkLineGenerationIntent(command: string): BulkLineGenerationIntent | null {
  const normalized = command.trim().toLowerCase();
  const hasActionVerb = /\b(create|generate|add|make)\b/.test(normalized);
  const hasLineTarget = /\b(lines?|arrows?)\b/.test(normalized);
  if (!hasActionVerb || !hasLineTarget) {
    return null;
  }

  const quantityPhrase = normalized.match(
    /(?:create|generate|add|make)\s+(.+?)\s+(?:lines?|arrows?)\b/,
  );
  const parsedCount =
    (quantityPhrase?.[1] ? parseCountFromPhrase(quantityPhrase[1]) : null)
    ?? parseCountFromPhrase(normalized);

  if (!parsedCount || parsedCount < MIN_BULK_STICKY_NOTES_FAST_PATH) {
    return null;
  }

  const namedColor = Object.keys(COLOR_NAME_TO_HEX).find((name) => normalized.includes(name));
  return {
    count: Math.min(parsedCount, MAX_BULK_STICKY_NOTES),
    color: namedColor ? COLOR_NAME_TO_HEX[namedColor] : '#1d4ed8',
  };
}

function planBulkLineGeneration(intent: BulkLineGenerationIntent): ComplexCommandPlan {
  const columns = Math.ceil(Math.sqrt(intent.count));
  const positions = computeGridLayout(
    Array.from({ length: intent.count }, (_, index) => ({
      id: `bulk-line-${index + 1}`,
      x: 0,
      y: 0,
      width: 220,
      height: 120,
    })),
    {
      columns,
      startX: 120,
      startY: 120,
      horizontalGap: 40,
      verticalGap: 40,
    },
  );

  return {
    requiresBoardState: false,
    steps: positions.map((position) => ({
      tool: 'createShape',
      args: {
        type: 'line',
        x: position.x,
        y: position.y,
        width: 220,
        height: 120,
        color: intent.color,
      },
    })),
  };
}

function parseKanbanIntent(command: string): KanbanIntent | null {
  const normalized = command.trim().toLowerCase();
  const hasSetupVerb = /\b(create|build|set\s*up|setup|make|add|generate|draw)\b/.test(normalized);
  const referencesKanban =
    normalized.includes('kanban')
    || /\bsprint\s+board\b/.test(normalized)
    || /\bspringboards?\b/.test(normalized)
    || /\btask\s+board\b/.test(normalized)
    || /\bproject\s+board\b/.test(normalized);

  if (!referencesKanban || !hasSetupVerb) {
    return null;
  }

  const shouldResizeStickies = /\bresize\b.*\bsticky\s*notes?\b/.test(normalized);
  const shouldArrangeExistingStickies =
    shouldResizeStickies
    || /\b(sticky\s*notes?|stickies)\b/.test(normalized)
    || /\binside\b/.test(normalized)
    || /\bwithin\b/.test(normalized)
    || /\bfit\b/.test(normalized);

  return {
    columnTitles: [...DEFAULT_KANBAN_COLUMNS],
    shouldArrangeExistingStickies,
    shouldResizeStickies,
  };
}

function buildKanbanPlan(
  intent: KanbanIntent,
  boardState?: ScopedBoardState,
): ComplexCommandPlan {
  if (!boardState) {
    return { requiresBoardState: true, steps: [] };
  }

  const stickyNotes = boardState.objects.filter((object) => object.type === 'sticky_note');
  const columnCount = intent.columnTitles.length;
  const shouldArrange = intent.shouldArrangeExistingStickies && stickyNotes.length > 0;

  const targetStickyWidth = intent.shouldResizeStickies ? KANBAN_DEFAULT_STICKY_WIDTH : null;
  const targetStickyHeight = intent.shouldResizeStickies ? KANBAN_DEFAULT_STICKY_HEIGHT : null;
  const stickyHeightForLayout = targetStickyHeight ?? Math.max(...stickyNotes.map((note) => note.height), 200);

  const rowsPerColumn = shouldArrange ? Math.ceil(stickyNotes.length / columnCount) : 3;
  const frameHeight = Math.max(
    440,
    56 + (rowsPerColumn * stickyHeightForLayout) + (Math.max(rowsPerColumn - 1, 0) * KANBAN_STICKY_GAP) + 32,
  );

  const frameTemplate: TemplateSeedDefinition[] = intent.columnTitles.map((title, index) => ({
    tool: 'createFrame',
    args: {
      title,
      width: KANBAN_COLUMN_WIDTH,
      height: frameHeight,
    },
    footprint: {
      x: index * (KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP),
      y: 0,
      width: KANBAN_COLUMN_WIDTH,
      height: frameHeight,
    },
  }));

  const frameSteps = placeTemplate(frameTemplate, boardState);
  const columns: KanbanColumnPlan[] = frameSteps.map((step, index) => ({
    title: String(step.args.title ?? intent.columnTitles[index] ?? `Column ${index + 1}`),
    x: Number(step.args.x ?? 0),
    y: Number(step.args.y ?? 0),
    width: Number(step.args.width ?? KANBAN_COLUMN_WIDTH),
    height: Number(step.args.height ?? frameHeight),
  }));

  if (!shouldArrange) {
    return planNamedTemplate('kanban', boardState);
  }

  const orderedStickies = [...stickyNotes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  const stickyPlacements: KanbanStickyPlacement[] = [];
  const stickySteps: PlannedToolStep[] = [];

  for (let index = 0; index < orderedStickies.length; index += 1) {
    const sticky = orderedStickies[index];
    const columnIndex = index % columnCount;
    const rowIndex = Math.floor(index / columnCount);
    const column = columns[columnIndex];
    const width = targetStickyWidth ?? sticky.width;
    const height = targetStickyHeight ?? sticky.height;
    const x = column.x + KANBAN_COLUMN_PADDING;
    const y = column.y + 56 + (rowIndex * (height + KANBAN_STICKY_GAP));

    stickyPlacements.push({ objectId: sticky.id, x, y, width, height });

    if (targetStickyWidth !== null && targetStickyHeight !== null) {
      stickySteps.push({
        tool: 'resizeObject',
        args: {
          objectId: sticky.id,
          width: targetStickyWidth,
          height: targetStickyHeight,
        },
      });
    }

    stickySteps.push({
      tool: 'moveObject',
      args: {
        objectId: sticky.id,
        x,
        y,
      },
    });
  }

  return {
    requiresBoardState: false,
    steps: [...frameSteps, ...stickySteps],
    verification: {
      type: 'kanban-layout',
      tolerancePx: 8,
      columns,
      stickyPlacements,
    },
  };
}

function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}

function extractObjectColorHex(object: ScopedBoardState['objects'][number]): string {
  const keys = ['color', 'fillColor', 'strokeColor'] as const;
  for (const key of keys) {
    const value = object.properties[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return normalizeColor(value);
    }
  }
  return '';
}

function resolveColorHexFromCommand(normalizedCommand: string): string | null {
  const hexMatch = normalizedCommand.match(/#[0-9a-f]{6}\b/i);
  if (hexMatch?.[0]) {
    return normalizeColor(hexMatch[0]);
  }

  for (const [name, hex] of Object.entries(COLOR_NAME_TO_HEX)) {
    if (normalizedCommand.includes(name)) {
      return normalizeColor(hex);
    }
  }

  return null;
}

function parseColorMoveIntent(command: string): ColorMoveIntent | null {
  const normalized = command.trim().toLowerCase();
  const hasMoveVerb = /\b(move|shift|reposition)\b/.test(normalized);
  const hasStickyTarget = /\b(sticky\s*notes?|stickies|notes?)\b/.test(normalized);
  const hasGroupScope = /\b(all|every)\b/.test(normalized);
  const direction = normalized.includes('right') ? 'right' : normalized.includes('left') ? 'left' : null;
  const color = resolveColorHexFromCommand(normalized);

  if (!hasMoveVerb || !hasStickyTarget || !hasGroupScope || !direction || !color) {
    return null;
  }

  return { color, direction };
}

function buildColorMovePlan(intent: ColorMoveIntent, boardState?: ScopedBoardState): ComplexCommandPlan {
  if (!boardState) {
    return { requiresBoardState: true, steps: [] };
  }

  const stickyNotes = boardState.objects.filter(
    (object) => object.type === 'sticky_note' && extractObjectColorHex(object) === normalizeColor(intent.color),
  );
  if (stickyNotes.length === 0) {
    return { requiresBoardState: false, steps: [] };
  }

  const ordered = [...stickyNotes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  const boardMinX = Math.min(...boardState.objects.map((object) => object.x), 120);
  const boardMaxX = Math.max(
    ...boardState.objects.map((object) => object.x + object.width),
    1200,
  );
  const targetX = intent.direction === 'right'
    ? Math.max(1200, boardMaxX + 120)
    : Math.min(120, boardMinX - 120);
  const baseY = Math.min(...ordered.map((note) => note.y));

  const placements: ColorMovePlacement[] = ordered.map((note, index) => {
    const nextY = baseY + (index * (Math.max(note.height, 120) + 16));
    return {
      objectId: note.id,
      x: targetX,
      y: nextY,
    };
  });

  return {
    requiresBoardState: false,
    steps: placements.map((placement) => ({
      tool: 'moveObject',
      args: {
        objectId: placement.objectId,
        x: placement.x,
        y: placement.y,
      },
    })),
    verification: {
      type: 'color-move-group',
      tolerancePx: 8,
      color: intent.color,
      placements,
    },
  };
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

function toOccupiedRects(state: ScopedBoardState): LayoutRect[] {
  return state.objects.map((object) => ({
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  }));
}

function templateSize(items: TemplateSeedDefinition[]): { width: number; height: number } {
  if (items.length === 0) {
    return { width: 0, height: 0 };
  }

  const maxRight = Math.max(...items.map((item) => item.footprint.x + item.footprint.width));
  const maxBottom = Math.max(...items.map((item) => item.footprint.y + item.footprint.height));
  return { width: maxRight, height: maxBottom };
}

function placeTemplate(items: TemplateSeedDefinition[], state: ScopedBoardState): PlannedToolStep[] {
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

function planNamedTemplate(
  templateId: Extract<TemplateId, 'kanban' | 'swot' | 'retrospective' | 'lean_canvas' | 'roadmap' | 'eisenhower'>,
  boardState?: ScopedBoardState,
): ComplexCommandPlan {
  if (!boardState) {
    return { requiresBoardState: true, steps: [] };
  }

  return {
    requiresBoardState: false,
    steps: placeTemplate(buildTemplateSeedDefinitions(templateId), boardState),
  };
}

function buildUserJourneyTemplate(stageCount: number): TemplateSeedDefinition[] {
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

  const template: TemplateSeedDefinition[] = positions.map((position, index) => {
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

function rectContains(
  container: LayoutRect,
  item: LayoutRect,
  tolerancePx: number,
): boolean {
  return (
    item.x >= container.x - tolerancePx
    && item.y >= container.y - tolerancePx
    && item.x + item.width <= container.x + container.width + tolerancePx
    && item.y + item.height <= container.y + container.height + tolerancePx
  );
}

function verifyKanbanLayout(
  verification: KanbanVerificationSpec,
  boardState: ScopedBoardState,
): PlanVerificationResult {
  const correctiveSteps: PlannedToolStep[] = [];
  const issues: string[] = [];
  const byId = new Map(boardState.objects.map((object) => [object.id, object]));
  const frameByTitle = new Map(
    boardState.objects
      .filter((object) => object.type === 'frame')
      .map((frame) => [String(frame.properties.title ?? '').trim().toLowerCase(), frame]),
  );

  for (const column of verification.columns) {
    const key = column.title.trim().toLowerCase();
    if (frameByTitle.has(key)) continue;

    issues.push(`Missing expected Kanban column frame "${column.title}"`);
    correctiveSteps.push({
      tool: 'createFrame',
      args: {
        title: column.title,
        x: column.x,
        y: column.y,
        width: column.width,
        height: column.height,
      },
    });
  }

  for (const placement of verification.stickyPlacements) {
    const sticky = byId.get(placement.objectId);
    if (!sticky || sticky.type !== 'sticky_note') {
      issues.push(`Missing sticky note ${placement.objectId} for Kanban placement`);
      continue;
    }

    const stickyRect: LayoutRect = {
      x: sticky.x,
      y: sticky.y,
      width: sticky.width,
      height: sticky.height,
    };
    const isInsideAnyColumn = verification.columns.some((column) =>
      rectContains(
        {
          x: column.x,
          y: column.y,
          width: column.width,
          height: column.height,
        },
        stickyRect,
        verification.tolerancePx,
      ),
    );
    const shouldResize =
      Math.abs(sticky.width - placement.width) > 0.5
      || Math.abs(sticky.height - placement.height) > 0.5;
    const shouldMove =
      !isInsideAnyColumn
      || Math.abs(sticky.x - placement.x) > verification.tolerancePx
      || Math.abs(sticky.y - placement.y) > verification.tolerancePx;

    if (shouldResize) {
      issues.push(`Sticky ${sticky.id} size mismatch (${sticky.width}x${sticky.height})`);
      correctiveSteps.push({
        tool: 'resizeObject',
        args: {
          objectId: sticky.id,
          width: placement.width,
          height: placement.height,
        },
      });
    }

    if (shouldMove) {
      issues.push(`Sticky ${sticky.id} position mismatch (${sticky.x},${sticky.y})`);
      correctiveSteps.push({
        tool: 'moveObject',
        args: {
          objectId: sticky.id,
          x: placement.x,
          y: placement.y,
        },
      });
    }
  }

  return {
    passed: issues.length === 0,
    correctiveSteps,
    issues,
  };
}

function verifyColorMoveGroup(
  verification: ColorMoveVerificationSpec,
  boardState: ScopedBoardState,
): PlanVerificationResult {
  const correctiveSteps: PlannedToolStep[] = [];
  const issues: string[] = [];
  const byId = new Map(boardState.objects.map((object) => [object.id, object]));
  const expectedColor = normalizeColor(verification.color);

  for (const placement of verification.placements) {
    const object = byId.get(placement.objectId);
    if (!object || object.type !== 'sticky_note') {
      issues.push(`Missing sticky note ${placement.objectId} for color-group move`);
      continue;
    }

    const currentColor = extractObjectColorHex(object);
    if (currentColor !== expectedColor) {
      issues.push(`Sticky ${object.id} color drifted to ${currentColor || 'unknown'}`);
      correctiveSteps.push({
        tool: 'changeColor',
        args: {
          objectId: object.id,
          color: verification.color,
        },
      });
    }

    const shouldMove =
      Math.abs(object.x - placement.x) > verification.tolerancePx
      || Math.abs(object.y - placement.y) > verification.tolerancePx;
    if (shouldMove) {
      issues.push(`Sticky ${object.id} position mismatch (${object.x},${object.y})`);
      correctiveSteps.push({
        tool: 'moveObject',
        args: {
          objectId: object.id,
          x: placement.x,
          y: placement.y,
        },
      });
    }
  }

  return {
    passed: issues.length === 0,
    correctiveSteps,
    issues,
  };
}

export function verifyPlanExecution(
  plan: ComplexCommandPlan,
  boardState: ScopedBoardState,
): PlanVerificationResult {
  if (!plan.verification) {
    return {
      passed: true,
      correctiveSteps: [],
      issues: [],
    };
  }

  if (plan.verification.type === 'kanban-layout') {
    return verifyKanbanLayout(plan.verification, boardState);
  }

  if (plan.verification.type === 'color-move-group') {
    return verifyColorMoveGroup(plan.verification, boardState);
  }

  return {
    passed: true,
    correctiveSteps: [],
    issues: [],
  };
}

export function planComplexCommand(command: string, boardState?: ScopedBoardState): ComplexCommandPlan | null {
  const normalized = command.trim().toLowerCase();
  const kanbanIntent = parseKanbanIntent(command);
  if (kanbanIntent) {
    return buildKanbanPlan(kanbanIntent, boardState);
  }

  const colorMoveIntent = parseColorMoveIntent(command);
  if (colorMoveIntent) {
    return buildColorMovePlan(colorMoveIntent, boardState);
  }

  const bulkLineIntent = parseBulkLineGenerationIntent(command);
  if (bulkLineIntent) {
    return planBulkLineGeneration(bulkLineIntent);
  }

  const bulkStickyIntent = parseBulkStickyGenerationIntent(command);

  if (bulkStickyIntent) {
    return planBulkStickyGeneration(bulkStickyIntent);
  }

  if (
    /\bswot\b/.test(normalized)
    && /\b(create|build|set\s*up|setup|make|add|generate|draw)\b/.test(normalized)
  ) {
    return planNamedTemplate('swot', boardState);
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

  if (
    /\bretro(spective)?\b/.test(normalized)
    && (/\b(create|build|set\s*up|setup|make|add|generate|draw|board|template)\b/.test(normalized))
  ) {
    return planNamedTemplate('retrospective', boardState);
  }

  if (
    normalized.includes('lean canvas')
    || normalized.includes('lean-canvas')
    || normalized.includes('brainstorm board')
    || normalized.includes('brainstorm template')
    || /\b(create|build|add|make|generate)\b.*\bbrainstorm\b/.test(normalized)
    || /\bbusiness\s*model\s*canvas\b/.test(normalized)
  ) {
    return planNamedTemplate('lean_canvas', boardState);
  }

  if (
    /\broadmap\b/.test(normalized)
    && /\b(create|build|set\s*up|setup|make|add|generate|draw|template|board)\b/.test(normalized)
  ) {
    return planNamedTemplate('roadmap', boardState);
  }

  if (
    /\beisenhower\b/.test(normalized)
    || (/\bpriority\s*(matrix|grid)\b/.test(normalized)
      && /\b(create|build|set\s*up|setup|make|add|generate|draw)\b/.test(normalized))
    || (/\burgent\b/.test(normalized) && /\bimportant\b/.test(normalized)
      && /\b(matrix|grid|quadrant|template|board)\b/.test(normalized))
  ) {
    return planNamedTemplate('eisenhower', boardState);
  }

  if (
    /\b(mind\s*map|brainstorm\s*map|idea\s*map|concept\s*map)\b/.test(normalized)
    && /\b(create|build|set\s*up|setup|make|add|generate|draw)\b/.test(normalized)
  ) {
    if (!boardState) {
      return { requiresBoardState: true, steps: [] };
    }
    const centerX = 400;
    const centerY = 400;
    const branchColors = ['#60a5fa', '#a3e635', '#c084fc', '#fb923c', '#f472b6', '#fde68a'] as const;
    const branchLabels = ['Branch 1', 'Branch 2', 'Branch 3', 'Branch 4', 'Branch 5', 'Branch 6'];
    const angleStep = (2 * Math.PI) / branchLabels.length;
    const radius = 300;

    const template: TemplateSeedDefinition[] = [
      {
        tool: 'createStickyNote',
        args: { text: 'Central Topic', color: '#ffeb3b' },
        footprint: { x: centerX - 100, y: centerY - 100, width: 200, height: 200 },
      },
      ...branchLabels.map((label, index) => ({
        tool: 'createStickyNote' as const,
        args: { text: label, color: branchColors[index % branchColors.length] },
        footprint: {
          x: centerX - 100 + Math.round(Math.cos(angleStep * index - Math.PI / 2) * radius),
          y: centerY - 100 + Math.round(Math.sin(angleStep * index - Math.PI / 2) * radius),
          width: 200,
          height: 200,
        },
      })),
    ];

    return {
      requiresBoardState: false,
      steps: placeTemplate(template, boardState),
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
