import { describe, it, expect } from 'vitest';
import { scopeObjects } from '@/lib/ai-agent/scoped-state';
import type { BoardObject } from '@/lib/yjs/board-doc';

function makeObject(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    type: 'sticky_note',
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    width: 200,
    height: 200,
    rotation: 0,
    zIndex: 1,
    properties: { text: 'Test', color: '#ffeb3b' },
    createdBy: 'user-1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('scopeObjects', () => {
  it('returns all objects when count is under 50', () => {
    const objects = Array.from({ length: 10 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result.returnedCount).toBe(10);
    expect(result.totalObjects).toBe(10);
    expect(result.objects).toHaveLength(10);
  });

  it('caps returned objects at 50 when board has more', () => {
    const objects = Array.from({ length: 80 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result.returnedCount).toBe(50);
    expect(result.totalObjects).toBe(80);
    expect(result.objects).toHaveLength(50);
  });

  it('never returns more than 50 objects regardless of board size', () => {
    const objects = Array.from({ length: 500 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result.objects.length).toBeLessThanOrEqual(50);
  });

  it('includes totalObjects and returnedCount summary fields', () => {
    const objects = Array.from({ length: 5 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result).toHaveProperty('totalObjects');
    expect(result).toHaveProperty('returnedCount');
    expect(result).toHaveProperty('objects');
  });

  it('returns empty objects array when board is empty', () => {
    const result = scopeObjects([]);
    expect(result.totalObjects).toBe(0);
    expect(result.returnedCount).toBe(0);
    expect(result.objects).toHaveLength(0);
  });

  it('returnedCount matches objects array length', () => {
    const objects = Array.from({ length: 30 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result.returnedCount).toBe(result.objects.length);
  });

  it('totalObjects always reflects full board size regardless of cap', () => {
    const objects = Array.from({ length: 120 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result.totalObjects).toBe(120);
    expect(result.returnedCount).toBe(50);
  });

  it('returns exactly 50 when board has exactly 50 objects', () => {
    const objects = Array.from({ length: 50 }, () => makeObject());
    const result = scopeObjects(objects);
    expect(result.returnedCount).toBe(50);
    expect(result.totalObjects).toBe(50);
  });
});
