import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { buildDashboardThumbnailMap, type BoardSnapshotRow } from '@/lib/dashboard/thumbnail';
import type { BoardObject } from '@/lib/yjs/board-doc';

function makeBoardObject(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? 'sticky_note',
    x: overrides.x ?? 100,
    y: overrides.y ?? 100,
    width: overrides.width ?? 200,
    height: overrides.height ?? 200,
    rotation: overrides.rotation ?? 0,
    zIndex: overrides.zIndex ?? 1,
    properties: overrides.properties ?? { text: 'Sample', color: '#ffeb3b' },
    createdBy: overrides.createdBy ?? 'user-1',
    updatedAt: overrides.updatedAt ?? '2026-02-21T12:00:00.000Z',
  };
}

function encodeSnapshot(objects: BoardObject[]): string {
  const doc = new Y.Doc();
  const map = doc.getMap<BoardObject>('objects');
  objects.forEach((object) => map.set(object.id, object));
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

describe('buildDashboardThumbnailMap', () => {
  it('returns deterministic placeholder previews for boards with no snapshot', () => {
    const thumbnails = buildDashboardThumbnailMap(['board-1'], []);
    const thumbnail = thumbnails.get('board-1');

    expect(thumbnail).toBeDefined();
    expect(thumbnail?.status).toBe('placeholder');
    expect(thumbnail?.shapes.length).toBeGreaterThan(0);
  });

  it('derives snapshot preview data and object counts from yjs state', () => {
    const snapshotRows: BoardSnapshotRow[] = [
      {
        board_id: 'board-1',
        yjs_state: encodeSnapshot([
          makeBoardObject({ id: 'sticky-1', x: 100, y: 120 }),
          makeBoardObject({ id: 'frame-1', type: 'frame', x: 420, y: 200, width: 320, height: 220 }),
        ]),
        snapshot_at: '2026-02-21T12:00:00.000Z',
      },
    ];

    const thumbnails = buildDashboardThumbnailMap(['board-1'], snapshotRows);
    const thumbnail = thumbnails.get('board-1');

    expect(thumbnail?.status).toBe('snapshot');
    expect(thumbnail?.objectCount).toBe(2);
    expect(thumbnail?.shapes.length).toBe(2);
    expect(
      thumbnail?.shapes.every(
        (shape) =>
          shape.x >= 0
          && shape.y >= 0
          && shape.width > 0
          && shape.height > 0,
      ),
    ).toBe(true);
  });

  it('falls back safely when a snapshot payload is malformed', () => {
    const snapshotRows: BoardSnapshotRow[] = [
      {
        board_id: 'board-1',
        yjs_state: 'not-valid-base64',
        snapshot_at: '2026-02-21T12:00:00.000Z',
      },
    ];

    const thumbnails = buildDashboardThumbnailMap(['board-1'], snapshotRows);
    const thumbnail = thumbnails.get('board-1');

    expect(thumbnail?.status).toBe('error');
    expect(thumbnail?.shapes.length).toBeGreaterThan(0);
  });
});
