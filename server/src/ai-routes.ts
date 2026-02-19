/**
 * AI Bridge HTTP endpoints for the realtime server.
 *
 * These endpoints are called by the Next.js /api/ai/command route.
 * They access the live in-memory Yjs docs and apply validated mutations.
 *
 * Security: All requests must include Authorization: Bearer <AI_BRIDGE_SECRET>.
 * The secret is shared between the Next.js app and this server via env vars.
 */

import { Router, Request, Response } from 'express';
import * as Y from 'yjs';
import { getDoc } from './yjs-server';
import { loadSnapshot } from './persistence';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardObject {
  id: string;
  type: string;
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

interface MutateAction {
  tool: string;
  args: Record<string, unknown>;
}

interface MutateRequest {
  boardId: string;
  userId: string;
  action: MutateAction;
}

interface BoardStateRequest {
  boardId: string;
}

// ── Auth middleware ────────────────────────────────────────────────────────────

function verifyBridgeSecret(req: Request, res: Response): boolean {
  const secret = process.env.AI_BRIDGE_SECRET;
  if (!secret) {
    console.error('[AI Bridge] AI_BRIDGE_SECRET not configured');
    res.status(500).json({ success: false, error: 'Bridge not configured' });
    return false;
  }
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== secret) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Helper: get or load a Yjs doc ─────────────────────────────────────────────

async function getOrLoadDoc(boardId: string): Promise<Y.Doc | null> {
  // Try the live in-memory doc first (board has active WebSocket clients)
  let doc = getDoc(boardId);
  if (doc) return doc;

  // Board has no active clients — load from snapshot into a temporary doc
  doc = new Y.Doc();
  const found = await loadSnapshot(boardId, doc);
  if (!found) {
    // New board with no snapshot yet — still return an empty doc, mutations will create objects
    return doc;
  }
  return doc;
}

// ── Yjs mutation helpers ───────────────────────────────────────────────────────
// Mirror of lib/yjs/board-doc.ts helpers, inlined for server-side use.

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

// ── Mutation handler ───────────────────────────────────────────────────────────

function applyMutation(
  objects: Y.Map<BoardObject>,
  allObjects: BoardObject[],
  action: MutateAction,
  userId: string,
): { affectedObjectIds: string[]; error?: string } {
  const { tool, args } = action;
  const now = new Date().toISOString();
  const zIndex = allObjects.length + 1;

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
        zIndex,
        properties: { text: args.text as string, color: args.color as string },
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id] };
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
        zIndex,
        properties,
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id] };
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
      return { affectedObjectIds: [id] };
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
        zIndex,
        properties: {
          fromId: args.fromId as string,
          toId: args.toId as string,
          color: '#1d4ed8',
          strokeWidth: 2,
        },
        createdBy: userId,
        updatedAt: now,
      });
      return { affectedObjectIds: [id] };
    }

    case 'moveObject': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found` };
      updateObject(objects, objectId, { x: args.x as number, y: args.y as number });
      return { affectedObjectIds: [objectId] };
    }

    case 'resizeObject': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found` };
      updateObject(objects, objectId, { width: args.width as number, height: args.height as number });
      return { affectedObjectIds: [objectId] };
    }

    case 'updateText': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found` };
      const textKey = obj.type === 'frame' ? 'title' : 'text';
      updateObject(objects, objectId, {
        properties: { ...obj.properties, [textKey]: args.newText as string },
      });
      return { affectedObjectIds: [objectId] };
    }

    case 'changeColor': {
      const objectId = args.objectId as string;
      const obj = objects.get(objectId);
      if (!obj) return { affectedObjectIds: [], error: `Object ${objectId} not found` };
      const colorKey = obj.type === 'sticky_note' ? 'color' : 'fillColor';
      updateObject(objects, objectId, {
        properties: { ...obj.properties, [colorKey]: args.color as string },
      });
      return { affectedObjectIds: [objectId] };
    }

    default:
      return { affectedObjectIds: [], error: `Unknown tool: ${tool}` };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /ai/mutate
 * Apply a single tool action to the live Yjs doc for a board.
 */
router.post('/mutate', async (req: Request, res: Response): Promise<void> => {
  if (!verifyBridgeSecret(req, res)) return;

  const { boardId, userId, action } = req.body as MutateRequest;

  if (!boardId || !userId || !action?.tool) {
    res.status(400).json({ success: false, error: 'boardId, userId, and action.tool are required' });
    return;
  }

  try {
    const doc = await getOrLoadDoc(boardId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    const objects = doc.getMap<BoardObject>('objects');
    const allObjects = getAllObjects(objects);
    const result = applyMutation(objects, allObjects, action, userId);

    if (result.error) {
      res.json({ success: false, affectedObjectIds: [], error: result.error });
      return;
    }

    console.log(`[AI Bridge] ${action.tool} on board ${boardId} → ${result.affectedObjectIds.join(', ')}`);
    res.json({ success: true, affectedObjectIds: result.affectedObjectIds });
  } catch (err) {
    console.error('[AI Bridge] Mutate error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /ai/board-state
 * Return scoped board state (max 50 objects) for a board.
 */
router.post('/board-state', async (req: Request, res: Response): Promise<void> => {
  if (!verifyBridgeSecret(req, res)) return;

  const { boardId } = req.body as BoardStateRequest;

  if (!boardId) {
    res.status(400).json({ success: false, error: 'boardId is required' });
    return;
  }

  try {
    const doc = await getOrLoadDoc(boardId);
    if (!doc) {
      res.json({ totalObjects: 0, returnedCount: 0, objects: [] });
      return;
    }

    const objects = doc.getMap<BoardObject>('objects');
    const allObjects = getAllObjects(objects);
    const scoped = allObjects.slice(0, 50);

    res.json({
      totalObjects: allObjects.length,
      returnedCount: scoped.length,
      objects: scoped,
    });
  } catch (err) {
    console.error('[AI Bridge] Board state error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export { router as aiRouter };
