import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifySupabaseToken } from './auth';

interface CursorMoveEvent {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
  sentAt?: number;
}

function getAllowedOrigins(): string[] | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void) {
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }

  const vercelPattern = /^https:\/\/collabboard-gauntlet[A-Za-z0-9-]*\.vercel\.app$/;

  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void => {
    if (!origin || vercelPattern.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    }
  };
}

export function setupSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  console.log('[Socket.io] Server initialized');

  // Auth middleware — runs before 'connection' fires, so the connection
  // handler is fully synchronous and all listeners are registered immediately.
  // This prevents the race condition where 'join-board' arrives before the
  // async token verification completes inside the connection handler.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        console.error('[Socket.io] Connection rejected: No token provided');
        return next(new Error('No token provided'));
      }

      const user = await verifySupabaseToken(token);

      if (!user) {
        console.error('[Socket.io] Connection rejected: Invalid token');
        return next(new Error('Invalid token'));
      }

      // Attach verified user to socket data for use in connection handler
      socket.data.user = user;
      next();
    } catch (error) {
      console.error('[Socket.io] Auth middleware error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Connection handler is now fully synchronous — all listeners registered immediately
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { email: string };

    console.log(`[Socket.io] User ${user.email} connected (${socket.id})`);

    // Handle joining a board room
    socket.on('join-board', (boardId: string) => {
      socket.join(boardId);
      console.log(`[Socket.io] User ${user.email} joined board room: ${boardId}`);
    });

    // Handle cursor movement — broadcast to all other clients in the same room
    socket.on('cursor:move', (data: CursorMoveEvent) => {
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.to(room).emit('cursor:move', data);
        }
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[Socket.io] User ${user.email} disconnected (${socket.id})`);
    });
  });

  return io;
}
