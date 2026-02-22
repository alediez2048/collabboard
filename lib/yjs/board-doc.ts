import * as Y from 'yjs';

export type BoardObjectType =
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'freehand_stroke'
  | 'connector'
  | 'frame'
  | 'text'
  | 'comment_thread'
  | 'comment_message';

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

export type CommentThreadStatus = 'open' | 'resolved';

export interface CommentReplyInput {
  threadId: string;
  messageId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt?: string;
}

export interface CommentMessage {
  id: string;
  threadId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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
 * Remove every object from the board.
 * Returns the number of deleted objects.
 */
export function clearAllObjects(objects: Y.Map<BoardObject>): number {
  const keys = Array.from(objects.keys());
  for (const key of keys) {
    objects.delete(key);
  }
  return keys.length;
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

function parseCommentStatus(value: unknown): CommentThreadStatus {
  return value === 'resolved' ? 'resolved' : 'open';
}

function getThreadStatus(object: BoardObject): CommentThreadStatus {
  return parseCommentStatus(object.properties.status);
}

/**
 * Append a reply to a comment thread by adding a standalone comment_message object.
 * This keeps concurrent replies conflict-safe because each reply has its own Y.Map key.
 */
export function addCommentReply(
  objects: Y.Map<BoardObject>,
  input: CommentReplyInput,
): BoardObject | undefined {
  const thread = objects.get(input.threadId);
  if (!thread || thread.type !== 'comment_thread') {
    return undefined;
  }
  if (getThreadStatus(thread) === 'resolved') {
    return undefined;
  }

  const trimmedText = input.text.trim();
  if (trimmedText.length === 0) {
    return undefined;
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const replyObject: BoardObject = {
    id: input.messageId,
    type: 'comment_message',
    x: thread.x,
    y: thread.y,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: thread.zIndex,
    properties: {
      threadId: input.threadId,
      text: trimmedText,
      authorId: input.authorId,
      authorName: input.authorName,
      createdAt,
    },
    createdBy: input.authorId,
    updatedAt: createdAt,
  };

  objects.set(replyObject.id, replyObject);
  updateObject(objects, input.threadId, {
    updatedAt: createdAt,
  });
  return replyObject;
}

export function getCommentThreadMessages(
  objects: Y.Map<BoardObject>,
  threadId: string,
): CommentMessage[] {
  const messages: CommentMessage[] = [];

  objects.forEach((object) => {
    if (object.type !== 'comment_message') return;

    const objectThreadId =
      typeof object.properties.threadId === 'string'
        ? object.properties.threadId
        : '';
    if (objectThreadId !== threadId) return;

    const text = typeof object.properties.text === 'string' ? object.properties.text : '';
    const authorId =
      typeof object.properties.authorId === 'string'
        ? object.properties.authorId
        : object.createdBy;
    const authorName =
      typeof object.properties.authorName === 'string'
        ? object.properties.authorName
        : 'Anonymous';
    const createdAt =
      typeof object.properties.createdAt === 'string'
        ? object.properties.createdAt
        : object.updatedAt;

    messages.push({
      id: object.id,
      threadId: objectThreadId,
      text,
      authorId,
      authorName,
      createdAt,
    });
  });

  messages.sort((a, b) => {
    const aTime = Date.parse(a.createdAt);
    const bTime = Date.parse(b.createdAt);
    const aFinite = Number.isFinite(aTime);
    const bFinite = Number.isFinite(bTime);
    if (aFinite && bFinite && aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });

  return messages;
}

export function setCommentThreadResolved(
  objects: Y.Map<BoardObject>,
  threadId: string,
  resolved: boolean,
): boolean {
  const thread = objects.get(threadId);
  if (!thread || thread.type !== 'comment_thread') {
    return false;
  }

  const nowIso = new Date().toISOString();
  const nextStatus = resolved ? 'resolved' : 'open';
  const nextProperties: Record<string, unknown> = {
    ...thread.properties,
    status: nextStatus,
  };

  if (resolved) {
    nextProperties.resolvedAt = nowIso;
  } else {
    delete nextProperties.resolvedAt;
  }

  objects.set(threadId, {
    ...thread,
    properties: nextProperties,
    updatedAt: nowIso,
  });
  return true;
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
