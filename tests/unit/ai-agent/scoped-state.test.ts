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

  it('prioritizes selectedObjectIds when board exceeds cap', () => {
    const objects = Array.from({ length: 70 }, (_, index) =>
      makeObject({
        id: `obj-${index + 1}`,
        properties: { text: `Note ${index + 1}`, color: '#ffeb3b' },
      }),
    );

    const result = scopeObjects(objects, {
      selectedObjectIds: ['obj-69', 'obj-70'],
    });

    const returnedIds = new Set(result.objects.map((object) => object.id));
    expect(returnedIds.has('obj-69')).toBe(true);
    expect(returnedIds.has('obj-70')).toBe(true);
  });

  it('supports type filtering when type context is provided', () => {
    const objects: BoardObject[] = [
      makeObject({ id: 'frame-1', type: 'frame', properties: { title: 'Planning' } }),
      makeObject({ id: 'note-1', type: 'sticky_note', properties: { text: 'Idea', color: '#ffeb3b' } }),
      makeObject({ id: 'line-1', type: 'line', properties: { strokeColor: '#3b82f6' } }),
    ];

    const result = scopeObjects(objects, { type: 'frame' });
    expect(result.returnedCount).toBe(1);
    expect(result.objects[0]?.id).toBe('frame-1');
  });

  it('supports color filtering across color property keys', () => {
    const objects: BoardObject[] = [
      makeObject({ id: 'note-1', type: 'sticky_note', properties: { text: 'Idea', color: '#ffeb3b' } }),
      makeObject({ id: 'frame-1', type: 'frame', properties: { title: 'Frame', fillColor: '#f87171' } }),
      makeObject({ id: 'line-1', type: 'line', properties: { strokeColor: '#f87171' } }),
    ];

    const result = scopeObjects(objects, { color: '#f87171' });
    const returnedIds = result.objects.map((object) => object.id);
    expect(returnedIds).toContain('frame-1');
    expect(returnedIds).toContain('line-1');
    expect(returnedIds).not.toContain('note-1');
  });

  it('supports textContains matching against note text and frame title', () => {
    const objects: BoardObject[] = [
      makeObject({ id: 'note-1', type: 'sticky_note', properties: { text: 'Customer feedback', color: '#ffeb3b' } }),
      makeObject({ id: 'frame-1', type: 'frame', properties: { title: 'Sprint planning' } }),
      makeObject({ id: 'note-2', type: 'sticky_note', properties: { text: 'Unrelated', color: '#ffeb3b' } }),
    ];

    const result = scopeObjects(objects, { textContains: 'planning' });
    expect(result.objects.map((object) => object.id)).toEqual(['frame-1']);
  });

  it('prefers objects intersecting viewport when capping large boards', () => {
    const farObjects = Array.from({ length: 70 }, (_, index) =>
      makeObject({
        id: `far-${index + 1}`,
        x: 4000 + index * 100,
        y: 4000 + index * 100,
        properties: { text: `Far ${index + 1}`, color: '#ffeb3b' },
      }),
    );
    const nearObjects = [
      makeObject({ id: 'near-1', x: 120, y: 150, properties: { text: 'Near 1', color: '#ffeb3b' } }),
      makeObject({ id: 'near-2', x: 260, y: 240, properties: { text: 'Near 2', color: '#ffeb3b' } }),
    ];
    const objects = [...farObjects, ...nearObjects];

    const result = scopeObjects(objects, {
      viewport: { x: 0, y: 0, width: 800, height: 600 },
    });
    const returnedIds = new Set(result.objects.map((object) => object.id));
    expect(returnedIds.has('near-1')).toBe(true);
    expect(returnedIds.has('near-2')).toBe(true);
  });
});
