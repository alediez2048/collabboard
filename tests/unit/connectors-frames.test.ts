import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createBoardDoc, addObject, getObject, updateObject, type BoardObject } from '@/lib/yjs/board-doc';

describe('Connector + Frame via Yjs', () => {
  it('creates a connector linking two object IDs', () => {
    const { objects } = createBoardDoc();
    const connector: BoardObject = {
      id: 'conn-1',
      type: 'connector',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { fromId: 'obj-a', toId: 'obj-b', color: '#1d4ed8', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, connector);
    const retrieved = getObject(objects, 'conn-1');
    expect(retrieved?.type).toBe('connector');
    expect(retrieved?.properties.fromId).toBe('obj-a');
    expect(retrieved?.properties.toId).toBe('obj-b');
  });

  it('creates a frame with title and dimensions', () => {
    const { objects } = createBoardDoc();
    const frame: BoardObject = {
      id: 'frame-1',
      type: 'frame',
      x: 100, y: 100, width: 400, height: 300,
      rotation: 0, zIndex: 0,
      properties: { title: 'My Frame', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, frame);
    const retrieved = getObject(objects, 'frame-1');
    expect(retrieved?.type).toBe('frame');
    expect(retrieved?.properties.title).toBe('My Frame');
    expect(retrieved?.width).toBe(400);
  });

  it('syncs connector between two Y.Docs', () => {
    const { doc: doc1, objects: objects1 } = createBoardDoc();
    const { doc: doc2, objects: objects2 } = createBoardDoc();
    const connector: BoardObject = {
      id: 'conn-sync',
      type: 'connector',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0, zIndex: 1,
      properties: { fromId: 'a', toId: 'b', color: '#ef4444', strokeWidth: 2 },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects1, connector);
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
    expect(getObject(objects2, 'conn-sync')?.properties.fromId).toBe('a');
  });

  it('updates frame title', () => {
    const { objects } = createBoardDoc();
    const frame: BoardObject = {
      id: 'frame-title',
      type: 'frame',
      x: 0, y: 0, width: 300, height: 200,
      rotation: 0, zIndex: 0,
      properties: { title: 'Old Title', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' },
      createdBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    addObject(objects, frame);
    updateObject(objects, 'frame-title', { properties: { title: 'New Title', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' } });
    expect(getObject(objects, 'frame-title')?.properties.title).toBe('New Title');
  });
});
