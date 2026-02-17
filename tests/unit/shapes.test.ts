import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, getObject, updateObject, removeObject, type BoardObject } from '@/lib/yjs/board-doc';

describe('Shape CRUD via Yjs', () => {
  it('creates a rectangle with correct properties', () => {
    const { objects } = createBoardDoc();
    const rect: BoardObject = {
      id: 'rect-1',
      type: 'rectangle',
      x: 100, y: 100, width: 200, height: 150,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, rect);
    const retrieved = getObject(objects, 'rect-1');
    expect(retrieved?.type).toBe('rectangle');
    expect(retrieved?.x).toBe(100);
    expect(retrieved?.y).toBe(100);
    expect(retrieved?.width).toBe(200);
    expect(retrieved?.height).toBe(150);
    expect(retrieved?.properties.fillColor).toBe('#93c5fd');
    expect(retrieved?.properties.strokeColor).toBe('#1d4ed8');
    expect(retrieved?.properties.strokeWidth).toBe(2);
  });

  it('creates a circle with correct properties', () => {
    const { objects } = createBoardDoc();
    const circle: BoardObject = {
      id: 'circle-1',
      type: 'circle',
      x: 200, y: 200, width: 100, height: 100,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#6ee7b7', strokeColor: '#059669', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, circle);
    const retrieved = getObject(objects, 'circle-1');
    expect(retrieved?.type).toBe('circle');
    expect(retrieved?.properties.fillColor).toBe('#6ee7b7');
  });

  it('creates a line with x2/y2 endpoint properties', () => {
    const { objects } = createBoardDoc();
    const line: BoardObject = {
      id: 'line-1',
      type: 'line',
      x: 50, y: 80, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { strokeColor: '#374151', strokeWidth: 2, x2: 300, y2: 200 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, line);
    const retrieved = getObject(objects, 'line-1');
    expect(retrieved?.type).toBe('line');
    expect(retrieved?.x).toBe(50);
    expect(retrieved?.y).toBe(80);
    expect(retrieved?.properties.x2).toBe(300);
    expect(retrieved?.properties.y2).toBe(200);
    expect(retrieved?.properties.strokeColor).toBe('#374151');
  });

  it('syncs rectangle between two Y.Docs', () => {
    const { doc: doc1, objects: objects1 } = createBoardDoc();
    const { doc: doc2, objects: objects2 } = createBoardDoc();

    const rect: BoardObject = {
      id: 'rect-sync',
      type: 'rectangle',
      x: 50, y: 50, width: 100, height: 100,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#fde68a', strokeColor: '#d97706', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };

    addObject(objects1, rect);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    const synced = getObject(objects2, 'rect-sync');
    expect(synced?.type).toBe('rectangle');
    expect(synced?.properties.fillColor).toBe('#fde68a');
    expect(synced?.width).toBe(100);
    expect(synced?.height).toBe(100);
  });

  it('syncs line with endpoints between two Y.Docs', () => {
    const { doc: doc1, objects: objects1 } = createBoardDoc();
    const { doc: doc2, objects: objects2 } = createBoardDoc();

    const line: BoardObject = {
      id: 'line-sync',
      type: 'line',
      x: 10, y: 20, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { strokeColor: '#111827', strokeWidth: 3, x2: 400, y2: 300 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };

    addObject(objects1, line);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    const synced = getObject(objects2, 'line-sync');
    expect(synced?.properties.x2).toBe(400);
    expect(synced?.properties.y2).toBe(300);
  });

  it('updates shape fill color', () => {
    const { objects } = createBoardDoc();
    const rect: BoardObject = {
      id: 'rect-color',
      type: 'rectangle',
      x: 0, y: 0, width: 100, height: 100,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, rect);
    updateObject(objects, 'rect-color', {
      properties: { fillColor: '#fca5a5', strokeColor: '#1d4ed8', strokeWidth: 2 },
    });
    expect(getObject(objects, 'rect-color')?.properties.fillColor).toBe('#fca5a5');
  });

  it('updates shape position (drag)', () => {
    const { objects } = createBoardDoc();
    const circle: BoardObject = {
      id: 'circle-move',
      type: 'circle',
      x: 100, y: 100, width: 80, height: 80,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#6ee7b7', strokeColor: '#059669', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, circle);
    updateObject(objects, 'circle-move', { x: 250, y: 350 });
    const moved = getObject(objects, 'circle-move');
    expect(moved?.x).toBe(250);
    expect(moved?.y).toBe(350);
    // Other properties unchanged
    expect(moved?.width).toBe(80);
    expect(moved?.properties.fillColor).toBe('#6ee7b7');
  });

  it('deletes a shape', () => {
    const { objects } = createBoardDoc();
    const rect: BoardObject = {
      id: 'rect-delete',
      type: 'rectangle',
      x: 0, y: 0, width: 50, height: 50,
      rotation: 0, zIndex: 1,
      properties: { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, rect);
    expect(objects.size).toBe(1);
    removeObject(objects, 'rect-delete');
    expect(objects.size).toBe(0);
    expect(getObject(objects, 'rect-delete')).toBeUndefined();
  });

  it('board supports mixed sticky notes and shapes together', () => {
    const { objects } = createBoardDoc();

    const note: BoardObject = {
      id: 'note-1',
      type: 'sticky_note',
      x: 0, y: 0, width: 200, height: 200,
      rotation: 0, zIndex: 1,
      properties: { text: 'hello', color: '#ffeb3b' },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    const rect: BoardObject = {
      id: 'rect-1',
      type: 'rectangle',
      x: 300, y: 300, width: 100, height: 100,
      rotation: 0, zIndex: 2,
      properties: { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };

    addObject(objects, note);
    addObject(objects, rect);

    expect(objects.size).toBe(2);
    expect(getObject(objects, 'note-1')?.type).toBe('sticky_note');
    expect(getObject(objects, 'rect-1')?.type).toBe('rectangle');
  });
});
