'use client';

/**
 * RemoteCursorsLayer
 *
 * An isolated Konva <Layer> that owns its own cursor state and socket
 * subscription. By keeping cursor state here instead of in Canvas, cursor
 * updates never trigger re-renders of sticky notes, the grid, or any other
 * Canvas children — eliminating the primary source of cursor glitchiness.
 */

import { useEffect, useRef, useState } from 'react';
import { Layer } from 'react-konva';
import { Socket } from 'socket.io-client';
import { onCursorMove, type CursorMoveEvent } from '@/lib/sync/cursor-socket';
import { RemoteCursor } from './RemoteCursor';

interface RemoteCursorsLayerProps {
  socket: Socket;
  currentUserId: string;
}

const STALE_CURSOR_MS = 5000; // remove cursor after 5 s of silence
const STALE_CHECK_INTERVAL_MS = 1000;

export function RemoteCursorsLayer({
  socket,
  currentUserId,
}: RemoteCursorsLayerProps) {
  const [cursors, setCursors] = useState<
    Map<string, CursorMoveEvent & { timestamp: number }>
  >(new Map());

  // Keep a ref so the stale-cleanup interval can read the latest map without
  // being recreated every time the map changes.
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;

  // Subscribe to remote cursor events
  useEffect(() => {
    const handleCursorMove = (data: CursorMoveEvent): void => {
      // Never show own cursor
      if (data.userId === currentUserId) return;

      setCursors((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { ...data, timestamp: Date.now() });
        return next;
      });
    };

    onCursorMove(socket, handleCursorMove);

    return () => {
      socket.off('cursor:move', handleCursorMove);
    };
  }, [socket, currentUserId]);

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

  return (
    <Layer listening={false}>
      {Array.from(cursors.values()).map((cursor) => (
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
