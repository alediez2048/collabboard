import type { CursorMoveEvent } from './cursor-socket';

export const DEFAULT_MAX_PENDING_CURSOR_EVENTS = 200;

export function enqueueCursorEvent(
  queue: Map<string, CursorMoveEvent>,
  event: CursorMoveEvent,
  maxQueueSize = DEFAULT_MAX_PENDING_CURSOR_EVENTS,
): void {
  if (queue.has(event.userId)) {
    queue.set(event.userId, event);
    return;
  }

  const safeMaxQueueSize =
    Number.isFinite(maxQueueSize) && maxQueueSize > 0
      ? Math.floor(maxQueueSize)
      : DEFAULT_MAX_PENDING_CURSOR_EVENTS;

  if (queue.size >= safeMaxQueueSize) {
    const oldestUserId = queue.keys().next().value;
    if (typeof oldestUserId === 'string') {
      queue.delete(oldestUserId);
    }
  }

  queue.set(event.userId, event);
}
