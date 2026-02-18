import { describe, it, expect } from 'vitest';
import { normalizeGeometry } from '@/lib/utils/geometry';

describe('normalizeGeometry', () => {
  it('applies scaleX and scaleY to width and height', () => {
    const result = normalizeGeometry(100, 80, 2, 1.5);
    expect(result.width).toBe(200);
    expect(result.height).toBe(120);
  });

  it('clamps width to minSize when scaled result is too small', () => {
    const result = normalizeGeometry(100, 100, 0.1, 0.1, 20);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('uses default minSize of 20 when not provided', () => {
    const result = normalizeGeometry(50, 50, 0.01, 0.01);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('clamps only the axis that falls below minSize', () => {
    const result = normalizeGeometry(200, 100, 1.5, 0.1, 20);
    expect(result.width).toBe(300);
    expect(result.height).toBe(20);
  });

  it('returns exact values when scale is 1', () => {
    const result = normalizeGeometry(150, 75, 1, 1);
    expect(result.width).toBe(150);
    expect(result.height).toBe(75);
  });

  it('handles non-uniform scaling correctly', () => {
    const result = normalizeGeometry(100, 200, 0.5, 3, 20);
    expect(result.width).toBe(50);
    expect(result.height).toBe(600);
  });

  it('respects a custom minSize', () => {
    const result = normalizeGeometry(100, 100, 0.05, 0.05, 50);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });
});
