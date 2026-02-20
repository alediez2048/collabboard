import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { addObject, createBoardDoc, getAllObjects, type BoardObject } from '@/lib/yjs/board-doc';

function makeStickyNote(id: string, userId: string, x: number, y: number): BoardObject {
  return {
    id,
    type: 'sticky_note',
    x,
    y,
    width: 200,
    height: 200,
    rotation: 0,
    zIndex: 1,
    properties: { text: id, color: '#ffeb3b' },
    createdBy: userId,
    updatedAt: new Date().toISOString(),
  };
}

describe('AI shared-state requirements', () => {
  it('propagates AI-generated objects to other users in real-time sync', () => {
    const { doc: sourceDoc, objects: sourceObjects } = createBoardDoc();
    const { doc: targetDoc, objects: targetObjects } = createBoardDoc();

    // Simulate active multiplayer sync channel: every source update is broadcast.
    sourceDoc.on('update', (update: Uint8Array) => {
      Y.applyUpdate(targetDoc, update);
    });

    for (let index = 0; index < 25; index += 1) {
      addObject(
        sourceObjects,
        makeStickyNote(`ai-note-${index + 1}`, 'ai-user', 120 + index * 20, 120 + index * 15),
      );
    }

    expect(sourceObjects.size).toBe(25);
    expect(targetObjects.size).toBe(25);
    expect(getAllObjects(targetObjects)).toHaveLength(25);
    expect(targetObjects.get('ai-note-1')).toBeDefined();
    expect(targetObjects.get('ai-note-25')).toBeDefined();
  });

  it('merges simultaneous AI command batches from two users without conflicts', () => {
    const { doc: userADoc, objects: userAObjects } = createBoardDoc();
    const { doc: userBDoc, objects: userBObjects } = createBoardDoc();

    // User A batch (offline interval)
    for (let index = 0; index < 10; index += 1) {
      addObject(
        userAObjects,
        makeStickyNote(`a-note-${index + 1}`, 'ai-user-a', 100 + index * 30, 100),
      );
    }

    // User B batch (offline interval)
    for (let index = 0; index < 10; index += 1) {
      addObject(
        userBObjects,
        makeStickyNote(`b-note-${index + 1}`, 'ai-user-b', 100 + index * 30, 500),
      );
    }

    // Simulate reconnect sync exchange in both directions.
    const updateA = Y.encodeStateAsUpdate(userADoc);
    const updateB = Y.encodeStateAsUpdate(userBDoc);
    Y.applyUpdate(userADoc, updateB);
    Y.applyUpdate(userBDoc, updateA);

    expect(userAObjects.size).toBe(20);
    expect(userBObjects.size).toBe(20);
    expect(userAObjects.get('a-note-1')).toBeDefined();
    expect(userAObjects.get('b-note-1')).toBeDefined();
    expect(userBObjects.get('a-note-10')).toBeDefined();
    expect(userBObjects.get('b-note-10')).toBeDefined();
  });
});
