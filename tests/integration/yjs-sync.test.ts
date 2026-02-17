import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, getAllObjects, updateObject, removeObject } from '@/lib/yjs/board-doc';

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
});
