import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, updateObject, removeObject, getObject } from '@/lib/yjs/board-doc';
import type { BoardObject } from '@/lib/yjs/board-doc';

describe('Sticky Note CRUD Operations', () => {
  describe('Create sticky note', () => {
    it('creates a sticky note with all required properties', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: crypto.randomUUID(),
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Hello World',
          color: '#ffeb3b', // yellow
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      const retrieved = getObject(objects, stickyNote.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('sticky_note');
      expect(retrieved?.x).toBe(100);
      expect(retrieved?.y).toBe(200);
      expect(retrieved?.width).toBe(200);
      expect(retrieved?.height).toBe(200);
      expect(retrieved?.properties.text).toBe('Hello World');
      expect(retrieved?.properties.color).toBe('#ffeb3b');
    });

    it('creates a sticky note with default empty text', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: crypto.randomUUID(),
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: '',
          color: '#ffeb3b',
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      const retrieved = getObject(objects, stickyNote.id);
      expect(retrieved?.properties.text).toBe('');
    });
  });

  describe('Update sticky note position', () => {
    it('updates x and y coordinates', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b',
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      // Update position
      updateObject(objects, 'sticky-1', { x: 300, y: 400 });

      const updated = getObject(objects, 'sticky-1');
      expect(updated?.x).toBe(300);
      expect(updated?.y).toBe(400);
      // Other properties should remain unchanged
      expect(updated?.width).toBe(200);
      expect(updated?.height).toBe(200);
      expect(updated?.properties.text).toBe('Test');
    });

    it('updates updatedAt timestamp on position change', () => {
      const { objects } = createBoardDoc();

      const originalTime = new Date('2024-01-01').toISOString();
      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b',
        },
        createdBy: 'user-123',
        updatedAt: originalTime,
      };

      addObject(objects, stickyNote);

      // Update position
      updateObject(objects, 'sticky-1', { x: 300 });

      const updated = getObject(objects, 'sticky-1');
      expect(updated?.updatedAt).not.toBe(originalTime);
    });
  });

  describe('Update sticky note text', () => {
    it('updates text property', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Original text',
          color: '#ffeb3b',
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      // Update text
      updateObject(objects, 'sticky-1', {
        properties: { text: 'Updated text', color: '#ffeb3b' },
      });

      const updated = getObject(objects, 'sticky-1');
      expect(updated?.properties.text).toBe('Updated text');
      // Position should remain unchanged
      expect(updated?.x).toBe(100);
      expect(updated?.y).toBe(200);
    });

    it('handles empty text', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Some text',
          color: '#ffeb3b',
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      // Clear text
      updateObject(objects, 'sticky-1', {
        properties: { text: '', color: '#ffeb3b' },
      });

      const updated = getObject(objects, 'sticky-1');
      expect(updated?.properties.text).toBe('');
    });
  });

  describe('Update sticky note color', () => {
    it('updates color property', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b', // yellow
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);

      // Change color to pink
      updateObject(objects, 'sticky-1', {
        properties: { text: 'Test', color: '#f48fb1' },
      });

      const updated = getObject(objects, 'sticky-1');
      expect(updated?.properties.color).toBe('#f48fb1');
      expect(updated?.properties.text).toBe('Test');
    });

    it('supports multiple predefined colors', () => {
      const { objects } = createBoardDoc();

      const colors = [
        '#ffeb3b', // yellow
        '#f48fb1', // pink
        '#90caf9', // blue
        '#a5d6a7', // green
        '#ffcc80', // orange
        '#ce93d8', // purple
      ];

      colors.forEach((color, index) => {
        const stickyNote: BoardObject = {
          id: `sticky-${index}`,
          type: 'sticky_note',
          x: 100,
          y: 200,
          width: 200,
          height: 200,
          rotation: 0,
          zIndex: 1,
          properties: {
            text: 'Test',
            color,
          },
          createdBy: 'user-123',
          updatedAt: new Date().toISOString(),
        };

        addObject(objects, stickyNote);

        const retrieved = getObject(objects, `sticky-${index}`);
        expect(retrieved?.properties.color).toBe(color);
      });
    });
  });

  describe('Delete sticky note', () => {
    it('removes sticky note from Y.Map', () => {
      const { objects } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b',
        },
        createdBy: 'user-123',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects, stickyNote);
      expect(objects.size).toBe(1);

      removeObject(objects, 'sticky-1');

      expect(objects.size).toBe(0);
      expect(getObject(objects, 'sticky-1')).toBeUndefined();
    });
  });

  describe('Remote update synchronization', () => {
    it('syncs sticky note creation between two documents', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Synced note',
          color: '#ffeb3b',
        },
        createdBy: 'user-A',
        updatedAt: new Date().toISOString(),
      };

      // Create in doc1
      addObject(objects1, stickyNote);

      // Sync to doc2
      const state = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state);

      // Verify doc2 has the sticky note
      const synced = getObject(objects2, 'sticky-1');
      expect(synced).toBeDefined();
      expect(synced?.type).toBe('sticky_note');
      expect(synced?.properties.text).toBe('Synced note');
      expect(synced?.properties.color).toBe('#ffeb3b');
    });

    it('syncs sticky note position updates', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Initial state
      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b',
        },
        createdBy: 'user-A',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects1, stickyNote);
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Update position in doc1
      updateObject(objects1, 'sticky-1', { x: 500, y: 600 });

      // Sync update to doc2
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Verify doc2 has the updated position
      const synced = getObject(objects2, 'sticky-1');
      expect(synced?.x).toBe(500);
      expect(synced?.y).toBe(600);
    });

    it('syncs sticky note text updates', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Initial state
      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Original',
          color: '#ffeb3b',
        },
        createdBy: 'user-A',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects1, stickyNote);
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Update text in doc1
      updateObject(objects1, 'sticky-1', {
        properties: { text: 'Updated from remote', color: '#ffeb3b' },
      });

      // Sync update to doc2
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Verify doc2 has the updated text
      const synced = getObject(objects2, 'sticky-1');
      expect(synced?.properties.text).toBe('Updated from remote');
    });

    it('syncs sticky note color changes', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Initial state
      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b', // yellow
        },
        createdBy: 'user-A',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects1, stickyNote);
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Change color in doc1
      updateObject(objects1, 'sticky-1', {
        properties: { text: 'Test', color: '#f48fb1' }, // pink
      });

      // Sync update to doc2
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Verify doc2 has the updated color
      const synced = getObject(objects2, 'sticky-1');
      expect(synced?.properties.color).toBe('#f48fb1');
    });

    it('syncs sticky note deletion', () => {
      const { doc: doc1, objects: objects1 } = createBoardDoc();
      const { doc: doc2, objects: objects2 } = createBoardDoc();

      // Initial state
      const stickyNote: BoardObject = {
        id: 'sticky-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 1,
        properties: {
          text: 'Test',
          color: '#ffeb3b',
        },
        createdBy: 'user-A',
        updatedAt: new Date().toISOString(),
      };

      addObject(objects1, stickyNote);
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Both docs should have the note
      expect(objects2.size).toBe(1);

      // Delete in doc1
      removeObject(objects1, 'sticky-1');

      // Sync deletion to doc2
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Verify doc2 no longer has the note
      expect(objects2.size).toBe(0);
      expect(getObject(objects2, 'sticky-1')).toBeUndefined();
    });
  });
});
