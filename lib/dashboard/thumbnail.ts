import * as Y from 'yjs';
import type { DashboardBoardThumbnail, DashboardBoardThumbnailShape } from '@/types/board';

interface SnapshotObjectCandidate {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  zIndex?: unknown;
  properties?: unknown;
}

interface RenderableSnapshotObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  color: string;
  borderRadius: number;
}

export interface BoardSnapshotRow {
  board_id: string;
  yjs_state: unknown;
  snapshot_at: string | null;
}

const MAX_PREVIEW_OBJECTS = 24;
const PREVIEW_PADDING_PERCENT = 8;
const PREVIEW_INNER_PERCENT = 100 - (PREVIEW_PADDING_PERCENT * 2);
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const TYPE_COLORS: Record<string, string> = {
  sticky_note: '#fde68a',
  frame: '#bfdbfe',
  rectangle: '#c4b5fd',
  circle: '#93c5fd',
  line: '#60a5fa',
  connector: '#60a5fa',
  freehand_stroke: '#60a5fa',
  text: '#d1d5db',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function extractColor(type: string, properties: unknown): string {
  if (isRecord(properties)) {
    const rawColor = properties.color;
    if (typeof rawColor === 'string' && rawColor.trim().length > 0) {
      return rawColor;
    }
  }

  return TYPE_COLORS[type] ?? '#d1d5db';
}

function borderRadiusForType(type: string): number {
  if (type === 'circle') {
    return 999;
  }

  if (type === 'line' || type === 'connector' || type === 'freehand_stroke') {
    return 2;
  }

  if (type === 'frame') {
    return 4;
  }

  return 8;
}

function normalizeSnapshotObject(id: string, value: unknown): RenderableSnapshotObject | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as SnapshotObjectCandidate;
  const type = typeof candidate.type === 'string' ? candidate.type : null;
  const x = toFiniteNumber(candidate.x);
  const y = toFiniteNumber(candidate.y);
  const width = toFiniteNumber(candidate.width);
  const height = toFiniteNumber(candidate.height);
  const zIndex = toFiniteNumber(candidate.zIndex) ?? 0;

  if (!type || x === null || y === null || width === null || height === null) {
    return null;
  }

  const normalizedWidth = Math.max(width, 4);
  const normalizedHeight = Math.max(height, 4);

  return {
    id,
    type,
    x,
    y,
    width: normalizedWidth,
    height: normalizedHeight,
    zIndex,
    color: extractColor(type, candidate.properties),
    borderRadius: borderRadiusForType(type),
  };
}

function createPlaceholderShapes(boardId: string): DashboardBoardThumbnailShape[] {
  const seed = hashSeed(boardId);
  const hue = seed % 360;

  return Array.from({ length: 4 }, (_, index) => {
    const localSeed = (seed >> (index * 2)) & 0xff;
    const x = 8 + (index * 18) + (localSeed % 6);
    const y = 16 + ((localSeed >> 1) % 34);
    const width = 14 + (localSeed % 18);
    const height = 10 + ((localSeed >> 2) % 20);

    return {
      id: `placeholder-${index + 1}`,
      type: 'placeholder',
      x: clamp(x, 0, 90),
      y: clamp(y, 0, 90),
      width: clamp(width, 6, 34),
      height: clamp(height, 6, 34),
      color: `hsl(${(hue + (index * 27)) % 360} 78% 86%)`,
      borderRadius: 8,
    };
  });
}

function createFallbackThumbnail(
  boardId: string,
  status: DashboardBoardThumbnail['status'],
  snapshotAt: string | null,
): DashboardBoardThumbnail {
  return {
    status,
    objectCount: 0,
    snapshotAt,
    shapes: createPlaceholderShapes(boardId),
  };
}

