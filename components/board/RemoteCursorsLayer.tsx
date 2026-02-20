'use client';

/**
 * RemoteCursorsLayer
 *
 * An isolated Konva <Layer> that owns its own cursor state and socket
 * subscription. By keeping cursor state here instead of in Canvas, cursor
 * updates never trigger re-renders of sticky notes, the grid, or any other
 * Canvas children — eliminating the primary source of cursor glitchiness.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer } from 'react-konva';
import { Socket } from 'socket.io-client';
import { onCursorMove, type CursorMoveEvent } from '@/lib/sync/cursor-socket';
import {
  DEFAULT_MAX_PENDING_CURSOR_EVENTS,
  enqueueCursorEvent,
} from '@/lib/sync/cursor-queue';
import { RemoteCursor } from './RemoteCursor';

interface RemoteCursorsLayerProps {
  socket: Socket;
  currentUserId: string;
  onLatencySample?: (latencyMs: number) => void;
}

const STALE_CURSOR_MS = 5000; // remove cursor after 5 s of silence
const STALE_CHECK_INTERVAL_MS = 1000;
const MAX_PENDING_CURSOR_EVENTS = DEFAULT_MAX_PENDING_CURSOR_EVENTS;

export function RemoteCursorsLayer({
  socket,
  currentUserId,
  onLatencySample,
}: RemoteCursorsLayerProps) {
  const [cursors, setCursors] = useState<
    Map<string, CursorMoveEvent & { timestamp: number }>
  >(new Map());
  const pendingCursorEventsRef = useRef<Map<string, CursorMoveEvent>>(new Map());
  const frameIdRef = useRef<number | null>(null);
  const cursorMetricsRef = useRef({
    receivedInWindow: 0,
    flushedInWindow: 0,
    lastLogAt: 0,
  });

  // Keep a ref so the stale-cleanup interval can read the latest map without
  // being recreated every time the map changes.
  const cursorsRef = useRef(cursors);

  useEffect(() => {
    cursorsRef.current = cursors;
  }, [cursors]);

  // Subscribe to remote cursor events
  useEffect(() => {
    const pendingCursorEvents = pendingCursorEventsRef.current;

    const flushQueuedCursorEvents = (): void => {
      frameIdRef.current = null;
      if (pendingCursorEvents.size === 0) return;
      const queuedEntries = Array.from(pendingCursorEvents.entries());
      pendingCursorEvents.clear();

      const timestamp = Date.now();
      setCursors((prev) => {
        const next = new Map(prev);
        for (const [userId, cursor] of queuedEntries) {
          next.set(userId, { ...cursor, timestamp });
        }
        return next;
      });

      if (process.env.NODE_ENV === 'development') {
        const now = Date.now();
        const metrics = cursorMetricsRef.current;
        metrics.flushedInWindow += 1;

        if (metrics.lastLogAt === 0) {
          metrics.lastLogAt = now;
          return;
        }

        const elapsedMs = now - metrics.lastLogAt;
        if (elapsedMs >= 5000) {
          console.debug('[RemoteCursors Perf] inbound throughput', {
            receivedPerSecond: Number(
              (metrics.receivedInWindow / (elapsedMs / 1000)).toFixed(1),
            ),
            flushesPerSecond: Number(
              (metrics.flushedInWindow / (elapsedMs / 1000)).toFixed(1),
            ),
            activeCursors: cursorsRef.current.size,
          });
          metrics.receivedInWindow = 0;
          metrics.flushedInWindow = 0;
          metrics.lastLogAt = now;
        }
      }
    };

    const scheduleCursorFlush = (): void => {
      if (frameIdRef.current !== null) return;
      frameIdRef.current = window.requestAnimationFrame(flushQueuedCursorEvents);
    };

    const handleCursorMove = (data: CursorMoveEvent): void => {
      // Never show own cursor
      if (data.userId === currentUserId) return;

      if (typeof data.sentAt === 'number') {
        const latencyMs = Date.now() - data.sentAt;
        if (latencyMs >= 0 && latencyMs <= 5000) {
          onLatencySample?.(latencyMs);
        }
      }

      enqueueCursorEvent(
        pendingCursorEvents,
        data,
        MAX_PENDING_CURSOR_EVENTS,
      );
      scheduleCursorFlush();

      if (process.env.NODE_ENV === 'development') {
        cursorMetricsRef.current.receivedInWindow += 1;
      }
    };

    onCursorMove(socket, handleCursorMove);

    return () => {
      if (frameIdRef.current !== null) {
        window.cancelAnimationFrame(frameIdRef.current);
      }
      pendingCursorEvents.clear();
      socket.off('cursor:move', handleCursorMove);
    };
  }, [socket, currentUserId, onLatencySample]);

  // Periodically remove cursors that haven't moved in STALE_CURSOR_MS
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const current = cursorsRef.current;
      let hasStale = false;

      for (const cursor of current.values()) {
        if (now - cursor.timestamp > STALE_CURSOR_MS) {
          hasStale = true;
          break;
        }
      }

      if (!hasStale) return; // skip re-render if nothing to remove

      setCursors((prev) => {
        const next = new Map(prev);
        for (const [userId, cursor] of next.entries()) {
          if (now - cursor.timestamp > STALE_CURSOR_MS) {
            next.delete(userId);
          }
        }
        return next;
      });
    }, STALE_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const renderedCursors = useMemo(() => Array.from(cursors.values()), [cursors]);

  return (
    <Layer listening={false}>
      {renderedCursors.map((cursor) => (
        <RemoteCursor
          key={cursor.userId}
          x={cursor.x}
          y={cursor.y}
          userName={cursor.userName}
          color={cursor.color}
        />
      ))}
    </Layer>
  );
}
