import { describe, expect, it } from 'vitest';
import {
  addObject,
  applyObjectMapChanges,
  createBoardDoc,
  getAllObjects,
  removeObject,
  updateObjectPositions,
  updateObject,
  type BoardObject,
} from '@/lib/yjs/board-doc';

function makeSticky(id: string, overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id,
    type: 'sticky_note',
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    rotation: 0,
    zIndex: 1,
    properties: { text: id, color: '#fef08a' },
    createdBy: 'tester',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('applyObjectMapChanges', () => {
  it('returns the same array reference when no keys changed', () => {
    const { objects } = createBoardDoc();
    addObject(objects, makeSticky('a'));
    addObject(objects, makeSticky('b'));

    const current = getAllObjects(objects);
    const next = applyObjectMapChanges(current, objects, []);

    expect(next).toBe(current);
  });

  it('applies add, update, and delete changes incrementally', () => {
    const { objects } = createBoardDoc();
    addObject(objects, makeSticky('a'));
    addObject(objects, makeSticky('b'));

    const current = getAllObjects(objects);
    const previousB = current.find((object) => object.id === 'b');

    updateObject(objects, 'a', { x: 320, y: 180 });
    removeObject(objects, 'b');
    addObject(objects, makeSticky('c', { x: 25, y: 35 }));

    const next = applyObjectMapChanges(current, objects, ['a', 'b', 'c']);
    const updatedA = next.find((object) => object.id === 'a');
    const retainedB = next.find((object) => object.id === 'b');
    const insertedC = next.find((object) => object.id === 'c');

    expect(next).toHaveLength(2);
    expect(updatedA?.x).toBe(320);
    expect(updatedA?.y).toBe(180);
    expect(retainedB).toBeUndefined();
    expect(insertedC?.x).toBe(25);
    expect(insertedC?.y).toBe(35);
    expect(next.some((object) => object === previousB)).toBe(false);
  });

  it('preserves object references for unchanged entries', () => {
    const { objects } = createBoardDoc();
    addObject(objects, makeSticky('a'));
    addObject(objects, makeSticky('b', { x: 44 }));

    const current = getAllObjects(objects);
    const previousB = current.find((object) => object.id === 'b');

    updateObject(objects, 'a', { x: 999 });
    const next = applyObjectMapChanges(current, objects, ['a']);
    const nextB = next.find((object) => object.id === 'b');

    expect(nextB).toBe(previousB);
  });

  it('applies multi-object position updates with a shared timestamp', () => {
    const { objects } = createBoardDoc();
    addObject(objects, makeSticky('a', { x: 10, y: 20 }));
    addObject(objects, makeSticky('b', { x: 30, y: 40 }));

    const updatedAt = '2026-02-20T00:00:00.000Z';
    const updatedCount = updateObjectPositions(
      objects,
      [
        { id: 'a', x: 110, y: 120 },
        { id: 'b', x: 130, y: 140 },
        { id: 'missing', x: 0, y: 0 },
      ],
      updatedAt,
    );

    expect(updatedCount).toBe(2);
    expect(objects.get('a')?.x).toBe(110);
    expect(objects.get('a')?.y).toBe(120);
    expect(objects.get('a')?.updatedAt).toBe(updatedAt);
    expect(objects.get('b')?.x).toBe(130);
    expect(objects.get('b')?.y).toBe(140);
    expect(objects.get('b')?.updatedAt).toBe(updatedAt);
  });
});
