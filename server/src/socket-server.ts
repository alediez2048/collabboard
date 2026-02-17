import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifySupabaseToken } from './auth';

interface CursorMoveEvent {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

export function setupSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://collabboard-gauntlet.vercel.app']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    },
  });

  console.log('[Socket.io] Server initialized');

  io.on('connection', async (socket: Socket) => {
    try {
      // Verify JWT from handshake auth
      const token = socket.handshake.auth.token;

      if (!token) {
        console.error('[Socket.io] Connection rejected: No token provided');
        socket.disconnect(true);
        return;
      }

      const user = await verifySupabaseToken(token);

      if (!user) {
        console.error('[Socket.io] Connection rejected: Invalid token');
        socket.disconnect(true);
        return;
      }

      console.log(`[Socket.io] User ${user.email} connected (${socket.id})`);

      // Handle joining a board room
      socket.on('join-board', (boardId: string) => {
        socket.join(boardId);
        console.log(
          `[Socket.io] User ${user.email} joined board room: ${boardId}`
        );
      });

      // Handle cursor movement
      socket.on('cursor:move', (data: CursorMoveEvent) => {
        // Broadcast to all other clients in the same rooms (excluding sender)
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
    } catch (error) {
      console.error('[Socket.io] Connection error:', error);
      socket.disconnect(true);
    }
  });

  return io;
}
