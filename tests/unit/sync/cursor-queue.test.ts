import { describe, expect, it } from 'vitest';
import { enqueueCursorEvent } from '@/lib/sync/cursor-queue';
import type { CursorMoveEvent } from '@/lib/sync/cursor-socket';

function makeCursorEvent(userId: string, x = 0, y = 0): CursorMoveEvent {
  return {
    userId,
    userName: userId,
    x,
    y,
    color: '#3b82f6',
    sentAt: Date.now(),
  };
}

describe('enqueueCursorEvent', () => {
  it('updates an existing user without increasing queue size', () => {
    const queue = new Map<string, CursorMoveEvent>([
      ['user-a', makeCursorEvent('user-a', 10, 20)],
    ]);

    enqueueCursorEvent(queue, makeCursorEvent('user-a', 50, 60), 1);

    expect(queue.size).toBe(1);
    expect(queue.get('user-a')?.x).toBe(50);
    expect(queue.get('user-a')?.y).toBe(60);
  });

  it('evicts the oldest queued user when a new user exceeds max size', () => {
    const queue = new Map<string, CursorMoveEvent>([
      ['user-a', makeCursorEvent('user-a')],
      ['user-b', makeCursorEvent('user-b')],
    ]);

    enqueueCursorEvent(queue, makeCursorEvent('user-c'), 2);

    expect(queue.size).toBe(2);
    expect(queue.has('user-a')).toBe(false);
    expect(queue.has('user-b')).toBe(true);
    expect(queue.has('user-c')).toBe(true);
  });
});
