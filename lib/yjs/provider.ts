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
  reconnectCount: number;
}

function normalizeYjsWebSocketUrl(url: string): string {
  const wsBase = url.replace(/^http/, 'ws').replace(/\/+$/, '');
  return `${wsBase}/yjs`;
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
  const fullWsUrl = normalizeYjsWebSocketUrl(wsUrl);

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

  let hasConnectedOnce = false;
  let reconnectCount = 0;
  let synced = false;

  // Connection status logging
  provider.on('status', (event: { status: string }) => {
    const status = event.status as ProviderStatus['status'];
    if (status === 'connected') {
      if (hasConnectedOnce) {
        reconnectCount += 1;
      } else {
        hasConnectedOnce = true;
      }
    }

    console.log('[Yjs Provider] Connection status', {
      boardId,
      status,
      synced,
      reconnectCount,
    });
  });

  provider.on('sync', (isSynced: boolean) => {
    synced = isSynced;
    console.log('[Yjs Provider] Sync status', {
      boardId,
      synced: isSynced,
      reconnectCount,
    });
  });

  // Error handling
  provider.on('connection-error', (event: Event) => {
    console.error('[Yjs Provider] Connection error', {
      boardId,
      reconnectCount,
      event,
    });
  });

  provider.on('connection-close', (event: CloseEvent | null) => {
    if (event) {
      console.warn('[Yjs Provider] Connection closed', {
        boardId,
        reconnectCount,
        code: event.code,
        reason: event.reason || 'No reason',
      });
    } else {
      console.warn('[Yjs Provider] Connection closed', {
        boardId,
        reconnectCount,
      });
    }
  });

  return provider;
}

/**
 * Destroy a Yjs provider and clean up connections
 */
export function destroyProvider(provider: WebsocketProvider): void {
  console.log('[Yjs Provider] Destroying provider...');
  provider.disconnect();
  provider.destroy();
}
