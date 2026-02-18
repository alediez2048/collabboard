'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Socket } from 'socket.io-client';
import { useUIStore } from '@/stores/ui-store';
import { Grid } from './Grid';
import { Toolbar } from './Toolbar';
import { StickyNote } from './StickyNote';
import { TextEditor } from './TextEditor';
import { ColorPicker } from './ColorPicker';
import { RemoteCursorsLayer } from './RemoteCursorsLayer';
import { ShareButton } from './ShareButton';
import { PresenceBar } from './PresenceBar';
import { createBoardDoc, addObject, updateObject, removeObject, getAllObjects, type BoardObject } from '@/lib/yjs/board-doc';
import { Shape } from './Shape';
import { Frame } from './Frame';
import { Connector } from './Connector';
import { createYjsProvider } from '@/lib/yjs/provider';
import { createCursorSocket, emitCursorMove } from '@/lib/sync/cursor-socket';
import { createClient } from '@/lib/supabase/client';
import { normalizeGeometry } from '@/lib/utils/geometry';
import { loadViewport, saveViewport } from '@/lib/utils/viewport-storage';

interface CanvasProps {
  boardId: string;
}

/**
 * Generate a stable, unique color for a user based on their ID
 */
function getUserColor(userId: string): string {
  const colors = [
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];
  
  // Simple hash: sum char codes
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function Canvas({ boardId }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewportReady, setViewportReady] = useState(false);
  const { zoom, pan, setZoom, setPan, selectedTool, setSelectedTool } = useUIStore();

  // Yjs and Socket.io connection state
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [yjsConnected, setYjsConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Board objects state (derived from Yjs Y.Map)
  const [boardObjects, setBoardObjects] = useState<BoardObject[]>([]);

  // Selection and editing state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Shape draw-in-progress state (drag to draw)
  const [drawingShape, setDrawingShape] = useState<{
    type: 'rectangle' | 'circle' | 'line' | 'frame';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Connector tool: ID of the first object clicked (awaiting second click)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

  const [userColor, setUserColor] = useState<string>('#3b82f6');
  // Store session info in refs so cursor emission never needs async calls
  const sessionUserIdRef = useRef<string>('');
  const sessionUserNameRef = useRef<string>('Anonymous');
  const lastEmitTime = useRef<number>(0);
  const THROTTLE_MS = 33; // ~30Hz

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

  // Rehydrate viewport from localStorage when the board first loads
  useEffect(() => {
    const saved = loadViewport(boardId);
    setZoom(saved.zoom);
    setPan(saved.pan);
    setViewportReady(true);
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced persist: write viewport to localStorage 150ms after the last change
  useEffect(() => {
    if (!viewportReady) return; // skip the initial render before rehydration completes
    const timer = setTimeout(() => {
      saveViewport(boardId, { zoom, pan });
    }, 150);
    return () => clearTimeout(timer);
  }, [boardId, zoom, pan, viewportReady]);

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

  // Handle pan on drag end — only update pan when the Stage itself was dragged,
  // not when a child object's dragend event bubbles up to the Stage.
  const handleDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    if (e.target !== stageRef.current) return;
    const stage = e.target as Konva.Stage;
    setPan({ x: stage.x(), y: stage.y() });
  };

  // Handle mouse move — emit throttled cursor event AND update shape preview
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>): void => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Convert screen coordinates to canvas coordinates
    const canvasX = (pointerPos.x - stage.x()) / stage.scaleX();
    const canvasY = (pointerPos.y - stage.y()) / stage.scaleY();

    // Emit throttled cursor event (no async needed — session cached in ref)
    if (socket && socket.connected && sessionUserIdRef.current) {
      const now = Date.now();
      if (now - lastEmitTime.current >= THROTTLE_MS) {
        lastEmitTime.current = now;
        emitCursorMove(socket, {
          userId: sessionUserIdRef.current,
          userName: sessionUserNameRef.current,
          x: canvasX,
          y: canvasY,
          color: userColor,
        });
      }
    }

    // Update in-progress shape preview
    if (drawingShape) {
      setDrawingShape((prev) =>
        prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null,
      );
    }
  };

  // Note: zoom/pan are applied directly via Stage props (scaleX, scaleY, x, y).
  // No useEffect needed — the controlled props already drive Konva imperatively.

  // Initialize Yjs and Socket.io connections
  useEffect(() => {
    let cleanupProvider: WebsocketProvider | null = null;
    let cleanupSocket: Socket | null = null;
    let cancelled = false;

    const initSync = async (): Promise<void> => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || cancelled) {
          if (cancelled) console.log('[Canvas] initSync cancelled by cleanup');
          else console.error('[Canvas] No active session, cannot connect to sync services');
          return;
        }

        console.log('[Canvas] Initializing real-time sync...');

        const { doc } = createBoardDoc();

        const yjsProvider = createYjsProvider({
          boardId,
          doc,
          token: session.access_token,
        });

        // If cleanup ran while we were awaiting getSession(), tear down immediately
        if (cancelled) {
          yjsProvider.destroy();
          return;
        }

        yjsProvider.on('status', (event: { status: string }) => {
          const isConnected = event.status === 'connected';
          setYjsConnected(isConnected);
          console.log(`[Canvas] Yjs status: ${event.status}`);
        });

        // When the initial sync completes, the server has applied the persisted
        // snapshot to our doc via the Yjs sync protocol. Re-read the objects map
        // so React state reflects the loaded data. Without this, the Y.Map
        // observer (attached to an initially-empty doc) may not fire again
        // after the sync fills it.
        yjsProvider.on('sync', (isSynced: boolean) => {
          console.log(`[Canvas] Yjs sync: ${isSynced ? 'synced' : 'syncing'}`);
          if (isSynced && !cancelled) {
            const objects = doc.getMap<BoardObject>('objects');
            const allObjects = getAllObjects(objects);
            setBoardObjects(allObjects);
          }
        });

        setYDoc(doc);
        setProvider(yjsProvider);
        cleanupProvider = yjsProvider;

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

    return () => {
      cancelled = true;
      console.log('[Canvas] Cleaning up connections...');
      if (cleanupProvider) {
        cleanupProvider.destroy();
      }
      if (cleanupSocket) {
        cleanupSocket.disconnect();
      }
    };
  }, [boardId]);

  // Observe Y.Map for changes and update React state
  useEffect(() => {
    if (!yDoc) return;

    const objects = yDoc.getMap<BoardObject>('objects');

    const observer = (): void => {
      const allObjects = getAllObjects(objects);
      setBoardObjects(allObjects);
      console.log('[Canvas] Board objects updated:', allObjects.length);
    };

    // Observe changes
    objects.observe(observer);

    // Initial load
    observer();

    return () => {
      objects.unobserve(observer);
    };
  }, [yDoc]);

  // Initialize user color + cache session info for cursor emission
  useEffect(() => {
    const initSession = async (): Promise<void> => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const color = getUserColor(session.user.id);
        setUserColor(color);
        sessionUserIdRef.current = session.user.id;
        sessionUserNameRef.current = session.user.email?.split('@')[0] || 'Anonymous';
        console.log('[Canvas] User color assigned:', color);
      }
    };

    initSession();
  }, []);

  // Publish presence to Yjs awareness once provider + session identity are ready
  useEffect(() => {
    if (!provider || !sessionUserIdRef.current) return;

    provider.awareness.setLocalStateField('user', {
      userId: sessionUserIdRef.current,
      userName: sessionUserNameRef.current,
      color: userColor,
      isOnline: true,
    });

    console.log('[Canvas] Awareness state set for user:', sessionUserIdRef.current);

    // Belt-and-suspenders: clear awareness state immediately on tab/window close
    // so the server removes the avatar instantly rather than waiting for the
    // 30-second heartbeat timeout. The server fix handles the primary cleanup;
    // this covers the case where the browser gets to run beforeunload.
    const handleBeforeUnload = (): void => {
      provider.awareness.setLocalState(null);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also clear on React unmount (e.g. navigating away within the SPA)
      provider.awareness.setLocalState(null);
    };
  }, [provider, userColor]); // re-run when provider initializes or color resolves

  // Remote cursor state and cleanup are handled inside RemoteCursorsLayer
  // to prevent cursor updates from re-rendering sticky notes and the grid.

  // Handle delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedObjectId && !editingObjectId) {
        e.preventDefault();
        if (yDoc) {
          const objects = yDoc.getMap<BoardObject>('objects');
          removeObject(objects, selectedObjectId);

          // Remove any connectors whose fromId or toId referenced the deleted object
          objects.forEach((obj, key) => {
            if (
              obj.type === 'connector' &&
              (obj.properties.fromId === selectedObjectId || obj.properties.toId === selectedObjectId)
            ) {
              objects.delete(key);
            }
          });

          setSelectedObjectId(null);
          setShowColorPicker(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, editingObjectId, yDoc]);

  // Create sticky note on canvas click (when sticky tool is active)
  const handleStageClick = async (e: KonvaEventObject<MouseEvent>): Promise<void> => {
    const stage = stageRef.current;
    if (!stage || !yDoc || selectedTool !== 'sticky') return;

    // Only create if clicking on the stage itself (not on an object)
    if (e.target !== stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Convert screen coordinates to canvas coordinates
    const canvasX = (pointerPos.x - stage.x()) / stage.scaleX();
    const canvasY = (pointerPos.y - stage.y()) / stage.scaleY();

    // Get current user
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    // Create new sticky note
    const newNote: BoardObject = {
      id: crypto.randomUUID(),
      type: 'sticky_note',
      x: canvasX,
      y: canvasY,
      width: 200,
      height: 200,
      rotation: 0,
      zIndex: boardObjects.length + 1,
      properties: {
        text: '',
        color: '#ffeb3b', // default yellow
      },
      createdBy: session.user.id,
      updatedAt: new Date().toISOString(),
    };

    const objects = yDoc.getMap<BoardObject>('objects');
    addObject(objects, newNote);

    // Switch back to select tool
    setSelectedTool('select');
    setSelectedObjectId(newNote.id);

    console.log('[Canvas] Created sticky note:', newNote.id);
  };

  // Handle connector two-click draw: first click = set fromId, second click = create connector
  const handleConnectorObjectClick = (objectId: string): void => {
    if (!yDoc) return;
    if (!connectingFrom) {
      setConnectingFrom(objectId);
    } else if (connectingFrom !== objectId) {
      const connector: BoardObject = {
        id: crypto.randomUUID(),
        type: 'connector',
        x: 0, y: 0, width: 0, height: 0,
        rotation: 0,
        zIndex: boardObjects.length + 1,
        properties: {
          fromId: connectingFrom,
          toId: objectId,
          color: '#1d4ed8',
          strokeWidth: 2,
        },
        createdBy: sessionUserIdRef.current,
        updatedAt: new Date().toISOString(),
      };
      const objects = yDoc.getMap<BoardObject>('objects');
      addObject(objects, connector);
      setConnectingFrom(null);
      setSelectedTool('select');
      console.log('[Canvas] Created connector:', connector.id);
    }
  };

  // Handle object selection (sticky notes + shapes + frames + connectors)
  const handleSelectObject = (id: string): void => {
    if (selectedTool === 'connector') {
      handleConnectorObjectClick(id);
      return;
    }
    if (!yDoc) return;
    const objects = yDoc.getMap<BoardObject>('objects');
    const obj = objects.get(id);
    setSelectedObjectId(id);
    setShowColorPicker(!!obj && obj.type !== 'line' && obj.type !== 'connector' && obj.type !== 'frame');
  };

  // Handle object drag end — update position in Yjs
  const handleObjectDragEnd = (id: string, x: number, y: number): void => {
    if (!yDoc) return;
    const objects = yDoc.getMap<BoardObject>('objects');
    updateObject(objects, id, { x, y });
    console.log('[Canvas] Updated position:', id, { x, y });
  };

  // Attach/detach Transformer when the selected object changes
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const selected = boardObjects.find((o) => o.id === selectedObjectId);
    // Lines and connectors don't get resize/rotate handles
    const excluded = !selected || selected.type === 'line' || selected.type === 'connector';
    const node = selectedObjectId ? shapeRefs.current.get(selectedObjectId) : undefined;

    tr.nodes(node && !excluded ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedObjectId, boardObjects]);

  // Called by each object after the Transformer interaction ends
  const handleTransformEnd = (id: string): void => {
    const node = shapeRefs.current.get(id);
    if (!node || !yDoc) return;

    const objects = yDoc.getMap<BoardObject>('objects');
    const obj = objects.get(id);
    if (!obj) return;

    const { width, height } = normalizeGeometry(
      obj.width,
      obj.height,
      node.scaleX(),
      node.scaleY(),
    );

    // Reset Konva scale to 1 — actual size now lives in Yjs
    node.scaleX(1);
    node.scaleY(1);

    updateObject(objects, id, {
      x: node.x(),
      y: node.y(),
      width,
      height,
      rotation: node.rotation(),
    });

    console.log('[Canvas] Transform applied:', id, { width, height, rotation: node.rotation() });
  };

  // Handle double-click (enter text editing mode)
  const handleDoubleClick = (id: string): void => {
    setEditingObjectId(id);
    setShowColorPicker(false);
  };

  // Handle text save (sticky notes use 'text', frames use 'title')
  const handleTextSave = (text: string): void => {
    if (!yDoc || !editingObjectId) return;

    const objects = yDoc.getMap<BoardObject>('objects');
    const object = objects.get(editingObjectId);

    if (object) {
      const textKey = object.type === 'frame' ? 'title' : 'text';
      updateObject(objects, editingObjectId, {
        properties: {
          ...object.properties,
          [textKey]: text,
        },
      });
    }

    console.log('[Canvas] Updated text:', editingObjectId, text);
  };

  // Handle color change — sticky notes use 'color', shapes use 'fillColor'
  const handleColorChange = (color: string): void => {
    if (!yDoc || !selectedObjectId) return;

    const objects = yDoc.getMap<BoardObject>('objects');
    const object = objects.get(selectedObjectId);
    if (!object) return;

    const colorKey = object.type === 'sticky_note' ? 'color' : 'fillColor';
    updateObject(objects, selectedObjectId, {
      properties: { ...object.properties, [colorKey]: color },
    });

    console.log('[Canvas] Updated color:', selectedObjectId, color);
  };

  // Merged mousedown: deselect on empty canvas + start shape drawing
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>): void => {
    const stage = stageRef.current;
    if (!stage) return;

    // Deselect when clicking empty canvas
    if (e.target === e.target.getStage()) {
      setSelectedObjectId(null);
      setShowColorPicker(false);
    }

    // Cancel connector flow on empty-canvas click
    if (selectedTool === 'connector' && e.target === stage) {
      setConnectingFrom(null);
    }

    // Start drawing if a shape or frame tool is active and target is empty canvas
    const shapeTool = selectedTool as string;
    if (
      (shapeTool === 'rectangle' || shapeTool === 'circle' || shapeTool === 'line' || shapeTool === 'frame') &&
      e.target === stage
    ) {
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const canvasX = (pos.x - stage.x()) / stage.scaleX();
      const canvasY = (pos.y - stage.y()) / stage.scaleY();

      // Disable canvas pan while drawing
      stage.draggable(false);
      setDrawingShape({
        type: shapeTool as 'rectangle' | 'circle' | 'line' | 'frame',
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
      });
    }
  };

  // Commit the drawn shape to Yjs on mouse up
  const handleMouseUp = (): void => {
    const stage = stageRef.current;
    if (stage) stage.draggable(true); // always re-enable pan

    if (!drawingShape || !yDoc) {
      setDrawingShape(null);
      return;
    }

    const { type, startX, startY, currentX, currentY } = drawingShape;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Ignore accidental micro-clicks (< 5px)
    const tooSmall =
      type === 'line'
        ? Math.sqrt(width * width + height * height) < 5
        : width < 5 || height < 5;

    if (tooSmall) {
      setDrawingShape(null);
      return;
    }

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);

    let newShape: BoardObject;

    if (type === 'frame') {
      newShape = {
        id: crypto.randomUUID(),
        type: 'frame',
        x, y, width, height,
        rotation: 0,
        zIndex: 0,
        properties: { title: 'Frame', fillColor: 'rgba(219,234,254,0.25)', strokeColor: '#3b82f6' },
        createdBy: sessionUserIdRef.current,
        updatedAt: new Date().toISOString(),
      };
    } else {
      newShape = {
        id: crypto.randomUUID(),
        type,
        x, y, width, height,
        rotation: 0,
        zIndex: boardObjects.length + 1,
        properties:
          type === 'line'
            ? { strokeColor: '#1d4ed8', strokeWidth: 2, x2: currentX, y2: currentY }
            : { fillColor: '#93c5fd', strokeColor: '#1d4ed8', strokeWidth: 2 },
        createdBy: sessionUserIdRef.current,
        updatedAt: new Date().toISOString(),
      };
    }

    const objects = yDoc.getMap<BoardObject>('objects');
    addObject(objects, newShape);

    setDrawingShape(null);
    setSelectedTool('select');
    setSelectedObjectId(newShape.id);
    setShowColorPicker(type !== 'line' && type !== 'frame');

    console.log(`[Canvas] Created ${type}:`, newShape.id);
  };

  if (dimensions.width === 0 || dimensions.height === 0 || !viewportReady) {
    return null; // Wait for dimensions and viewport rehydration before rendering
  }

  // Get editing object details
  const editingObject = editingObjectId
    ? boardObjects.find((obj) => obj.id === editingObjectId)
    : null;

  // Get selected object for color picker
  const selectedObject = selectedObjectId
    ? boardObjects.find((obj) => obj.id === selectedObjectId)
    : null;

  return (
    <div className="fixed inset-0 bg-gray-50">
      {/* Toolbar */}
      <Toolbar />

      {/* Share button — top right */}
      <ShareButton boardId={boardId} />

      {/* Presence bar — online user avatars */}
      {provider && sessionUserIdRef.current && (
        <PresenceBar
          provider={provider}
          currentUserId={sessionUserIdRef.current}
        />
      )}

      {/* Connector "connecting from" hint */}
      {selectedTool === 'connector' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 shadow">
          {connectingFrom
            ? 'Now click the destination object to complete the connector'
            : 'Click the source object to start a connector'}
        </div>
      )}

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
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        x={pan.x}
        y={pan.y}
        scaleX={zoom}
        scaleY={zoom}
        style={{ cursor: ['rectangle', 'circle', 'line', 'frame'].includes(selectedTool) ? 'crosshair' : selectedTool === 'connector' ? 'cell' : 'default' }}
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
          {/* 1. Frames — bottom, behind everything */}
          {boardObjects
            .filter((obj): obj is BoardObject => obj.type === 'frame')
            .map((obj) => (
              <Frame
                key={obj.id}
                ref={(node) => {
                  if (node) shapeRefs.current.set(obj.id, node);
                  else shapeRefs.current.delete(obj.id);
                }}
                id={obj.id}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                rotation={obj.rotation}
                title={String(obj.properties.title ?? 'Frame')}
                fillColor={String(obj.properties.fillColor ?? 'rgba(219,234,254,0.25)')}
                strokeColor={String(obj.properties.strokeColor ?? '#3b82f6')}
                isSelected={obj.id === selectedObjectId && !editingObjectId}
                onSelect={handleSelectObject}
                onDragEnd={handleObjectDragEnd}
                onDoubleClick={handleDoubleClick}
                onTransformEnd={handleTransformEnd}
              />
            ))}

          {/* 2. Connectors — above frames, below shapes */}
          {boardObjects
            .filter((obj): obj is BoardObject => obj.type === 'connector')
            .map((obj) => (
              <Connector
                key={obj.id}
                id={obj.id}
                fromId={String(obj.properties.fromId ?? '')}
                toId={String(obj.properties.toId ?? '')}
                color={String(obj.properties.color ?? '#1d4ed8')}
                strokeWidth={Number(obj.properties.strokeWidth ?? 2)}
                boardObjects={boardObjects}
                isSelected={obj.id === selectedObjectId && !editingObjectId}
                onSelect={handleSelectObject}
              />
            ))}

          {/* 3. Shapes */}
          {boardObjects
            .filter(
              (obj): obj is BoardObject =>
                obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line',
            )
            .map((obj) => (
              <Shape
                key={obj.id}
                ref={(node) => {
                  if (node) shapeRefs.current.set(obj.id, node);
                  else shapeRefs.current.delete(obj.id);
                }}
                id={obj.id}
                type={obj.type as 'rectangle' | 'circle' | 'line'}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                rotation={obj.rotation}
                fillColor={String(obj.properties.fillColor ?? '#93c5fd')}
                strokeColor={String(obj.properties.strokeColor ?? '#1d4ed8')}
                strokeWidth={Number(obj.properties.strokeWidth ?? 2)}
                x2={obj.properties.x2 !== undefined ? Number(obj.properties.x2) : undefined}
                y2={obj.properties.y2 !== undefined ? Number(obj.properties.y2) : undefined}
                isSelected={obj.id === selectedObjectId && !editingObjectId}
                onSelect={handleSelectObject}
                onDragEnd={handleObjectDragEnd}
                onTransformEnd={handleTransformEnd}
              />
            ))}

          {/* 4. Ghost preview while drawing */}
          {drawingShape && drawingShape.type !== 'frame' && (
            <Shape
              id="__preview__"
              type={drawingShape.type as 'rectangle' | 'circle' | 'line'}
              x={Math.min(drawingShape.startX, drawingShape.currentX)}
              y={Math.min(drawingShape.startY, drawingShape.currentY)}
              width={Math.abs(drawingShape.currentX - drawingShape.startX)}
              height={Math.abs(drawingShape.currentY - drawingShape.startY)}
              fillColor="rgba(147, 197, 253, 0.35)"
              strokeColor="#2563eb"
              strokeWidth={2}
              x2={drawingShape.currentX}
              y2={drawingShape.currentY}
              isSelected={false}
              onSelect={() => {}}
              onDragEnd={() => {}}
            />
          )}
          {drawingShape && drawingShape.type === 'frame' && (
            <Frame
              id="__frame_preview__"
              x={Math.min(drawingShape.startX, drawingShape.currentX)}
              y={Math.min(drawingShape.startY, drawingShape.currentY)}
              width={Math.abs(drawingShape.currentX - drawingShape.startX)}
              height={Math.abs(drawingShape.currentY - drawingShape.startY)}
              title="Frame"
              fillColor="rgba(219,234,254,0.15)"
              strokeColor="#3b82f6"
              isSelected={false}
              onSelect={() => {}}
              onDragEnd={() => {}}
              onDoubleClick={() => {}}
            />
          )}

          {/* 5. Sticky notes — top */}
          {boardObjects
            .filter((obj) => obj.type === 'sticky_note')
            .map((obj) => (
              <StickyNote
                key={obj.id}
                ref={(node) => {
                  if (node) shapeRefs.current.set(obj.id, node);
                  else shapeRefs.current.delete(obj.id);
                }}
                id={obj.id}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                rotation={obj.rotation}
                text={String(obj.properties.text || '')}
                color={String(obj.properties.color || '#ffeb3b')}
                isSelected={obj.id === selectedObjectId && !editingObjectId}
                onSelect={handleSelectObject}
                onDragEnd={handleObjectDragEnd}
                onDoubleClick={handleDoubleClick}
                onTransformEnd={handleTransformEnd}
              />
            ))}

          {/* Transformer — single shared instance, attached to selected node via useEffect */}
          <Transformer
            ref={transformerRef}
            keepRatio={false}
            rotateEnabled={true}
            boundBoxFunc={(oldBox, newBox) => {
              // Enforce minimum size during live drag so the box never inverts
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>

        {/* Remote cursors layer — isolated to prevent re-rendering sticky notes */}
        {socket && sessionUserIdRef.current && (
          <RemoteCursorsLayer
            socket={socket}
            currentUserId={sessionUserIdRef.current}
          />
        )}
      </Stage>

      {/* Text Editor Overlay */}
      {editingObject && stageRef.current && (
        <TextEditor
          x={editingObject.x}
          y={editingObject.y}
          width={editingObject.type === 'frame' ? Math.max(editingObject.width, 120) : editingObject.width}
          height={editingObject.type === 'frame' ? 36 : editingObject.height}
          initialText={String(
            editingObject.type === 'frame'
              ? (editingObject.properties.title || '')
              : (editingObject.properties.text || '')
          )}
          stage={stageRef.current}
          onSave={handleTextSave}
          onClose={() => setEditingObjectId(null)}
        />
      )}

      {/* Color Picker — for sticky notes and shapes (not lines) */}
      {showColorPicker && selectedObject && selectedObject.type !== 'line' && (
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 100,
          }}
        >
          <ColorPicker
            selectedColor={String(
              selectedObject.type === 'sticky_note'
                ? (selectedObject.properties.color ?? '#ffeb3b')
                : (selectedObject.properties.fillColor ?? '#93c5fd'),
            )}
            onColorSelect={handleColorChange}
          />
        </div>
      )}

      {/* Hidden board ID for testing */}
      <div className="sr-only" data-testid="board-id">
        {boardId}
      </div>
    </div>
  );
}
