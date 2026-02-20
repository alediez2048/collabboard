import { describe, expect, it } from 'vitest';
import type { BoardObject } from '@/lib/yjs/board-doc';
import {
  buildObjectLookup,
  computeCanvasViewport,
  isObjectVisible,
  rectanglesOverlap,
  selectIntersectingObjectIds,
} from '@/lib/utils/viewport-culling';

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

describe('viewport culling utilities', () => {
  it('computes viewport bounds from pan and zoom', () => {
    const viewport = computeCanvasViewport(
      { width: 1000, height: 800 },
      { x: -200, y: -100 },
      2,
    );

    expect(viewport.left).toBe(100);
    expect(viewport.top).toBe(50);
    expect(viewport.right).toBe(600);
    expect(viewport.bottom).toBe(450);
  });

  it('detects rectangle overlap correctly', () => {
    const a = { left: 0, top: 0, right: 100, bottom: 100 };
    const b = { left: 50, top: 50, right: 150, bottom: 150 };
    const c = { left: 120, top: 120, right: 200, bottom: 200 };

    expect(rectanglesOverlap(a, b)).toBe(true);
    expect(rectanglesOverlap(a, c)).toBe(false);
  });

  it('marks normal objects visible only when intersecting viewport', () => {
    const viewport = { left: 0, top: 0, right: 500, bottom: 500 };
    const inside = makeObject('inside', 'sticky_note', { x: 40, y: 50 });
    const outside = makeObject('outside', 'sticky_note', { x: 800, y: 900 });

    expect(isObjectVisible(inside, viewport, new Map())).toBe(true);
    expect(isObjectVisible(outside, viewport, new Map())).toBe(false);
  });

  it('uses line endpoints when checking line visibility', () => {
    const viewport = { left: 0, top: 0, right: 200, bottom: 200 };
    const line = makeObject('line-1', 'line', {
      x: -50,
      y: -50,
      width: 0,
      height: 0,
      properties: { x2: 100, y2: 100 },
    });

    expect(isObjectVisible(line, viewport, new Map())).toBe(true);
  });

  it('uses connected endpoint centers when checking connector visibility', () => {
    const viewport = { left: 0, top: 0, right: 300, bottom: 300 };
    const from = makeObject('from', 'sticky_note', { x: 40, y: 40, width: 100, height: 100 });
    const to = makeObject('to', 'sticky_note', { x: 900, y: 900, width: 100, height: 100 });
    const connector = makeObject('connector-1', 'connector', {
      properties: { fromId: 'from', toId: 'to' },
      width: 0,
      height: 0,
    });

    const lookup = buildObjectLookup([from, to, connector]);
    expect(isObjectVisible(connector, viewport, lookup)).toBe(true);

    const farViewport = { left: 1200, top: 1200, right: 1500, bottom: 1500 };
    expect(isObjectVisible(connector, farViewport, lookup)).toBe(false);
  });

  it('returns IDs for all objects intersecting a selection bounds', () => {
    const inside = makeObject('inside', 'sticky_note', { x: 40, y: 50 });
    const outside = makeObject('outside', 'sticky_note', { x: 900, y: 900 });
    const line = makeObject('line-1', 'line', {
      x: -20,
      y: -20,
      width: 0,
      height: 0,
      properties: { x2: 80, y2: 80 },
    });

    const selection = { left: 0, top: 0, right: 200, bottom: 200 };
    const ids = selectIntersectingObjectIds([inside, outside, line], selection);
    expect(ids.sort()).toEqual(['inside', 'line-1']);
  });

  it('selects connectors when their computed segment intersects bounds', () => {
    const from = makeObject('from', 'sticky_note', { x: 20, y: 20, width: 100, height: 100 });
    const to = makeObject('to', 'sticky_note', { x: 900, y: 900, width: 100, height: 100 });
    const connector = makeObject('connector-1', 'connector', {
      properties: { fromId: 'from', toId: 'to' },
      width: 0,
      height: 0,
    });

    const nearSelection = { left: 0, top: 0, right: 200, bottom: 200 };
    expect(selectIntersectingObjectIds([from, to, connector], nearSelection).sort()).toEqual([
      'connector-1',
      'from',
    ]);
  });
});
