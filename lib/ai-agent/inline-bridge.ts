/**
 * Inline AI bridge — self-contained Yjs + Supabase persistence layer.
 *
 * Used as a fallback when the external realtime server is unreachable
 * (e.g. production without Railway). Loads a board's Yjs snapshot from
 * Supabase, applies mutations, and saves the snapshot back.
 *
 * When the live WebSocket server IS available the HTTP bridge is preferred
 * because it mutates the in-memory Yjs doc and syncs to connected clients
 * instantly. This inline path writes directly to Supabase — live clients
 * will see the changes on their next page load.
 */

import * as Y from 'yjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { BoardObject } from '@/lib/yjs/board-doc';
import {
  scopeObjects,
  type BoardStateScopeContext,
  type ScopedBoardState,
} from '@/lib/ai-agent/scoped-state';

// ── Types ────────────────────────────────────────────────────────────────────

interface MutateAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface InlineMutateResult {
  success: boolean;
  affectedObjectIds: string[];
  objects?: Array<Record<string, unknown>>;
  error?: string;
}

export interface InlineBatchMutateResult {
  success: boolean;
  results?: Array<{ affectedObjectIds: string[] }>;
  affectedObjectIds?: string[];
  objects?: Array<Record<string, unknown>>;
  failedIndex?: number;
  error?: string;
}

export interface InlineBoardStateResult extends ScopedBoardState {
  error?: string;
}

export interface InlineFindObjectsResult extends ScopedBoardState {
  objectIds: string[];
  error?: string;
}

interface FindObjectsQuery extends BoardStateScopeContext {
  inFrameId?: string;
  nearX?: number;
  nearY?: number;
  maxResults?: number;
}

// ── Supabase client (server-side only) ───────────────────────────────────────

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'Inline bridge requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY',
      );
    }
    serviceClient = createClient(url, key);
  }
  return serviceClient;
}

// ── Snapshot persistence (ported from server/src/persistence.ts) ─────────────

async function loadSnapshot(boardId: string, doc: Y.Doc): Promise<boolean> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('board_snapshots')
    .select('yjs_state')
    .eq('board_id', boardId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false;
    throw error;
  }
  if (!data) return false;

  let stateBuffer: Buffer;
  const raw = data.yjs_state;
  if (typeof raw === 'string') {
    stateBuffer = raw.startsWith('\\x')
      ? Buffer.from(raw.substring(2), 'hex')
      : Buffer.from(raw, 'base64');
  } else {
    stateBuffer = Buffer.from(raw as Buffer);
  }

  try {
    Y.applyUpdate(doc, new Uint8Array(stateBuffer));
  } catch {
    await supabase.from('board_snapshots').delete().eq('board_id', boardId);
    return false;
  }

  return true;
}

async function saveSnapshot(boardId: string, doc: Y.Doc): Promise<void> {
  const supabase = getServiceClient();
  const state = Y.encodeStateAsUpdate(doc);
  const hexState = '\\x' + Buffer.from(state).toString('hex');

  const { error } = await supabase
    .from('board_snapshots')
    .upsert(
      { board_id: boardId, yjs_state: hexState, snapshot_at: new Date().toISOString() },
      { onConflict: 'board_id' },
    );

  if (error) throw error;
}

// ── Yjs helpers ──────────────────────────────────────────────────────────────

function addObject(objects: Y.Map<BoardObject>, object: BoardObject): void {
  objects.set(object.id, object);
}

function updateObject(
  objects: Y.Map<BoardObject>,
  objectId: string,
  updates: Partial<BoardObject>,
): void {
  const existing = objects.get(objectId);
  if (existing) {
    objects.set(objectId, { ...existing, ...updates, updatedAt: new Date().toISOString() });
  }
}

function getAllObjects(objects: Y.Map<BoardObject>): BoardObject[] {
  const result: BoardObject[] = [];
  objects.forEach((v) => result.push(v));
  return result;
}

// ── Mutation engine (ported from server/src/ai-routes.ts) ────────────────────

