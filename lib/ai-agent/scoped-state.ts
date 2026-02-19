import type { BoardObject } from '@/lib/yjs/board-doc';

const MAX_OBJECTS = 50;

export interface ScopedBoardState {
  totalObjects: number;
  returnedCount: number;
  objects: BoardObject[];
}

/**
 * Scope a set of board objects for AI consumption.
 * Hard cap: never return more than 50 objects per plan constraint.
 * Includes summary fields totalObjects and returnedCount.
 */
export function scopeObjects(
  allObjects: BoardObject[],
): ScopedBoardState {
  const totalObjects = allObjects.length;
  const scoped = allObjects.slice(0, MAX_OBJECTS);

  return {
    totalObjects,
    returnedCount: scoped.length,
    objects: scoped,
  };
}
