import { describe, expect, it } from 'vitest';
import {
  computeEvenHorizontalSpacing,
  computeGridLayout,
  findNonOverlappingOrigin,
  rectanglesOverlap,
  type LayoutObjectInput,
} from '@/lib/ai-agent/layout';

function makeItem(overrides: Partial<LayoutObjectInput> = {}): LayoutObjectInput {
  return {
    id: crypto.randomUUID(),
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    ...overrides,
  };
}

describe('computeGridLayout', () => {
  it('returns deterministic grid positions in row-major order', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
      makeItem({ id: 'd' }),
    ];

    const positions = computeGridLayout(items, {
      columns: 2,
      startX: 100,
      startY: 200,
      horizontalGap: 40,
      verticalGap: 30,
    });

    expect(positions).toEqual([
      { objectId: 'a', x: 100, y: 200 },
      { objectId: 'b', x: 340, y: 200 },
      { objectId: 'c', x: 100, y: 430 },
      { objectId: 'd', x: 340, y: 430 },
    ]);
  });

  it('returns empty when no items are provided', () => {
    expect(computeGridLayout([], { columns: 3 })).toEqual([]);
  });
});

describe('computeEvenHorizontalSpacing', () => {
  it('evenly spaces objects between left and right bounds', () => {
    const items = [
      makeItem({ id: 'left', x: 100, width: 100 }),
      makeItem({ id: 'mid', x: 180, width: 100 }),
      makeItem({ id: 'right', x: 400, width: 100 }),
    ];

    const positions = computeEvenHorizontalSpacing(items);
    expect(positions).toEqual([
      { objectId: 'left', x: 100, y: 100 },
      { objectId: 'mid', x: 250, y: 100 },
      { objectId: 'right', x: 400, y: 100 },
    ]);
  });

  it('falls back to default spacing when objects overlap heavily', () => {
    const items = [
      makeItem({ id: 'a', x: 100, width: 300 }),
      makeItem({ id: 'b', x: 140, width: 300 }),
      makeItem({ id: 'c', x: 180, width: 300 }),
    ];

    const positions = computeEvenHorizontalSpacing(items, { fallbackGap: 40 });
    expect(positions).toEqual([
      { objectId: 'a', x: 100, y: 100 },
      { objectId: 'b', x: 440, y: 100 },
      { objectId: 'c', x: 780, y: 100 },
    ]);
  });
});

describe('collision helpers', () => {
  it('detects overlapping rectangles', () => {
    expect(
      rectanglesOverlap(
        { x: 100, y: 100, width: 200, height: 200 },
        { x: 250, y: 250, width: 200, height: 200 },
      ),
    ).toBe(true);
  });

  it('treats touching edges as non-overlap', () => {
    expect(
      rectanglesOverlap(
        { x: 100, y: 100, width: 200, height: 200 },
        { x: 300, y: 100, width: 200, height: 200 },
      ),
    ).toBe(false);
  });
});

describe('findNonOverlappingOrigin', () => {
  it('returns initial origin when space is free', () => {
    const origin = findNonOverlappingOrigin([], { width: 400, height: 300 }, { startX: 120, startY: 120 });
    expect(origin).toEqual({ x: 120, y: 120 });
  });

  it('moves placement origin when default region is occupied', () => {
    const origin = findNonOverlappingOrigin(
      [{ x: 120, y: 120, width: 900, height: 700 }],
      { width: 800, height: 600 },
      { startX: 120, startY: 120, step: 80, maxColumns: 20, maxRows: 20 },
    );

    expect(origin.x).toBeGreaterThanOrEqual(1040);
    expect(origin.y).toBe(120);
  });
});
