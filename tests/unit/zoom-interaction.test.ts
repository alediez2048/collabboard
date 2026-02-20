import { describe, expect, it } from 'vitest';
import {
  applyPointerAnchoredWheelZoom,
  clampZoom,
  normalizeWheelDelta,
  type ViewportState,
} from '@/lib/utils/zoom-interaction';

const POINTER = { x: 420, y: 280 };

describe('zoom interaction helpers', () => {
  it('normalizes wheel deltas based on deltaMode', () => {
    expect(normalizeWheelDelta(12, 0, 900)).toBe(12);
    expect(normalizeWheelDelta(3, 1, 900)).toBe(48);
    expect(normalizeWheelDelta(1, 2, 900)).toBe(900);
  });

  it('clamps zoom to supported bounds', () => {
    expect(clampZoom(0.0001)).toBe(0.1);
    expect(clampZoom(100)).toBe(10);
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it('keeps pointer-anchored world coordinates stable when zooming', () => {
    const viewport: ViewportState = {
      zoom: 1.25,
      pan: { x: -180, y: 90 },
    };

    const worldBefore = {
      x: (POINTER.x - viewport.pan.x) / viewport.zoom,
      y: (POINTER.y - viewport.pan.y) / viewport.zoom,
    };

    const next = applyPointerAnchoredWheelZoom({
      viewport,
      pointer: POINTER,
      deltaY: -120,
      deltaMode: 0,
      pageHeight: 900,
    });

    const worldAfter = {
      x: (POINTER.x - next.pan.x) / next.zoom,
      y: (POINTER.y - next.pan.y) / next.zoom,
    };

    expect(next.zoom).toBeGreaterThan(viewport.zoom);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
  });

  it('treats coalesced wheel deltas like sequential updates', () => {
    const viewport: ViewportState = {
      zoom: 1,
      pan: { x: 0, y: 0 },
    };

    const first = applyPointerAnchoredWheelZoom({
      viewport,
      pointer: POINTER,
      deltaY: -18,
      deltaMode: 0,
      pageHeight: 900,
    });
    const sequential = applyPointerAnchoredWheelZoom({
      viewport: first,
      pointer: POINTER,
      deltaY: -12,
      deltaMode: 0,
      pageHeight: 900,
    });

    const coalesced = applyPointerAnchoredWheelZoom({
      viewport,
      pointer: POINTER,
      deltaY: -30,
      deltaMode: 0,
      pageHeight: 900,
    });

    expect(coalesced.zoom).toBeCloseTo(sequential.zoom, 6);
    expect(coalesced.pan.x).toBeCloseTo(sequential.pan.x, 6);
    expect(coalesced.pan.y).toBeCloseTo(sequential.pan.y, 6);
  });
});
