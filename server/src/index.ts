import 'dotenv/config';
import express from 'express';
import { createServer, IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { setupYjsServer } from './yjs-server';
import { setupSocketIO } from './socket-server';
import { aiRouter } from './ai-routes';
import { Duplex } from 'stream';

const app = express();
const server = createServer(app);

// Enable CORS for API routes — allow Vercel preview/deployment URLs in production
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
            const vercelPattern = /^https:\/\/collabboard-gauntlet[A-Za-z0-9-]*\.vercel\.app$/;
            if (!origin || vercelPattern.test(origin)) {
              cb(null, true);
            } else {
              cb(new Error(`Origin ${origin} not allowed by CORS`));
            }
          }
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI bridge routes (called by Next.js /api/ai/command)
app.use('/ai', aiRouter);

// Setup y-websocket with noServer so we control the upgrade routing manually
const wss = new WebSocketServer({ noServer: true });

setupYjsServer(wss);

// Setup Socket.io for cursor broadcast
setupSocketIO(server);

// Handle WebSocket upgrade manually to route correctly
// y-websocket client sends to /yjs/{roomName}, so we need prefix matching
server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
  const url = request.url || '';

  // Let Socket.io handle its own path
  if (url.startsWith('/socket.io/')) {
    return;
  }

  // Route y-websocket connections (any path starting with /yjs)
  if (url.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  socket.destroy();
});

// Start server
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  CollabBoard Real-Time Sync Server     ║
╚════════════════════════════════════════╝

Server running on port ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}

Services:
- y-websocket: ws://localhost:${PORT}/yjs
- Socket.io:   http://localhost:${PORT}
- Health:      http://localhost:${PORT}/health

Ready to accept connections...
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[Server] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});
