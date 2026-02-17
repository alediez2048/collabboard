import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export interface YjsProviderOptions {
  boardId: string;
  doc: Y.Doc;
  token: string;
}

export interface ProviderStatus {
  status: 'connecting' | 'connected' | 'disconnected';
  synced: boolean;
}

/**
 * Create a WebSocket provider for Yjs document synchronization.
 * Connects to the y-websocket server and handles authentication via JWT.
 * 
 * @param options - Configuration including boardId, Y.Doc, and auth token
 * @returns WebsocketProvider instance
 */
export function createYjsProvider(
  options: YjsProviderOptions
): WebsocketProvider {
  const { boardId, doc, token } = options;

  // Get WebSocket URL from environment or use localhost
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

  // Ensure we have the /yjs path
  const fullWsUrl = wsUrl.replace(/^http/, 'ws') + '/yjs';

  console.log(`[Yjs Provider] Connecting to ${fullWsUrl} with room: ${boardId}`);

  // Create the provider
  // The WebsocketProvider takes: (serverUrl, roomName, doc, options)
  const provider = new WebsocketProvider(
    fullWsUrl,
    boardId,
    doc,
    {
      params: { token }, // Pass JWT for authentication
    }
  );

  // Connection status logging
  provider.on('status', (event: { status: string }) => {
    console.log(`[Yjs Provider] Connection status: ${event.status}`);
  });

  provider.on('sync', (isSynced: boolean) => {
    console.log(`[Yjs Provider] Sync status: ${isSynced ? 'synced' : 'syncing'}`);
  });

  // Error handling
  provider.on('connection-error', (event: Event) => {
    console.error('[Yjs Provider] Connection error:', event);
  });

  provider.on('connection-close', (event: CloseEvent | null) => {
    if (event) {
      console.warn(
        `[Yjs Provider] Connection closed: ${event.code} - ${event.reason || 'No reason'}`
      );
    } else {
      console.warn('[Yjs Provider] Connection closed');
    }
  });

  return provider;
}

/**
 * Destroy a Yjs provider and clean up connections
 */
export function destroyProvider(provider: WebsocketProvider): void {
  console.log('[Yjs Provider] Destroying provider...');
  provider.destroy();
}
