import { describe, expect, it } from 'vitest';
import {
  addObject,
  applyObjectMapChanges,
  createBoardDoc,
  getAllObjects,
  updateObject,
  type BoardObject,
} from '@/lib/yjs/board-doc';

function makeSticky(id: string, x: number, y: number): BoardObject {
  return {
    id,
    type: 'sticky_note',
    x,
    y,
    width: 140,
    height: 140,
    rotation: 0,
    zIndex: 1,
    properties: { text: id, color: '#fef08a' },
    createdBy: 'benchmark',
    updatedAt: new Date().toISOString(),
  };
}

function seedBoard(objectCount: number): ReturnType<typeof createBoardDoc> {
  const seeded = createBoardDoc();
  for (let i = 0; i < objectCount; i += 1) {
    addObject(
      seeded.objects,
      makeSticky(`obj-${i}`, (i % 100) * 160, Math.floor(i / 100) * 160),
    );
  }
  return seeded;
}

function runFullRebuildBenchmark(objectCount: number, iterations: number): number {
  const { objects } = seedBoard(objectCount);
  const targetId = 'obj-0';

  const startedAt = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    updateObject(objects, targetId, { x: i, y: i });
    void getAllObjects(objects);
  }
  return performance.now() - startedAt;
}

function runIncrementalBenchmark(objectCount: number, iterations: number): number {
  const { objects } = seedBoard(objectCount);
  const targetId = 'obj-0';
  let currentObjects = getAllObjects(objects);
  const indexById = new Map<string, number>();
  for (let index = 0; index < currentObjects.length; index += 1) {
    indexById.set(currentObjects[index].id, index);
  }

  const startedAt = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    updateObject(objects, targetId, { x: i, y: i });
    currentObjects = applyObjectMapChanges(
      currentObjects,
      objects,
      [targetId],
      indexById,
    );
  }
  return performance.now() - startedAt;
}

describe('dense-board incremental update benchmark', () => {
  [
    { objectCount: 500, iterations: 300 },
    { objectCount: 1000, iterations: 300 },
    { objectCount: 2000, iterations: 300 },
  ].forEach(({ objectCount, iterations }) => {
    it(`shows incremental updates outperforming full rebuild at ${objectCount} objects`, () => {
      const fullRebuildMs = runFullRebuildBenchmark(objectCount, iterations);
      const incrementalMs = runIncrementalBenchmark(objectCount, iterations);
      const speedup = fullRebuildMs / Math.max(incrementalMs, 0.0001);

      console.info(
        `[Dense Benchmark] ${objectCount} objects x ${iterations} updates -> ` +
          `full=${fullRebuildMs.toFixed(2)}ms incremental=${incrementalMs.toFixed(2)}ms speedup=${speedup.toFixed(2)}x`,
      );

      expect(incrementalMs).toBeLessThan(fullRebuildMs);
      expect(speedup).toBeGreaterThan(1.2);
    });
  });
});
