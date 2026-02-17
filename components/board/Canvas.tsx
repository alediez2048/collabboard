'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Socket } from 'socket.io-client';
import { useUIStore } from '@/stores/ui-store';
import { Grid } from './Grid';
import { Toolbar } from './Toolbar';
import { createBoardDoc } from '@/lib/yjs/board-doc';
import { createYjsProvider } from '@/lib/yjs/provider';
import { createCursorSocket } from '@/lib/sync/cursor-socket';
import { createClient } from '@/lib/supabase/client';

interface CanvasProps {
  boardId: string;
}

export function Canvas({ boardId }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { zoom, pan, setZoom, setPan } = useUIStore();

  // Yjs and Socket.io connection state
  // Note: yDoc, provider, and socket will be used in TICKET-04 for rendering objects
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [socket, setSocket] = useState<Socket | null>(null);
  const [yjsConnected, setYjsConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Handle window resize
  useEffect(() => {
    const updateDimensions = (): void => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handle zoom with mouse wheel
  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Zoom factor
    const scaleBy = 1.05;
    const direction = e.evt.deltaY > 0 ? -1 : 1;

    // Calculate new scale with limits (0.1x to 10x)
    const newScale = Math.max(0.1, Math.min(10, oldScale * Math.pow(scaleBy, direction)));

    // Update zoom in store
    setZoom(newScale);

    // Calculate new position to zoom toward pointer
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    // Update stage position
    stage.position(newPos);
    stage.batchDraw();

    // Update pan in store
    setPan(newPos);
  };

  // Handle pan on drag end
  const handleDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    const stage = e.target as Konva.Stage;
    setPan({ x: stage.x(), y: stage.y() });
  };

  // Sync Zustand state to Stage
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.scale({ x: zoom, y: zoom });
    stage.position(pan);
    stage.batchDraw();
  }, [zoom, pan]);

  // Initialize Yjs and Socket.io connections
  useEffect(() => {
    let cleanupProvider: WebsocketProvider | null = null;
    let cleanupSocket: Socket | null = null;

    const initSync = async (): Promise<void> => {
      try {
        // Get Supabase session token
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          console.error('[Canvas] No active session, cannot connect to sync services');
          return;
        }

        console.log('[Canvas] Initializing real-time sync...');

        // Create Yjs document
        const { doc } = createBoardDoc();
        setYDoc(doc);

        // Create y-websocket provider
        const yjsProvider = createYjsProvider({
          boardId,
          doc,
          token: session.access_token,
        });

        // Listen for connection status
        yjsProvider.on('status', (event: { status: string }) => {
          const isConnected = event.status === 'connected';
          setYjsConnected(isConnected);
          console.log(`[Canvas] Yjs status: ${event.status}`);
        });

        yjsProvider.on('sync', (isSynced: boolean) => {
          console.log(`[Canvas] Yjs sync: ${isSynced ? 'synced' : 'syncing'}`);
        });

        setProvider(yjsProvider);
        cleanupProvider = yjsProvider;

        // Create Socket.io connection for cursors
        const cursorSocket = createCursorSocket({
          boardId,
          token: session.access_token,
        });

        cursorSocket.on('connect', () => {
          setSocketConnected(true);
          console.log('[Canvas] Socket.io connected');
        });

        cursorSocket.on('disconnect', () => {
          setSocketConnected(false);
          console.log('[Canvas] Socket.io disconnected');
        });

        setSocket(cursorSocket);
        cleanupSocket = cursorSocket;

        console.log('[Canvas] Real-time sync initialized successfully');
      } catch (error) {
        console.error('[Canvas] Failed to initialize sync:', error);
      }
    };

    initSync();

    // Cleanup on unmount
    return () => {
      console.log('[Canvas] Cleaning up connections...');
      if (cleanupProvider) {
        cleanupProvider.destroy();
      }
      if (cleanupSocket) {
        cleanupSocket.disconnect();
      }
    };
  }, [boardId]);

  if (dimensions.width === 0 || dimensions.height === 0) {
    return null; // Avoid rendering with 0 dimensions
  }

  return (
    <div className="fixed inset-0 bg-gray-50">
      {/* Toolbar */}
      <Toolbar />

      {/* Connection Status & Zoom indicator */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        {/* Connection status */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  yjsConnected ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-gray-600">Yjs</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  socketConnected ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-gray-600">Socket</span>
            </div>
          </div>
        </div>

        {/* Zoom indicator */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2">
          <span className="text-sm font-medium text-gray-700">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas Stage */}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        x={pan.x}
        y={pan.y}
        scaleX={zoom}
        scaleY={zoom}
      >
        {/* Grid background */}
        <Grid
          width={dimensions.width}
          height={dimensions.height}
          scale={zoom}
          offsetX={pan.x}
          offsetY={pan.y}
        />

        {/* Main content layer */}
        <Layer>
          {/* Board objects will be rendered here in future tickets */}
        </Layer>
      </Stage>

      {/* Hidden board ID for testing */}
      <div className="sr-only" data-testid="board-id">
        {boardId}
      </div>
    </div>
  );
}