function applyMutation(
  objects: Y.Map<BoardObject>,
  action: MutateAction,
  userId: string,
  nextZIndex: number,
): { affectedObjectIds: string[]; error?: string; nextZIndex: number } {
  const { tool, args } = action;
  const now = new Date().toISOString();

  switch (tool) {
    case 'createStickyNote': {
      const id = crypto.randomUUID();
      addObject(objects, {
        id,
        type: 'sticky_note',
        x: args.x as number,
        y: args.y as number,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: nextZIndex,
        properties: { text: args.text as string, color: args.color as string },
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id], nextZIndex: nextZIndex + 1 };
    }

    case 'createShape': {
      const id = crypto.randomUUID();
      const shapeType = args.type as string;
      const properties: Record<string, unknown> =
        shapeType === 'line'
          ? {
              strokeColor: args.color as string,
              strokeWidth: 2,
              x2: (args.x as number) + (args.width as number),
              y2: (args.y as number) + (args.height as number),
            }
          : {
              fillColor: args.color as string,
              strokeColor: '#1d4ed8',
              strokeWidth: 2,
            };
      addObject(objects, {
        id,
        type: shapeType as BoardObject['type'],
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        rotation: 0,
        zIndex: nextZIndex,
        properties,
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id], nextZIndex: nextZIndex + 1 };
    }

    case 'createFrame': {
      const id = crypto.randomUUID();
      addObject(objects, {
        id,
        type: 'frame',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        rotation: 0,
        zIndex: 0,
        properties: {
          title: args.title as string,
          fillColor: 'rgba(219,234,254,0.25)',
          strokeColor: '#3b82f6',
        },
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id], nextZIndex: nextZIndex + 1 };
    }

    case 'createConnector': {
      const id = crypto.randomUUID();
      addObject(objects, {
        id,
        type: 'connector',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: nextZIndex,
        properties: {
          fromId: args.fromId as string,
          toId: args.toId as string,
          style: typeof args.style === 'string' ? args.style : 'solid',
          color: '#1d4ed8',
          strokeWidth: 2,
        },
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id], nextZIndex: nextZIndex + 1 };
    }

    case 'moveObject': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found`, nextZIndex };
      updateObject(objects, objectId, { x: args.x as number, y: args.y as number });
      return { affectedObjectIds: [objectId], nextZIndex };
    }

    case 'resizeObject': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found`, nextZIndex };
      updateObject(objects, objectId, { width: args.width as number, height: args.height as number });
      return { affectedObjectIds: [objectId], nextZIndex };
    }

    case 'updateText': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found`, nextZIndex };
      const textKey = obj.type === 'frame' ? 'title' : 'text';
      updateObject(objects, objectId, {
        properties: { ...obj.properties, [textKey]: args.newText as string },
      });
      return { affectedObjectIds: [objectId], nextZIndex };
    }

    case 'changeColor': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found`, nextZIndex };
      const colorKey = obj.type === 'sticky_note' ? 'color' : 'fillColor';
      updateObject(objects, objectId, {
        properties: { ...obj.properties, [colorKey]: args.color as string },
      });
      return { affectedObjectIds: [objectId], nextZIndex };
    }

    default:
      return { affectedObjectIds: [], error: `Unknown tool: ${tool}`, nextZIndex };
  }
}

// ── Exported inline bridge functions ─────────────────────────────────────────

export async function inlineMutate(
  boardId: string,
  userId: string,
  action: MutateAction,
): Promise<InlineMutateResult> {
  const doc = new Y.Doc();
  await loadSnapshot(boardId, doc);
  const objects = doc.getMap<BoardObject>('objects');
  const result = applyMutation(objects, action, userId, objects.size + 1);

  if (result.error) {
    doc.destroy();
    return { success: false, affectedObjectIds: [], error: result.error };
  }

  await saveSnapshot(boardId, doc);
  const createdObjects: Array<Record<string, unknown>> = result.affectedObjectIds
    .map((id) => objects.get(id))
    .filter((obj): obj is BoardObject => obj !== undefined)
    .map((obj) => ({ ...obj }));
  doc.destroy();
  return { success: true, affectedObjectIds: result.affectedObjectIds, objects: createdObjects };
}

export async function inlineMutateBatch(
  boardId: string,
  userId: string,
  actions: MutateAction[],
): Promise<InlineBatchMutateResult> {
  const doc = new Y.Doc();
  await loadSnapshot(boardId, doc);
  const objects = doc.getMap<BoardObject>('objects');
  let nextZIndex = objects.size + 1;
  const results: Array<{ affectedObjectIds: string[] }> = [];
  let failedIndex = -1;
  let failedError: string | undefined;

  doc.transact(() => {
    for (let index = 0; index < actions.length; index += 1) {
      const result = applyMutation(objects, actions[index], userId, nextZIndex);
      nextZIndex = result.nextZIndex;
      if (result.error) {
        failedIndex = index;
        failedError = result.error;
        break;
      }
      results.push({ affectedObjectIds: result.affectedObjectIds });
    }
  });

  if (failedError) {
    doc.destroy();
    return { success: false, results, failedIndex, error: failedError };
  }

  await saveSnapshot(boardId, doc);
  const affectedObjectIds = results.flatMap((r) => r.affectedObjectIds);
  const createdObjects: Array<Record<string, unknown>> = affectedObjectIds
    .map((id) => objects.get(id))
    .filter((obj): obj is BoardObject => obj !== undefined)
    .map((obj) => ({ ...obj }));
  doc.destroy();
  return { success: true, results, affectedObjectIds, objects: createdObjects };
}

export async function inlineBoardState(
  boardId: string,
  context: BoardStateScopeContext | undefined,
): Promise<InlineBoardStateResult> {
  const doc = new Y.Doc();
  await loadSnapshot(boardId, doc);
  const objects = doc.getMap<BoardObject>('objects');
  const allObjects = getAllObjects(objects);
  const scoped = scopeObjects(allObjects, context);
  doc.destroy();
  return scoped;
}

export async function inlineFindObjects(
  boardId: string,
  query: FindObjectsQuery | undefined,
): Promise<InlineFindObjectsResult> {
  const doc = new Y.Doc();
  await loadSnapshot(boardId, doc);
  const objects = doc.getMap<BoardObject>('objects');
  const allObjects = getAllObjects(objects);

  if (!query) {
    const scoped = scopeObjects(allObjects);
    doc.destroy();
    return { ...scoped, objectIds: scoped.objects.map((o) => o.id) };
  }

  const scoped = scopeObjects(allObjects, query);
  doc.destroy();
  return { ...scoped, objectIds: scoped.objects.map((o) => o.id) };
}
