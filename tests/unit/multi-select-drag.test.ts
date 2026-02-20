import { describe, expect, it } from 'vitest';
import type { BoardObject } from '@/lib/yjs/board-doc';
import {
  buildLiveDragPreviewPositions,
  buildMovedPositionUpdates,
  computePrimaryDragDelta,
  getMovableSelectionIds,
} from '@/lib/utils/multi-select-drag';

function makeObject(
  id: string,
  type: BoardObject['type'],
  overrides: Partial<BoardObject> = {},
): BoardObject {
  return {
    id,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 1,
    properties: {},
    createdBy: 'tester',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('multi-select drag utilities', () => {
  it('filters out connectors from movable selection', () => {
    const sticky = makeObject('sticky-1', 'sticky_note');
    const frame = makeObject('frame-1', 'frame');
    const connector = makeObject('connector-1', 'connector');

    const lookup = new Map<string, BoardObject>([
      [sticky.id, sticky],
      [frame.id, frame],
      [connector.id, connector],
    ]);

    const movableIds = getMovableSelectionIds(
      ['sticky-1', 'connector-1', 'frame-1', 'missing-id'],
      lookup,
    );

    expect(movableIds).toEqual(['sticky-1', 'frame-1']);
  });

  it('builds per-object moved positions from shared delta', () => {
    const initialPositions = new Map<string, { x: number; y: number }>([
      ['a', { x: 100, y: 200 }],
      ['b', { x: -50, y: 0 }],
    ]);

    const updates = buildMovedPositionUpdates(
      ['a', 'b', 'missing'],
      initialPositions,
      { x: 30, y: -15 },
    );

    expect(updates).toEqual([
      { id: 'a', x: 130, y: 185 },
      { id: 'b', x: -20, y: -15 },
    ]);
  });

  it('builds live drag preview positions from primary current position', () => {
    const initialPositions = new Map<string, { x: number; y: number }>([
      ['primary', { x: 200, y: 300 }],
      ['follower-a', { x: 100, y: 120 }],
      ['follower-b', { x: -20, y: 40 }],
    ]);

    const updates = buildLiveDragPreviewPositions(
      ['primary', 'follower-a', 'follower-b'],
      initialPositions,
      'primary',
      { x: 245, y: 270 },
    );

    expect(updates).toEqual([
      { id: 'primary', x: 245, y: 270 },
      { id: 'follower-a', x: 145, y: 90 },
      { id: 'follower-b', x: 25, y: 10 },
    ]);
  });

  it('returns empty updates when primary initial position is unavailable', () => {
    const initialPositions = new Map<string, { x: number; y: number }>([
      ['a', { x: 10, y: 10 }],
      ['b', { x: 20, y: 20 }],
    ]);

    const updates = buildLiveDragPreviewPositions(
      ['a', 'b'],
      initialPositions,
      'missing-primary',
      { x: 50, y: 50 },
    );

    expect(updates).toEqual([]);
  });

  it('computes drag delta from the primary object initial position', () => {
    const initialPositions = new Map<string, { x: number; y: number }>([
      ['primary', { x: 100, y: 200 }],
      ['other', { x: 10, y: 20 }],
    ]);

    const delta = computePrimaryDragDelta(initialPositions, 'primary', { x: 145, y: 170 });
    expect(delta).toEqual({ x: 45, y: -30 });
  });

  it('returns null drag delta when primary object initial position is unavailable', () => {
    const initialPositions = new Map<string, { x: number; y: number }>([
      ['other', { x: 10, y: 20 }],
    ]);

    const delta = computePrimaryDragDelta(initialPositions, 'primary', { x: 145, y: 170 });
    expect(delta).toBeNull();
  });
});
