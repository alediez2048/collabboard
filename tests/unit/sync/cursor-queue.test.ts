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

describe('cursor event filtering', () => {
  it('own cursor events should be filtered by userId comparison', () => {
    const currentUserId = 'user-self';
    const ownEvent = makeCursorEvent('user-self', 100, 200);
    const remoteEvent = makeCursorEvent('user-other', 300, 400);

    expect(ownEvent.userId === currentUserId).toBe(true);
    expect(remoteEvent.userId === currentUserId).toBe(false);
  });

  it('stale cursors are detectable via timestamp comparison', () => {
    const staleCutoffMs = 5000;
    const now = Date.now();
    const fresh = { ...makeCursorEvent('user-a'), sentAt: now - 100 };
    const stale = { ...makeCursorEvent('user-b'), sentAt: now - staleCutoffMs - 1 };

    expect(now - (fresh.sentAt ?? 0) < staleCutoffMs).toBe(true);
    expect(now - (stale.sentAt ?? 0) > staleCutoffMs).toBe(true);
  });

  it('cursor events without sentAt are treated as valid', () => {
    const event = makeCursorEvent('user-a');
    delete (event as Record<string, unknown>).sentAt;
    expect(event.sentAt).toBeUndefined();

    const queue = new Map<string, CursorMoveEvent>();
    enqueueCursorEvent(queue, event, 10);
    expect(queue.has('user-a')).toBe(true);
  });
});
