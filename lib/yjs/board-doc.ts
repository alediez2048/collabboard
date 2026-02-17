import * as Y from 'yjs';

export type BoardObjectType =
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'line'
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
 * Helper to get a single object by ID
 */
export function getObject(
  objects: Y.Map<BoardObject>,
  objectId: string
): BoardObject | undefined {
  return objects.get(objectId);
}
