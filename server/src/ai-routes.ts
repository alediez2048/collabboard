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
import { loadSnapshot, saveSnapshot } from './persistence';

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

interface MutateBatchRequest {
  boardId: string;
  userId: string;
  actions: MutateAction[];
}

interface BoardStateRequest {
  boardId: string;
  context?: BoardStateContext;
}

interface BoardStateViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoardStateContext {
  command?: string;
  type?: string;
  color?: string;
  textContains?: string;
  selectedObjectIds?: string[];
  viewport?: BoardStateViewport;
}

interface FindObjectsQuery extends BoardStateContext {
  inFrameId?: string;
  nearX?: number;
  nearY?: number;
  maxResults?: number;
}

interface FindObjectsRequest {
  boardId: string;
  query?: FindObjectsQuery;
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

function getTraceId(req: Request): string {
  const header = req.header('x-ai-trace-id');
  return typeof header === 'string' ? header.trim() : '';
}

function withTracePrefix(traceId: string): string {
  return traceId.length > 0 ? `[trace:${traceId}] ` : '';
}

// ── Helper: get or load a Yjs doc ─────────────────────────────────────────────

interface LoadedDocResult {
  doc: Y.Doc;
  shouldPersistImmediately: boolean;
}

async function getOrLoadDoc(boardId: string): Promise<LoadedDocResult> {
  // Try the live in-memory doc first (board has active WebSocket clients)
  const liveDoc = getDoc(boardId);
  if (liveDoc) {
    return { doc: liveDoc, shouldPersistImmediately: false };
  }

  // Board has no active clients — load from snapshot into a temporary doc.
  // Mutations to this doc must be persisted immediately because it is not
  // attached to the websocket room lifecycle/debounced save handlers.
  const doc = new Y.Doc();
  const found = await loadSnapshot(boardId, doc);
  if (!found) {
    // New board with no snapshot yet — still return an empty doc, mutations will create objects.
    return { doc, shouldPersistImmediately: true };
  }
  return { doc, shouldPersistImmediately: true };
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toTypeToken(type: string): string {
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
  const keys = ['color', 'fillColor', 'strokeColor'] as const;
  for (const key of keys) {
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

  return Math.hypot(objectCenterX - viewportCenterX, objectCenterY - viewportCenterY);
}

function tokenizeCommand(command: string): string[] {
  return normalize(command)
    .split(/[^a-z0-9_#]+/g)
    .filter((token) => token.length >= 3);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBoardStateContext(raw: unknown): BoardStateContext | undefined {
  if (!isRecord(raw)) return undefined;

  const context: BoardStateContext = {};

  if (typeof raw.command === 'string' && raw.command.trim().length > 0) {
    context.command = raw.command.trim();
  }
  if (typeof raw.type === 'string' && raw.type.trim().length > 0) {
    context.type = raw.type.trim();
  }
  if (typeof raw.color === 'string' && raw.color.trim().length > 0) {
    context.color = raw.color.trim();
  }
  if (typeof raw.textContains === 'string' && raw.textContains.trim().length > 0) {
    context.textContains = raw.textContains.trim();
  }
  if (Array.isArray(raw.selectedObjectIds)) {
    const selectedObjectIds = raw.selectedObjectIds
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (selectedObjectIds.length > 0) {
      context.selectedObjectIds = selectedObjectIds;
    }
  }
  if (isRecord(raw.viewport)) {
    const x = raw.viewport.x;
    const y = raw.viewport.y;
    const width = raw.viewport.width;
    const height = raw.viewport.height;
    if (
      typeof x === 'number'
      && typeof y === 'number'
      && typeof width === 'number'
      && typeof height === 'number'
      && width > 0
      && height > 0
    ) {
      context.viewport = { x, y, width, height };
    }
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

function parseFindObjectsQuery(raw: unknown): FindObjectsQuery | undefined {
  if (!isRecord(raw)) return undefined;

  const query: FindObjectsQuery = {
    ...(parseBoardStateContext(raw) ?? {}),
  };

  if (typeof raw.inFrameId === 'string' && raw.inFrameId.trim().length > 0) {
    query.inFrameId = raw.inFrameId.trim();
  }

  if (typeof raw.nearX === 'number' && typeof raw.nearY === 'number') {
    query.nearX = raw.nearX;
    query.nearY = raw.nearY;
  }

  if (typeof raw.maxResults === 'number' && raw.maxResults > 0 && raw.maxResults <= 50) {
    query.maxResults = raw.maxResults;
  }

  return Object.keys(query).length > 0 ? query : undefined;
}

function isInsideFrame(object: BoardObject, frame: BoardObject): boolean {
  const frameRight = frame.x + frame.width;
  const frameBottom = frame.y + frame.height;
  const objectRight = object.x + object.width;
  const objectBottom = object.y + object.height;

  return (
    object.x >= frame.x
    && object.y >= frame.y
    && objectRight <= frameRight
    && objectBottom <= frameBottom
  );
}

function distanceToPoint(object: BoardObject, x: number, y: number): number {
  const objectCenterX = object.x + (object.width / 2);
  const objectCenterY = object.y + (object.height / 2);
  return Math.hypot(objectCenterX - x, objectCenterY - y);
}

function hasHardFilters(context: BoardStateContext | undefined): boolean {
  if (!context) return false;
  return (
    typeof context.type === 'string'
    || typeof context.color === 'string'
    || typeof context.textContains === 'string'
  );
}

function matchesHardFilters(object: BoardObject, context: BoardStateContext | undefined): boolean {
  if (!context) return true;

  if (typeof context.type === 'string' && context.type.trim().length > 0) {
    if (toTypeToken(object.type) !== toTypeToken(context.type)) {
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

function relevanceScore(
  object: BoardObject,
  context: BoardStateContext | undefined,
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
      score -= Math.min(600, distanceToViewportCenter(object, context.viewport) / 10);
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
  const objectType = toTypeToken(object.type);
  const objectColor = getObjectColor(object);
  for (const token of commandTokens) {
    if (objectText.includes(token)) score += 40;
    if (objectType.includes(token)) score += 20;
    if (objectColor.includes(token)) score += 20;
  }

  return score;
}

function scopeBoardState(objects: BoardObject[], context: BoardStateContext | undefined): BoardObject[] {
  const hardFiltered = objects.filter((object) => matchesHardFilters(object, context));
  if (hardFiltered.length === 0 && hasHardFilters(context)) {
    return [];
  }

  const candidates = hardFiltered.length > 0 ? hardFiltered : objects;
  const selectedIds = new Set((context?.selectedObjectIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0));
  const commandTokens = context?.command ? tokenizeCommand(context.command) : [];

  const scored = candidates.map((object, index) => ({
    object,
    index,
    score: relevanceScore(object, context, selectedIds, commandTokens),
  }));

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return left.index - right.index;
  });

  return scored.slice(0, 50).map((item) => item.object);
}

function findObjects(objects: BoardObject[], query: FindObjectsQuery): BoardObject[] {
  const hardFiltered = objects.filter((object) => matchesHardFilters(object, query));
  if (hardFiltered.length === 0 && hasHardFilters(query)) {
    return [];
  }

  let candidates = hardFiltered.length > 0 ? hardFiltered : objects;
  if (query.inFrameId) {
    const frame = objects.find((object) => object.id === query.inFrameId && object.type === 'frame');
    if (!frame) {
      return [];
    }
    candidates = candidates.filter((object) => object.id !== frame.id && isInsideFrame(object, frame));
  }

  const selectedIds = new Set((query.selectedObjectIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0));
  const commandTokens = query.command ? tokenizeCommand(query.command) : [];

  const scored = candidates.map((object, index) => {
    let score = relevanceScore(object, query, selectedIds, commandTokens);
    if (typeof query.nearX === 'number' && typeof query.nearY === 'number') {
      score += Math.max(0, 500 - (distanceToPoint(object, query.nearX, query.nearY) / 4));
    }
    return {
      object,
      score,
      index,
    };
  });

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    // Stable deterministic tie-breaker.
    const idSort = left.object.id.localeCompare(right.object.id);
    if (idSort !== 0) return idSort;
    return left.index - right.index;
  });

  const maxResults = query.maxResults ?? 50;
  return scored.slice(0, maxResults).map((item) => item.object);
}

// ── Mutation handler ───────────────────────────────────────────────────────────

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

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /ai/mutate
 * Apply a single tool action to the live Yjs doc for a board.
 */
router.post('/mutate', async (req: Request, res: Response): Promise<void> => {
  if (!verifyBridgeSecret(req, res)) return;

  const { boardId, userId, action } = req.body as MutateRequest;
  const traceId = getTraceId(req);

  if (!boardId || !userId || !action?.tool) {
    res.status(400).json({ success: false, error: 'boardId, userId, and action.tool are required' });
    return;
  }

  try {
    const { doc, shouldPersistImmediately } = await getOrLoadDoc(boardId);

    const objects = doc.getMap<BoardObject>('objects');
    const result = applyMutation(objects, action, userId, objects.size + 1);

    if (result.error) {
      res.json({ success: false, affectedObjectIds: [], error: result.error });
      return;
    }

    if (shouldPersistImmediately) {
      await saveSnapshot(boardId, doc);
    }

    console.log(`[AI Bridge] ${withTracePrefix(traceId)}${action.tool} on board ${boardId} → ${result.affectedObjectIds.join(', ')}`);
    res.json({ success: true, affectedObjectIds: result.affectedObjectIds });
  } catch (err) {
    console.error(`[AI Bridge] ${withTracePrefix(traceId)}Mutate error:`, err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /ai/mutate-batch
 * Apply a sequence of tool actions in order, inside a single Yjs transaction.
 * Stops at first failure and returns partial successes that were already applied.
 */
router.post('/mutate-batch', async (req: Request, res: Response): Promise<void> => {
  if (!verifyBridgeSecret(req, res)) return;

  const { boardId, userId, actions } = req.body as MutateBatchRequest;
  const traceId = getTraceId(req);

  if (!boardId || !userId || !Array.isArray(actions) || actions.length === 0) {
    res.status(400).json({ success: false, error: 'boardId, userId, and non-empty actions[] are required' });
    return;
  }

  try {
    const { doc, shouldPersistImmediately } = await getOrLoadDoc(boardId);

    const objects = doc.getMap<BoardObject>('objects');
    let nextZIndex = objects.size + 1;
    const results: Array<{ affectedObjectIds: string[] }> = [];
    let failedIndex = -1;
    let failedError: string | undefined;

    doc.transact(() => {
      for (let index = 0; index < actions.length; index += 1) {
        const action = actions[index];
        const result = applyMutation(objects, action, userId, nextZIndex);
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
      res.json({
        success: false,
        results,
        failedIndex,
        error: failedError,
      });
      return;
    }

    if (shouldPersistImmediately) {
      await saveSnapshot(boardId, doc);
    }

    const affectedObjectIds = results.flatMap((result) => result.affectedObjectIds);
    res.json({
      success: true,
      results,
      affectedObjectIds,
    });
  } catch (err) {
    console.error(`[AI Bridge] ${withTracePrefix(traceId)}Mutate batch error:`, err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /ai/find-objects
 * Return deterministic object matches and IDs for precise follow-up mutations.
 */
router.post('/find-objects', async (req: Request, res: Response): Promise<void> => {
  if (!verifyBridgeSecret(req, res)) return;

  const { boardId } = req.body as FindObjectsRequest;
  const query = parseFindObjectsQuery((req.body as FindObjectsRequest).query);
  const traceId = getTraceId(req);

  if (!boardId) {
    res.status(400).json({ success: false, error: 'boardId is required' });
    return;
  }
  if (!query) {
    res.status(400).json({ success: false, error: 'query is required' });
    return;
  }

  try {
    const { doc } = await getOrLoadDoc(boardId);
    const objects = doc.getMap<BoardObject>('objects');
    const allObjects = getAllObjects(objects);
    const matches = findObjects(allObjects, query);

    res.json({
      totalObjects: allObjects.length,
      returnedCount: matches.length,
      objectIds: matches.map((object) => object.id),
      objects: matches,
    });
  } catch (err) {
    console.error(`[AI Bridge] ${withTracePrefix(traceId)}Find objects error:`, err);
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
  const context = parseBoardStateContext((req.body as BoardStateRequest).context);
  const traceId = getTraceId(req);

  if (!boardId) {
    res.status(400).json({ success: false, error: 'boardId is required' });
    return;
  }

  try {
    const { doc } = await getOrLoadDoc(boardId);

    const objects = doc.getMap<BoardObject>('objects');
    const allObjects = getAllObjects(objects);
    const scoped = scopeBoardState(allObjects, context);

    res.json({
      totalObjects: allObjects.length,
      returnedCount: scoped.length,
      objects: scoped,
    });
  } catch (err) {
    console.error(`[AI Bridge] ${withTracePrefix(traceId)}Board state error:`, err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export { router as aiRouter };
