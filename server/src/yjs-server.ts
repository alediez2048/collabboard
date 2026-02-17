import * as Y from 'yjs';
import { WebSocketServer, WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { IncomingMessage } from 'http';
import { verifySupabaseToken } from './auth';
import { loadSnapshot, saveSnapshot, createDebouncedSave } from './persistence';

// Message types
const messageSync = 0;
const messageAwareness = 1;

// In-memory storage for Y.Docs (one per board)
const docs = new Map<string, Y.Doc>();
const awarenessMap = new Map<string, awarenessProtocol.Awareness>();

// Track connected clients per room to detect first-connect and last-disconnect
const roomClients = new Map<string, Set<WebSocket>>();

function getOrCreateDoc(roomName: string): Y.Doc {
  let doc = docs.get(roomName);

  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomName, doc);
    console.log(`[Yjs] Created new document for room: ${roomName}`);
  }

  return doc;
}

function getOrCreateAwareness(roomName: string, doc: Y.Doc): awarenessProtocol.Awareness {
  let awareness = awarenessMap.get(roomName);
  
  if (!awareness) {
    awareness = new awarenessProtocol.Awareness(doc);
    awarenessMap.set(roomName, awareness);
  }
  
  return awareness;
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

      // Get or create the shared Y.Doc for this room
      const doc = getOrCreateDoc(roomName);
      const awareness = getOrCreateAwareness(roomName, doc);

      // Track this client in the room
      if (!roomClients.has(roomName)) {
        roomClients.set(roomName, new Set());
      }
      const roomSet = roomClients.get(roomName)!;
      const isFirstClient = roomSet.size === 0;
      roomSet.add(ws);

      // Load snapshot only for the first client (doc is still empty at this point)
      if (isFirstClient) {
        await loadSnapshot(roomName, doc);
        console.log(`[Yjs] First client in room ${roomName} — snapshot loaded`);
      }

      // Wire up debounced snapshot save for this room
      const debounceSave = createDebouncedSave(roomName, doc);

      // Track which awareness clientIds belong to this WebSocket connection so
      // we can explicitly remove them when the socket closes — without this,
      // dead clients linger in the awareness map until the 30-second heartbeat
      // timeout, making avatars take a long time to disappear.
      const connClientIds = new Set<number>();

      // Send initial sync message (after snapshot is loaded so client gets full state)
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, doc);
      ws.send(encoding.toUint8Array(encoder));

      const awarenessStates = awareness.getStates();
      if (awarenessStates.size > 0) {
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, messageAwareness);
        encoding.writeVarUint8Array(
          awarenessEncoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
        );
        ws.send(encoding.toUint8Array(awarenessEncoder));
      }

      // Handle incoming messages
      ws.on('message', (message: Buffer) => {
        try {
          const uint8Array = new Uint8Array(message);
          const decoder = decoding.createDecoder(uint8Array);
          const messageType = decoding.readVarUint(decoder);

          if (messageType === messageSync) {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);
            
            if (syncMessageType === syncProtocol.messageYjsSyncStep1 || syncMessageType === syncProtocol.messageYjsUpdate) {
              // Broadcast to all other clients in the room
              const update = encoding.toUint8Array(encoder);
              if (update.length > 1) {
                wss.clients.forEach((client) => {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(update);
                  }
                });
              }
            }

            // Send response
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }
          } else if (messageType === messageAwareness) {
            // Pass `ws` as the origin so the awareness change handler can
            // attribute newly added clientIds to this specific connection.
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              decoding.readVarUint8Array(decoder),
              ws,
            );
          }
        } catch (error) {
          console.error('[Yjs] Error processing message:', error);
        }
      });

      // Handle updates to the doc — relay to other clients and debounce snapshot save
      const updateHandler = (update: Uint8Array, origin: unknown) => {
        if (origin !== ws) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.writeUpdate(encoder, update);
          const message = encoding.toUint8Array(encoder);
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        }

        // Debounce snapshot save on every update regardless of origin
        debounceSave.debouncedSave();
      };
      doc.on('update', updateHandler);

      // Handle awareness updates — broadcast to all clients and track which
      // clientIds are owned by this connection (for cleanup on disconnect).
      const awarenessChangeHandler = (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        // Track clientIds introduced by this specific WebSocket connection
        if (origin === ws) {
          added.forEach((id) => connClientIds.add(id));
          removed.forEach((id) => connClientIds.delete(id));
        }

        const changedClients = added.concat(updated).concat(removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        );
        const message = encoding.toUint8Array(encoder);
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      };
      awareness.on('update', awarenessChangeHandler);

      ws.on('close', () => {
        doc.off('update', updateHandler);
        awareness.off('update', awarenessChangeHandler);

        // Immediately remove this connection's awareness states and notify all
        // remaining clients — this is what makes avatars disappear instantly
        // instead of waiting for the 30-second heartbeat timeout.
        if (connClientIds.size > 0) {
          awarenessProtocol.removeAwarenessStates(
            awareness,
            Array.from(connClientIds),
            null,
          );
          console.log(
            `[Yjs] Removed ${connClientIds.size} awareness state(s) for ${user.email}`,
          );
        }

        // Remove this client from the room set
        const currentRoomSet = roomClients.get(roomName);
        if (currentRoomSet) {
          currentRoomSet.delete(ws);

          if (currentRoomSet.size === 0) {
            // Last client — cancel the pending debounce and save a final snapshot immediately
            debounceSave.cancel();
            roomClients.delete(roomName);
            saveSnapshot(roomName, doc).catch((err) => {
              console.error(`[Yjs] Final snapshot save error for room ${roomName}:`, err);
            });
            console.log(`[Yjs] Last client left room ${roomName} — final snapshot saved`);
          }
        }

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

// Export for future use (e.g. AI agent, admin tooling)
export function getDoc(roomName: string): Y.Doc | undefined {
  return docs.get(roomName);
}

export function getAllDocs(): Map<string, Y.Doc> {
  return docs;
}
