import * as Y from 'yjs';
import { WebSocketServer, WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { IncomingMessage } from 'http';
import { verifySupabaseToken } from './auth';

// In-memory storage for Y.Docs (one per board)
// In TICKET-07, we'll add persistence to Supabase
const docs = new Map<string, Y.Doc>();

function getOrCreateDoc(roomName: string): Y.Doc {
  let doc = docs.get(roomName);

  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomName, doc);
    console.log(`[Yjs] Created new document for room: ${roomName}`);
  }

  return doc;
}

export function setupYjsServer(wss: WebSocketServer): void {
  console.log('[Yjs] WebSocket server initialized');

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      // Extract room name and token from URL query params
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const roomName = url.pathname.replace('/yjs/', '').replace(/^\//, '');
      const token = url.searchParams.get('token');

      if (!roomName) {
        console.error('[Yjs] Connection rejected: No room name provided');
        ws.close(1008, 'Room name required');
        return;
      }

      if (!token) {
        console.error('[Yjs] Connection rejected: No token provided');
        ws.close(1008, 'Authentication token required');
        return;
      }

      // Verify JWT
      const user = await verifySupabaseToken(token);

      if (!user) {
        console.error('[Yjs] Connection rejected: Invalid token');
        ws.close(1008, 'Invalid authentication token');
        return;
      }

      console.log(
        `[Yjs] User ${user.email} connected to room: ${roomName}`
      );

      // Get or create the Y.Doc for this room
      const doc = getOrCreateDoc(roomName);

      // Setup the WebSocket connection with y-websocket
      setupWSConnection(ws, req, { docName: roomName, gc: true });

      ws.on('close', () => {
        console.log(
          `[Yjs] User ${user.email} disconnected from room: ${roomName}`
        );
      });
    } catch (error) {
      console.error('[Yjs] Connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });
}

// Export for future persistence (TICKET-07)
export function getDoc(roomName: string): Y.Doc | undefined {
  return docs.get(roomName);
}

export function getAllDocs(): Map<string, Y.Doc> {
  return docs;
}
