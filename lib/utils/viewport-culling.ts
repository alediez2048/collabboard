import type { BoardObject } from '@/lib/yjs/board-doc';

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeBounds(x1: number, y1: number, x2: number, y2: number): ViewportBounds {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

function getObjectCenter(object: BoardObject): Point {
  if (object.type === 'line') {
    const x2 = toFiniteNumber(object.properties.x2, object.x + object.width);
    const y2 = toFiniteNumber(object.properties.y2, object.y + object.height);
    return {
      x: (object.x + x2) / 2,
      y: (object.y + y2) / 2,
    };
  }

  return {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
}

function getObjectBounds(
  object: BoardObject,
  objectLookup: ReadonlyMap<string, BoardObject>,
): ViewportBounds {
  if (object.type === 'line') {
    const x2 = toFiniteNumber(object.properties.x2, object.x + object.width);
    const y2 = toFiniteNumber(object.properties.y2, object.y + object.height);
    return normalizeBounds(object.x, object.y, x2, y2);
  }

  if (object.type === 'connector') {
    const fromId = typeof object.properties.fromId === 'string' ? object.properties.fromId : '';
    const toId = typeof object.properties.toId === 'string' ? object.properties.toId : '';
    const from = objectLookup.get(fromId);
    const to = objectLookup.get(toId);

    if (from && to) {
      const start = getObjectCenter(from);
      const end = getObjectCenter(to);
      return normalizeBounds(start.x, start.y, end.x, end.y);
    }
  }

  return normalizeBounds(
    object.x,
    object.y,
    object.x + object.width,
    object.y + object.height,
  );
}

export function rectanglesOverlap(a: ViewportBounds, b: ViewportBounds): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export function buildObjectLookup(objects: BoardObject[]): Map<string, BoardObject> {
  const lookup = new Map<string, BoardObject>();
  for (const object of objects) {
    lookup.set(object.id, object);
  }
  return lookup;
}

export function computeCanvasViewport(
  dimensions: Size,
  pan: Point,
  zoom: number,
  padding = 0,
): ViewportBounds {
  const safeZoom = zoom > 0 ? zoom : 1;

  return {
    left: -pan.x / safeZoom - padding,
    top: -pan.y / safeZoom - padding,
    right: (dimensions.width - pan.x) / safeZoom + padding,
    bottom: (dimensions.height - pan.y) / safeZoom + padding,
  };
}

export function isObjectVisible(
  object: BoardObject,
  viewport: ViewportBounds,
  objectLookup: ReadonlyMap<string, BoardObject>,
): boolean {
  const objectBounds = getObjectBounds(object, objectLookup);
  return rectanglesOverlap(objectBounds, viewport);
}

export function selectIntersectingObjectIds(
  objects: BoardObject[],
  selectionBounds: ViewportBounds,
): string[] {
  const objectLookup = buildObjectLookup(objects);
  const selectedIds: string[] = [];

  for (const object of objects) {
    if (isObjectVisible(object, selectionBounds, objectLookup)) {
      selectedIds.push(object.id);
    }
  }

  return selectedIds;
}
