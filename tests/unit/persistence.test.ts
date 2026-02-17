import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

describe('Yjs snapshot encode/decode', () => {
  it('restores full Y.Map state from snapshot', () => {
    const doc1 = new Y.Doc();
    const objects = doc1.getMap('objects');
    objects.set('note-1', { id: 'note-1', type: 'sticky_note', x: 100, y: 200 });

    // Serialize
    const snapshot = Y.encodeStateAsUpdate(doc1);

    // Restore into new doc
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, snapshot);

    const restored = doc2.getMap('objects');
    expect(restored.get('note-1')).toEqual({ id: 'note-1', type: 'sticky_note', x: 100, y: 200 });
  });

  it('round-trips through Buffer (simulates bytea storage)', () => {
    const doc1 = new Y.Doc();
    doc1.getMap('objects').set('test', { value: 42 });

    const snapshot = Y.encodeStateAsUpdate(doc1);
    // Simulate Supabase bytea round-trip
    const stored = Buffer.from(snapshot);
    const retrieved = new Uint8Array(stored);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, retrieved);

    expect(doc2.getMap('objects').get('test')).toEqual({ value: 42 });
  });

  it('CRDT merges two concurrent snapshots correctly', () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    doc1.getMap('objects').set('a', { from: 1 });
    doc2.getMap('objects').set('b', { from: 2 });

    // Merge both into doc3
    const doc3 = new Y.Doc();
    Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc1));
    Y.applyUpdate(doc3, Y.encodeStateAsUpdate(doc2));

    expect(doc3.getMap('objects').get('a')).toEqual({ from: 1 });
    expect(doc3.getMap('objects').get('b')).toEqual({ from: 2 });
  });

  it('snapshot of empty doc restores to empty Y.Map', () => {
    const doc1 = new Y.Doc();
    // Empty doc — no objects
    const snapshot = Y.encodeStateAsUpdate(doc1);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, snapshot);

    expect(doc2.getMap('objects').size).toBe(0);
  });

  it('snapshot preserves multiple objects', () => {
    const doc1 = new Y.Doc();
    const objects = doc1.getMap('objects');
    objects.set('note-1', { id: 'note-1', type: 'sticky_note', x: 100, y: 200 });
    objects.set('note-2', { id: 'note-2', type: 'sticky_note', x: 300, y: 400 });
    objects.set('note-3', { id: 'note-3', type: 'sticky_note', x: 500, y: 600 });

    const snapshot = Y.encodeStateAsUpdate(doc1);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, snapshot);

    const restored = doc2.getMap('objects');
    expect(restored.size).toBe(3);
    expect(restored.get('note-1')).toEqual({ id: 'note-1', type: 'sticky_note', x: 100, y: 200 });
    expect(restored.get('note-2')).toEqual({ id: 'note-2', type: 'sticky_note', x: 300, y: 400 });
    expect(restored.get('note-3')).toEqual({ id: 'note-3', type: 'sticky_note', x: 500, y: 600 });
  });

  it('applying snapshot to non-empty doc merges (does not clear existing state)', () => {
    const doc1 = new Y.Doc();
    doc1.getMap('objects').set('existing', { id: 'existing' });

    const doc2 = new Y.Doc();
    doc2.getMap('objects').set('incoming', { id: 'incoming' });

    // Apply doc2 snapshot into doc1
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));

    const merged = doc1.getMap('objects');
    expect(merged.get('existing')).toEqual({ id: 'existing' });
    expect(merged.get('incoming')).toEqual({ id: 'incoming' });
  });
});
