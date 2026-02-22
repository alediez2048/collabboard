import * as Y from 'yjs';

export type BoardObjectType =
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'freehand_stroke'
  | 'connector'
  | 'frame'
  | 'text';

export interface BoardObject {
  id: string;
  type: BoardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  properties: Record<string, unknown>;
  createdBy: string;
  updatedAt: string;
}

export interface BoardDoc {
  doc: Y.Doc;
  objects: Y.Map<BoardObject>;
}

export interface ObjectPositionUpdate {
  id: string;
  x: number;
  y: number;
}

/**
 * Create a new Yjs document for a board.
 * The document contains a Y.Map named "objects" that stores all board objects.
 * 
 * @returns An object containing the Y.Doc and the objects Y.Map
 */
export function createBoardDoc(): BoardDoc {
  const doc = new Y.Doc();
  const objects = doc.getMap<BoardObject>('objects');

  return { doc, objects };
}

/**
 * Helper to add an object to the board
 */
export function addObject(
  objects: Y.Map<BoardObject>,
  object: BoardObject
): void {
  objects.set(object.id, object);
}

/**
 * Helper to update an object on the board
 */
export function updateObject(
  objects: Y.Map<BoardObject>,
  objectId: string,
  updates: Partial<BoardObject>
): void {
  const existing = objects.get(objectId);
  if (existing) {
    objects.set(objectId, {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Apply many position updates with one shared timestamp.
 * Returns the number of objects that were updated.
 */
export function updateObjectPositions(
  objects: Y.Map<BoardObject>,
  updates: ReadonlyArray<ObjectPositionUpdate>,
  updatedAt = new Date().toISOString(),
): number {
  let updatedCount = 0;

  for (const update of updates) {
    const existing = objects.get(update.id);
    if (!existing) continue;

    objects.set(update.id, {
      ...existing,
      x: update.x,
      y: update.y,
      updatedAt,
    });
    updatedCount += 1;
  }

  return updatedCount;
}

/**
 * Helper to remove an object from the board
 */
export function removeObject(
  objects: Y.Map<BoardObject>,
  objectId: string
): void {
  objects.delete(objectId);
}

/**
 * Helper to get all objects from the board
 */
export function getAllObjects(objects: Y.Map<BoardObject>): BoardObject[] {
  const result: BoardObject[] = [];
  objects.forEach((value) => {
    result.push(value);
  });
  return result;
}

/**
 * Apply a set of changed object IDs from a Y.Map into an existing array of
 * board objects without rebuilding the full array.
 */
export function applyObjectMapChanges(
  currentObjects: BoardObject[],
  objects: Y.Map<BoardObject>,
  changedKeys: Iterable<string>,
  indexById?: Map<string, number>,
): BoardObject[] {
  const normalizedKeys = Array.from(new Set(changedKeys));
  if (normalizedKeys.length === 0) {
    return currentObjects;
  }

  const nextObjects = currentObjects.slice();
  const mutableIndexById = indexById ?? new Map<string, number>();
  if (!indexById) {
    for (let index = 0; index < nextObjects.length; index += 1) {
      mutableIndexById.set(nextObjects[index].id, index);
    }
  }

  let hasChanges = false;

  for (const key of normalizedKeys) {
    const nextObject = objects.get(key);
    const existingIndex = mutableIndexById.get(key);

    if (nextObject) {
      if (existingIndex === undefined) {
        nextObjects.push(nextObject);
        mutableIndexById.set(key, nextObjects.length - 1);
        hasChanges = true;
      } else if (nextObjects[existingIndex] !== nextObject) {
        nextObjects[existingIndex] = nextObject;
        hasChanges = true;
      }
      continue;
    }

    if (existingIndex === undefined) {
      continue;
    }

    nextObjects.splice(existingIndex, 1);
    mutableIndexById.delete(key);
    for (let index = existingIndex; index < nextObjects.length; index += 1) {
      mutableIndexById.set(nextObjects[index].id, index);
    }
    hasChanges = true;
  }

  return hasChanges ? nextObjects : currentObjects;
}

/**
 * Helper to get a single object by ID
 */
export function getObject(
  objects: Y.Map<BoardObject>,
  objectId: string
): BoardObject | undefined {
  return objects.get(objectId);
}
