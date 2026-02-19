export interface LayoutObjectInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutPosition {
  objectId: string;
  x: number;
  y: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GridLayoutOptions {
  columns: number;
  startX?: number;
  startY?: number;
  horizontalGap?: number;
  verticalGap?: number;
}

interface EvenSpacingOptions {
  fallbackGap?: number;
}

interface EmptyOriginOptions {
  startX?: number;
  startY?: number;
  step?: number;
  maxColumns?: number;
  maxRows?: number;
  padding?: number;
}

export function computeGridLayout(
  objects: LayoutObjectInput[],
  options: GridLayoutOptions,
): LayoutPosition[] {
  if (objects.length === 0) {
    return [];
  }

  const columns = Math.max(1, Math.floor(options.columns));
  const startX = options.startX ?? 120;
  const startY = options.startY ?? 120;
  const horizontalGap = options.horizontalGap ?? 40;
  const verticalGap = options.verticalGap ?? 40;

  const maxWidth = Math.max(...objects.map((item) => item.width));
  const maxHeight = Math.max(...objects.map((item) => item.height));
  const cellWidth = maxWidth + horizontalGap;
  const cellHeight = maxHeight + verticalGap;

  return objects.map((item, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;

    return {
      objectId: item.id,
      x: startX + (column * cellWidth),
      y: startY + (row * cellHeight),
    };
  });
}

export function computeEvenHorizontalSpacing(
  objects: LayoutObjectInput[],
  options: EvenSpacingOptions = {},
): LayoutPosition[] {
  if (objects.length <= 1) {
    return objects.map((item) => ({ objectId: item.id, x: item.x, y: item.y }));
  }

  const fallbackGap = options.fallbackGap ?? 40;
  const sorted = [...objects].sort((a, b) => a.x - b.x);
  const totalWidth = sorted.reduce((sum, item) => sum + item.width, 0);
  const leftEdge = sorted[0]?.x ?? 0;
  const rightEdge = Math.max(...sorted.map((item) => item.x + item.width));
  const freeSpace = rightEdge - leftEdge - totalWidth;
  const gap = freeSpace >= 0 ? freeSpace / (sorted.length - 1) : fallbackGap;

  let cursorX = leftEdge;
  return sorted.map((item) => {
    const positioned = {
      objectId: item.id,
      x: cursorX,
      y: item.y,
    };
    cursorX += item.width + gap;
    return positioned;
  });
}

export function rectanglesOverlap(a: LayoutRect, b: LayoutRect, padding = 0): boolean {
  return !(
    a.x + a.width + padding <= b.x
    || b.x + b.width + padding <= a.x
    || a.y + a.height + padding <= b.y
    || b.y + b.height + padding <= a.y
  );
}

function intersectsAny(candidate: LayoutRect, occupied: LayoutRect[], padding: number): boolean {
  return occupied.some((rect) => rectanglesOverlap(candidate, rect, padding));
}

export function findNonOverlappingOrigin(
  occupied: LayoutRect[],
  layoutSize: { width: number; height: number },
  options: EmptyOriginOptions = {},
): { x: number; y: number } {
  const startX = options.startX ?? 120;
  const startY = options.startY ?? 120;
  const step = options.step ?? 40;
  const maxColumns = options.maxColumns ?? 40;
  const maxRows = options.maxRows ?? 40;
  const padding = options.padding ?? 24;

  for (let row = 0; row < maxRows; row += 1) {
    for (let column = 0; column < maxColumns; column += 1) {
      const candidate = {
        x: startX + (column * step),
        y: startY + (row * step),
        width: layoutSize.width,
        height: layoutSize.height,
      };
      if (!intersectsAny(candidate, occupied, padding)) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return { x: startX, y: startY };
}
