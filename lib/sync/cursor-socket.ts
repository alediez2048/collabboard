import { io, Socket } from 'socket.io-client';

export interface CursorMoveEvent {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

export interface CursorSocketOptions {
  boardId: string;
  token: string;
}

/**
 * Create a Socket.io connection for cursor broadcast.
 * Handles authentication and room joining.
 * 
 * @param options - Configuration including boardId and auth token
 * @returns Socket instance
 */
export function createCursorSocket(options: CursorSocketOptions): Socket {
  const { boardId, token } = options;

  // Get Socket.io URL from environment or use localhost
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

  console.log(`[Cursor Socket] Connecting to ${wsUrl}`);

  // Create Socket.io client with authentication
  const socket = io(wsUrl, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('[Cursor Socket] Connected');
    // Join the board room
    socket.emit('join-board', boardId);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Cursor Socket] Disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('[Cursor Socket] Connection error:', error);
  });

  return socket;
}

/**
 * Emit a cursor move event
 * Note: In TICKET-05, this will be throttled to 20-30Hz
 */
export function emitCursorMove(
  socket: Socket,
  data: CursorMoveEvent
): void {
  socket.emit('cursor:move', data);
}

/**
 * Listen for remote cursor movements
 */
export function onCursorMove(
  socket: Socket,
  callback: (data: CursorMoveEvent) => void
): void {
  socket.on('cursor:move', callback);
}

/**
 * Disconnect and clean up socket
 */
export function disconnectSocket(socket: Socket): void {
  console.log('[Cursor Socket] Disconnecting...');
  socket.disconnect();
}