function toStateBytes(yjsState: unknown): Uint8Array | null {
  if (!yjsState) {
    return null;
  }

  if (yjsState instanceof Uint8Array) {
    return yjsState;
  }

  if (yjsState instanceof ArrayBuffer) {
    return new Uint8Array(yjsState);
  }

  if (typeof yjsState !== 'string') {
    return null;
  }

  const normalized = yjsState.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.startsWith('\\x')) {
    const hex = normalized.slice(2);
    if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
      return null;
    }
    return new Uint8Array(Buffer.from(hex, 'hex'));
  }

  if (!BASE64_PATTERN.test(normalized)) {
    return null;
  }

  return new Uint8Array(Buffer.from(normalized, 'base64'));
}

function readRenderableObjects(stateBytes: Uint8Array): RenderableSnapshotObject[] {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, stateBytes);

  const objectMap = doc.getMap<unknown>('objects');
  const objects: RenderableSnapshotObject[] = [];
  objectMap.forEach((value, key) => {
    const normalized = normalizeSnapshotObject(key, value);
    if (normalized) {
      objects.push(normalized);
    }
  });

  return objects.sort((left, right) => left.zIndex - right.zIndex);
}

function normalizeShapes(objects: RenderableSnapshotObject[]): DashboardBoardThumbnailShape[] {
  const sampled = objects.slice(0, MAX_PREVIEW_OBJECTS);
  const minX = Math.min(...sampled.map((object) => object.x));
  const minY = Math.min(...sampled.map((object) => object.y));
  const maxX = Math.max(...sampled.map((object) => object.x + object.width));
  const maxY = Math.max(...sampled.map((object) => object.y + object.height));

  const span = Math.max(maxX - minX, maxY - minY, 1);

  return sampled.map((object) => {
    const relativeX = ((object.x - minX) / span) * PREVIEW_INNER_PERCENT;
    const relativeY = ((object.y - minY) / span) * PREVIEW_INNER_PERCENT;
    const relativeWidth = (object.width / span) * PREVIEW_INNER_PERCENT;
    const relativeHeight = (object.height / span) * PREVIEW_INNER_PERCENT;

    const x = clamp(PREVIEW_PADDING_PERCENT + relativeX, 0, 96);
    const y = clamp(PREVIEW_PADDING_PERCENT + relativeY, 0, 96);
    const width = clamp(relativeWidth, 4, 100 - x);
    const height = clamp(relativeHeight, 4, 100 - y);

    return {
      id: object.id,
      type: object.type,
      x,
      y,
      width,
      height,
      color: object.color,
      borderRadius: object.borderRadius,
    };
  });
}

function buildSnapshotThumbnail(boardId: string, snapshotRow: BoardSnapshotRow): DashboardBoardThumbnail {
  const stateBytes = toStateBytes(snapshotRow.yjs_state);
  if (!stateBytes) {
    return createFallbackThumbnail(boardId, 'error', snapshotRow.snapshot_at);
  }

  try {
    const renderableObjects = readRenderableObjects(stateBytes);
    if (renderableObjects.length === 0) {
      return createFallbackThumbnail(boardId, 'empty', snapshotRow.snapshot_at);
    }

    return {
      status: 'snapshot',
      objectCount: renderableObjects.length,
      snapshotAt: snapshotRow.snapshot_at,
      shapes: normalizeShapes(renderableObjects),
    };
  } catch {
    return createFallbackThumbnail(boardId, 'error', snapshotRow.snapshot_at);
  }
}

export function buildDashboardThumbnailMap(
  boardIds: string[],
  snapshotRows: BoardSnapshotRow[],
): Map<string, DashboardBoardThumbnail> {
  const snapshotByBoardId = new Map<string, BoardSnapshotRow>();
  snapshotRows.forEach((row) => {
    if (!snapshotByBoardId.has(row.board_id)) {
      snapshotByBoardId.set(row.board_id, row);
    }
  });

  const thumbnails = new Map<string, DashboardBoardThumbnail>();
  boardIds.forEach((boardId) => {
    const snapshotRow = snapshotByBoardId.get(boardId);
    if (!snapshotRow) {
      thumbnails.set(boardId, createFallbackThumbnail(boardId, 'placeholder', null));
      return;
    }

    thumbnails.set(boardId, buildSnapshotThumbnail(boardId, snapshotRow));
  });

  return thumbnails;
}
