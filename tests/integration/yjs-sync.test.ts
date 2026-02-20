import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, getAllObjects, updateObject, removeObject } from '@/lib/yjs/board-doc';

function makeStickyNote(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    type: 'sticky_note' as const,
    x: 100,
    y: 200,
    width: 150,
    height: 150,
    rotation: 0,
    zIndex: 1,
    properties: { text: `Note ${id}`, color: '#ffeb3b' },
    createdBy: 'user-123',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Yjs Board Document Sync', () => {
  describe('Basic Y.Doc operations', () => {
    it('creates a board document with objects map', () => {
      const { doc, objects } = createBoardDoc();

      expect(doc).toBeInstanceOf(Y.Doc);
      expect(objects).toBeInstanceOf(Y.Map);
      expect(objects.size).toBe(0);
    });

    it('adds objects to the Y.Map', () => {
      const { objects } = createBoardDoc();

      const stickyNote = {
        id: 'sticky1',
        type: 'sticky_note' as const,
        x: 100,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        zIndex: 1,
        properties: { text: 'Test Note', color: '#ffeb3b' },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      expect(objects.size).toBe(1);
      expect(objects.get('sticky1')).toEqual(stickyNote);
    });

    it('updates objects in the Y.Map', () => {
      const { objects } = createBoardDoc();

      const stickyNote = {
        id: 'sticky1',
        type: 'sticky_note' as const,
        x: 100,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        zIndex: 1,
        properties: { text: 'Test Note', color: '#ffeb3b' },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      // Update position
      updateObject(objects, 'sticky1', { x: 300, y: 400 });

      const updated = objects.get('sticky1');
      expect(updated?.x).toBe(300);
      expect(updated?.y).toBe(400);
    });

    it('removes objects from the Y.Map', () => {
      const { objects } = createBoardDoc();

      const stickyNote = {
        id: 'sticky1',
        type: 'sticky_note' as const,
        x: 100,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        zIndex: 1,
        properties: { text: 'Test Note', color: '#ffeb3b' },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);
      expect(objects.size).toBe(1);

      removeObject(objects, 'sticky1');
      expect(objects.size).toBe(0);
      expect(objects.get('sticky1')).toBeUndefined();
    });

    it('gets all objects from the Y.Map', () => {
      const { objects } = createBoardDoc();

      // Add multiple objects
      for (let i = 1; i <= 3; i++) {
        addObject(objects, {
          id: `sticky${i}`,
          type: 'sticky_note',
          x: i * 100,
          y: i * 100,
          width: 150,
          height: 150,
          rotation: 0,
          zIndex: i,
          properties: { text: `Note ${i}`, color: '#ffeb3b' },
          createdBy: 'user-123',
          updatedAt: new Date().toISOString(),
        });
      }

      const allObjects = getAllObjects(objects);
      expect(allObjects).toHaveLength(3);
      expect(allObjects.map((o) => o.id)).toContain('sticky1');
      expect(allObjects.map((o) => o.id)).toContain('sticky2');
      expect(allObjects.map((o) => o.id)).toContain('sticky3');
    });
  });

  describe('Y.Doc synchronization', () => {
    it('syncs objects between two Y.Doc instances', () => {
      // Create two separate documents
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Add an object to doc1
      const stickyNote = {
        id: 'sticky1',
        type: 'sticky_note' as const,
        x: 100,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        zIndex: 1,
        properties: { text: 'Test Note', color: '#ffeb3b' },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects1, stickyNote);

      // Simulate sync: encode state from doc1 and apply to doc2
      const state = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state);

      // Verify doc2 has the object
      expect(objects2.size).toBe(1);
      expect(objects2.get('sticky1')).toEqual(
        expect.objectContaining({
          id: 'sticky1',
          x: 100,
          y: 200,
        })
      );
    });

    it('syncs updates between documents', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Initial object
      addObject(objects1, {
        id: 'sticky1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        zIndex: 1,
        properties: { text: 'Test', color: '#ffeb3b' },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      });

      // Initial sync
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Update in doc1
      updateObject(objects1, 'sticky1', { x: 300, y: 400 });

      // Sync update
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Verify doc2 has the update
      const obj2 = objects2.get('sticky1');
      expect(obj2?.x).toBe(300);
      expect(obj2?.y).toBe(400);
    });

    it('handles concurrent adds from two users without data loss', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Start from the same empty state (already empty, no initial sync needed)
      // User A adds objects 1–5, User B adds objects 6–10 concurrently (no sync between)
      for (let i = 1; i <= 5; i++) {
        addObject(objects1, makeStickyNote(`a-sticky-${i}`, { x: i * 100, y: 0 }));
      }
      for (let i = 6; i <= 10; i++) {
        addObject(objects2, makeStickyNote(`b-sticky-${i}`, { x: i * 100, y: 200 }));
      }

      // Cross-sync — each doc learns about the other's additions
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));

      // Both documents should now have all 10 objects
      expect(objects1.size).toBe(10);
      expect(objects2.size).toBe(10);

      for (let i = 1; i <= 5; i++) {
        expect(objects1.get(`a-sticky-${i}`)).toBeDefined();
        expect(objects2.get(`a-sticky-${i}`)).toBeDefined();
      }
      for (let i = 6; i <= 10; i++) {
        expect(objects1.get(`b-sticky-${i}`)).toBeDefined();
        expect(objects2.get(`b-sticky-${i}`)).toBeDefined();
      }
    });

    it('handles concurrent updates with CRDT merge', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Both docs start with the same state
      addObject(objects1, {
        id: 'sticky1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        zIndex: 1,
        properties: { text: 'Original', color: '#ffeb3b' },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      });

      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Concurrent updates (different properties)
      updateObject(objects1, 'sticky1', { x: 300 }); // User A moves it
      updateObject(objects2, 'sticky1', { y: 400 }); // User B moves it

      // Apply updates to each other
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));

      // Both should have both updates (CRDT merge)
      const obj1 = objects1.get('sticky1');
      const obj2 = objects2.get('sticky1');

      // Last write wins for the same property
      // Both docs should converge to the same state
      expect(obj1?.x).toBe(obj2?.x);
      expect(obj1?.y).toBe(obj2?.y);
    });

    it('persists state through encode/decode', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();

      // Add multiple objects
      for (let i = 1; i <= 3; i++) {
        addObject(objects1, {
          id: `sticky${i}`,
          type: 'sticky_note',
          x: i * 100,
          y: i * 100,
          width: 150,
          height: 150,
          rotation: 0,
          zIndex: i,
          properties: { text: `Note ${i}`, color: '#ffeb3b' },
          createdBy: 'user-123',
          updatedAt: new Date().toISOString(),
        });
      }

      // Encode state (simulate saving to database)
      const state = Y.encodeStateAsUpdate(doc1);

      // Create new document and restore state
      const { doc: doc2, objects: objects2 } = createBoardDoc();
      Y.applyUpdate(doc2, state);

      // Verify all objects were restored
      expect(objects2.size).toBe(3);
      expect(getAllObjects(objects2)).toHaveLength(3);

      for (let i = 1; i <= 3; i++) {
        expect(objects2.get(`sticky${i}`)).toBeDefined();
      }
    });
  });

  describe('Stress: high object count', () => {
    [500, 1000, 2000].forEach((objectCount) => {
      it(`correctly encodes and decodes ${objectCount} objects without data loss`, () => {
        const { doc, objects } = createBoardDoc();

        for (let i = 0; i < objectCount; i++) {
          addObject(
            objects,
            makeStickyNote(`stress-${i}`, {
              x: (i % 50) * 200,
              y: Math.floor(i / 50) * 200,
            }),
          );
        }

        expect(objects.size).toBe(objectCount);

        // Simulate persistence round-trip (encode → new doc → decode)
        const snapshot = Y.encodeStateAsUpdate(doc);

        const { doc: restored, objects: restoredObjects } = createBoardDoc();
        Y.applyUpdate(restored, snapshot);

        expect(restoredObjects.size).toBe(objectCount);
        expect(getAllObjects(restoredObjects)).toHaveLength(objectCount);

        // Spot-check first, middle, and last
        expect(restoredObjects.get('stress-0')).toBeDefined();
        expect(restoredObjects.get(`stress-${Math.floor(objectCount / 2)}`)).toBeDefined();
        expect(restoredObjects.get(`stress-${objectCount - 1}`)).toBeDefined();
      });
    });

    it('handles 500 rapid sequential updates without losing the final state', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();

      addObject(objects1, makeStickyNote('target'));

      // Simulate 500 rapid position updates
      for (let i = 0; i < 500; i++) {
        updateObject(objects1, 'target', { x: i * 10, y: i * 5 });
      }

      // Encode and restore — final position should survive
      const snapshot = Y.encodeStateAsUpdate(doc1);
      const { doc: doc2, objects: objects2 } = createBoardDoc();
      Y.applyUpdate(doc2, snapshot);

      const restored = objects2.get('target');
      expect(restored?.x).toBe(4990); // 499 * 10
      expect(restored?.y).toBe(2495); // 499 * 5
    });

    [
      { objectCount: 500, maxLatencyMs: 100 },
      { objectCount: 1000, maxLatencyMs: 180 },
      { objectCount: 2000, maxLatencyMs: 320 },
    ].forEach(({ objectCount, maxLatencyMs }) => {
      it(`syncs a ${objectCount}-object snapshot to another doc within ${maxLatencyMs}ms locally`, () => {
        const { doc: sourceDoc, objects: sourceObjects } = createBoardDoc();
        const { doc: targetDoc, objects: targetObjects } = createBoardDoc();

        for (let i = 0; i < objectCount; i++) {
          addObject(
            sourceObjects,
            makeStickyNote(`latency-${i}`, {
              x: (i % 50) * 150,
              y: Math.floor(i / 50) * 150,
            }),
          );
        }

        const startedAt = performance.now();
        const update = Y.encodeStateAsUpdate(sourceDoc);
        Y.applyUpdate(targetDoc, update);
        const elapsedMs = performance.now() - startedAt;

        expect(targetObjects.size).toBe(objectCount);
        expect(elapsedMs).toBeLessThan(maxLatencyMs);
      });
    });
  });

  describe('Reconnect and recovery', () => {
    it('restores full board state after simulated disconnect/reconnect via snapshot', () => {
      // Simulates: client A populates board → snapshot saved → client B joins fresh doc → gets snapshot
      const { doc: clientA, objects: objectsA } = createBoardDoc();

      for (let i = 0; i < 10; i++) {
        addObject(objectsA, makeStickyNote(`item-${i}`, { x: i * 200, y: 0 }));
      }

      // Simulate snapshot save (encode full state) and restore to a fresh doc
      const snapshot = Y.encodeStateAsUpdate(clientA);

      // Fresh client joins (simulating reconnect or new browser tab)
      const { doc: clientB, objects: objectsB } = createBoardDoc();
      Y.applyUpdate(clientB, snapshot);

      expect(objectsB.size).toBe(10);
      for (let i = 0; i < 10; i++) {
        const obj = objectsB.get(`item-${i}`);
        expect(obj).toBeDefined();
        expect(obj?.x).toBe(i * 200);
      }
    });

    it('merges in-flight changes made during disconnection after reconnect', () => {
      // Client A connected; Client B disconnects; B makes offline changes;
      // B reconnects and exchanges state with A — no data lost.
      const { doc: docA, objects: objectsA } = createBoardDoc();
      const { doc: docB, objects: objectsB } = createBoardDoc();

      // Initial shared state
      addObject(objectsA, makeStickyNote('shared', { x: 0, y: 0 }));
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      // Client B goes offline — makes local-only changes
      addObject(objectsB, makeStickyNote('offline-b', { x: 500, y: 500 }));

      // Client A makes online changes while B is disconnected
      updateObject(objectsA, 'shared', { x: 100 });
      addObject(objectsA, makeStickyNote('online-a', { x: 800, y: 0 }));

      // B reconnects: bidirectional sync
      Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      // Both should converge: shared (updated by A), offline-b, online-a
      expect(objectsA.size).toBe(3);
      expect(objectsB.size).toBe(3);

      expect(objectsA.get('shared')?.x).toBe(100);
      expect(objectsB.get('shared')?.x).toBe(100);
      expect(objectsA.get('offline-b')).toBeDefined();
      expect(objectsB.get('online-a')).toBeDefined();
    });
  });
});
