import { describe, expect, it } from 'vitest';
import {
  appendFreehandPoint,
  createFreehandDraft,
  finalizeFreehandDraft,
  isPointNearFreehandPath,
} from '@/lib/utils/freehand';

describe('freehand utilities', () => {
  it('creates a draft from the starting point', () => {
    const draft = createFreehandDraft(120, 80);
    expect(draft.points).toEqual([120, 80]);
    expect(draft.minX).toBe(120);
    expect(draft.minY).toBe(80);
    expect(draft.maxX).toBe(120);
    expect(draft.maxY).toBe(80);
  });

  it('appends points and expands draft bounds', () => {
    const start = createFreehandDraft(100, 100);
    const next = appendFreehandPoint(start, 80, 140);
    expect(next.points).toEqual([100, 100, 80, 140]);
    expect(next.minX).toBe(80);
    expect(next.minY).toBe(100);
    expect(next.maxX).toBe(100);
    expect(next.maxY).toBe(140);
  });

  it('finalizes to relative points with normalized bounds', () => {
    const draft = createFreehandDraft(210, 190);
    const withSecond = appendFreehandPoint(draft, 250, 220);
    const withThird = appendFreehandPoint(withSecond, 205, 200);
    const finalized = finalizeFreehandDraft(withThird);

    expect(finalized.x).toBe(205);
    expect(finalized.y).toBe(190);
    expect(finalized.width).toBe(45);
    expect(finalized.height).toBe(30);
    expect(finalized.points).toEqual([
      5, 0,
      45, 30,
      0, 10,
    ]);
  });

  it('guarantees minimum bounds for single-point strokes', () => {
    const draft = createFreehandDraft(42, 16);
    const finalized = finalizeFreehandDraft(draft);

    expect(finalized.width).toBe(1);
    expect(finalized.height).toBe(1);
    expect(finalized.points).toEqual([0, 0]);
  });

  it('detects when a pointer is near a freehand stroke segment', () => {
    const points = [0, 0, 100, 0, 100, 100];
    expect(isPointNearFreehandPath(50, 24, 10, 20, points, 3)).toBe(true);
    expect(isPointNearFreehandPath(200, 200, 10, 20, points, 3)).toBe(false);
  });

  it('returns false for invalid stroke point arrays', () => {
    expect(isPointNearFreehandPath(10, 10, 0, 0, [], 4)).toBe(false);
    expect(isPointNearFreehandPath(10, 10, 0, 0, [0, 0, 10], 4)).toBe(false);
  });
});
