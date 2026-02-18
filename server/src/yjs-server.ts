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

// Per-room promise that resolves once the initial snapshot has been loaded.
// ALL connections to a room must await this before sending sync messages,
// otherwise a second connection can sync an empty doc to the client while
// the first connection is still fetching the snapshot from Supabase.
const roomLoadPromises = new Map<string, Promise<void>>();

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
      const connId = Math.random().toString(36).slice(2, 8);

      // The first connection kicks off the snapshot load; all subsequent
      // connections wait for that same promise so nobody syncs an empty doc.
      if (isFirstClient) {
        const loadPromise = loadSnapshot(roomName, doc).then(() => {
          console.log(`[Yjs] First client in room ${roomName} — snapshot loaded`);
        });
        roomLoadPromises.set(roomName, loadPromise);
      }

      // Block until the snapshot is fully loaded before sending any sync messages
      const pending = roomLoadPromises.get(roomName);
      if (pending) {
        await pending;
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

      // Proactively send the full document state as an update.
      // In practice we've observed clients that never apply the server snapshot
      // after reconnect (empty board after hard refresh) even though the server
      // doc has objects. Sending a full update ensures the client receives state
      // even if the sync step handshake doesn't complete as expected.
      const fullState = Y.encodeStateAsUpdate(doc);
      if (fullState.length > 0) {
        const fullEncoder = encoding.createEncoder();
        encoding.writeVarUint(fullEncoder, messageSync);
        syncProtocol.writeUpdate(fullEncoder, fullState);
        ws.send(encoding.toUint8Array(fullEncoder));
      }

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
            // Pass `ws` as the origin so the doc update handler can avoid
            // echoing the update back to this same connection.
            syncProtocol.readSyncMessage(decoder, encoder, doc, ws);

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

        // Broadcast awareness only to clients in this room
        const clientsInRoom = roomClients.get(roomName);
        if (clientsInRoom) {
          clientsInRoom.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
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
            roomLoadPromises.delete(roomName);
            saveSnapshot(roomName, doc).then(() => {
              // Evict the in-memory doc after saving so the next first-client
              // connection loads a fresh snapshot from Supabase rather than
              // reusing a potentially stale in-memory doc.
              docs.delete(roomName);
              awarenessMap.delete(roomName);
              console.log(`[Yjs] Room ${roomName} evicted from memory`);
            }).catch((err) => {
              console.error(`[Yjs] Final snapshot save error for room ${roomName}:`, err);
            });
            console.log(`[Yjs] Last client left room ${roomName} — final snapshot saving...`);
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
