import type { BoardObject } from '@/lib/yjs/board-doc';

const MAX_OBJECTS = 50;

export interface BoardStateViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardStateScopeContext {
  command?: string;
  type?: string;
  color?: string;
  textContains?: string;
  selectedObjectIds?: string[];
  viewport?: BoardStateViewport;
}

export interface ScopedBoardState {
  totalObjects: number;
  returnedCount: number;
  objects: BoardObject[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toObjectTypeToken(type: BoardObject['type'] | string): string {
  return normalize(type).replace(/[\s-]+/g, '_');
}

function getObjectText(object: BoardObject): string {
  const maybeText = object.properties.text;
  const maybeTitle = object.properties.title;
  const text =
    typeof maybeText === 'string'
      ? maybeText
      : typeof maybeTitle === 'string'
        ? maybeTitle
        : '';
  return normalize(text);
}

function getObjectColor(object: BoardObject): string {
  const candidateKeys = ['color', 'fillColor', 'strokeColor'] as const;
  for (const key of candidateKeys) {
    const value = object.properties[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return normalize(value);
    }
  }
  return '';
}

function intersectsViewport(object: BoardObject, viewport: BoardStateViewport): boolean {
  const right = object.x + object.width;
  const bottom = object.y + object.height;
  const viewportRight = viewport.x + viewport.width;
  const viewportBottom = viewport.y + viewport.height;

  return (
    object.x < viewportRight
    && right > viewport.x
    && object.y < viewportBottom
    && bottom > viewport.y
  );
}

function distanceToViewportCenter(object: BoardObject, viewport: BoardStateViewport): number {
  const objectCenterX = object.x + (object.width / 2);
  const objectCenterY = object.y + (object.height / 2);
  const viewportCenterX = viewport.x + (viewport.width / 2);
  const viewportCenterY = viewport.y + (viewport.height / 2);

  const dx = objectCenterX - viewportCenterX;
  const dy = objectCenterY - viewportCenterY;
  return Math.hypot(dx, dy);
}

function tokenizeCommand(command: string): string[] {
  return normalize(command)
    .split(/[^a-z0-9_#]+/g)
    .filter((token) => token.length >= 3);
}

function hasHardFilters(context: BoardStateScopeContext | undefined): boolean {
  if (!context) return false;
  return (
    typeof context.type === 'string'
    || typeof context.color === 'string'
    || typeof context.textContains === 'string'
  );
}

function matchesHardFilters(object: BoardObject, context: BoardStateScopeContext | undefined): boolean {
  if (!context) return true;

  if (typeof context.type === 'string' && context.type.trim().length > 0) {
    if (toObjectTypeToken(object.type) !== toObjectTypeToken(context.type)) {
      return false;
    }
  }

  if (typeof context.color === 'string' && context.color.trim().length > 0) {
    if (getObjectColor(object) !== normalize(context.color)) {
      return false;
    }
  }

  if (typeof context.textContains === 'string' && context.textContains.trim().length > 0) {
    if (!getObjectText(object).includes(normalize(context.textContains))) {
      return false;
    }
  }

  return true;
}

function computeRelevanceScore(
  object: BoardObject,
  context: BoardStateScopeContext | undefined,
  selectedIds: Set<string>,
  commandTokens: string[],
): number {
  let score = 0;

  if (selectedIds.has(object.id)) {
    score += 2000;
  }

  if (context?.viewport) {
    if (intersectsViewport(object, context.viewport)) {
      score += 700;
    } else {
      const distance = distanceToViewportCenter(object, context.viewport);
      // Penalize far-away objects while still allowing them when no better matches exist.
      score -= Math.min(600, distance / 10);
    }
  }

  if (typeof context?.type === 'string' && context.type.trim().length > 0) {
    score += 300;
  }
  if (typeof context?.color === 'string' && context.color.trim().length > 0) {
    score += 250;
  }
  if (typeof context?.textContains === 'string' && context.textContains.trim().length > 0) {
    score += 250;
  }

  const objectText = getObjectText(object);
  const objectType = toObjectTypeToken(object.type);
  const objectColor = getObjectColor(object);

  for (const token of commandTokens) {
    if (objectText.includes(token)) {
      score += 40;
    }
    if (objectType.includes(token)) {
      score += 20;
    }
    if (objectColor.includes(token)) {
      score += 20;
    }
  }

  const updatedAtMs = Date.parse(object.updatedAt);
  if (Number.isFinite(updatedAtMs)) {
    score += Math.max(0, updatedAtMs / 1_000_000_000_000);
  }

  return score;
}

/**
 * Scope a set of board objects for AI consumption.
 * Hard cap: never return more than 50 objects per plan constraint.
 * Includes summary fields totalObjects and returnedCount.
 */
export function scopeObjects(
  allObjects: BoardObject[],
  context?: BoardStateScopeContext,
): ScopedBoardState {
  const totalObjects = allObjects.length;
  const selectedIds = new Set((context?.selectedObjectIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0));
  const commandTokens = context?.command ? tokenizeCommand(context.command) : [];

  const hardFiltered = allObjects.filter((object) => matchesHardFilters(object, context));

  if (hardFiltered.length === 0 && hasHardFilters(context)) {
    return {
      totalObjects,
      returnedCount: 0,
      objects: [],
    };
  }

  const candidateObjects = hardFiltered.length > 0 ? hardFiltered : allObjects;

  const scored = candidateObjects.map((object, index) => ({
    object,
    index,
    score: computeRelevanceScore(object, context, selectedIds, commandTokens),
  }));

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return left.index - right.index;
  });

  const scoped = scored.slice(0, MAX_OBJECTS).map((item) => item.object);

  return {
    totalObjects,
    returnedCount: scoped.length,
    objects: scoped,
  };
}
