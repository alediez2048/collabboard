'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Socket } from 'socket.io-client';
import { useUIStore } from '@/stores/ui-store';
import { Grid } from './Grid';
import { BoardHeader } from './BoardHeader';
import { Toolbar } from './Toolbar';
import { StickyNote } from './StickyNote';
import { TextEditor } from './TextEditor';
import { ColorPicker } from './ColorPicker';
import { RemoteCursorsLayer } from './RemoteCursorsLayer';
import { ShareButton } from './ShareButton';
import { PresenceBar } from './PresenceBar';
import { PerformanceHUD } from './PerformanceHUD';
import {
  createBoardDoc,
  addObject,
  updateObject,
  updateObjectPositions,
  removeObject,
  getAllObjects,
  applyObjectMapChanges,
  type BoardObject,
} from '@/lib/yjs/board-doc';
import { Shape } from './Shape';
import { Frame } from './Frame';
import { Connector, getConnectorLinePoints, type ConnectorLinePoints } from './Connector';
import { createYjsProvider } from '@/lib/yjs/provider';
import { createCursorSocket, emitCursorMove, type CursorMoveEvent } from '@/lib/sync/cursor-socket';
import { createThrottle } from '@/lib/sync/throttle';
import { createClient } from '@/lib/supabase/client';
import { normalizeGeometry } from '@/lib/utils/geometry';
import {
  buildMovedPositionUpdates,
  computePrimaryDragDelta,
  getMovableSelectionIds,
} from '@/lib/utils/multi-select-drag';
import { loadViewport, saveViewport } from '@/lib/utils/viewport-storage';
import { applyPointerAnchoredWheelZoom, normalizeWheelDelta } from '@/lib/utils/zoom-interaction';
import {
  buildObjectLookup,
  computeCanvasViewport,
  isObjectVisible,
  selectIntersectingObjectIds,
} from '@/lib/utils/viewport-culling';
import type { AwarenessState } from '@/types/presence';
import { AICommandBar } from './AICommandBar';

interface CanvasProps {
  boardId: string;
  boardName: string;
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

function isTextEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

function isDeleteKeyboardEvent(event: KeyboardEvent): boolean {
  return (
    event.key === 'Backspace' ||
    event.key === 'Delete' ||
    event.key === 'Del' ||
    event.code === 'Backspace' ||
    event.code === 'Delete'
  );
}

function appendRollingSample(
  samples: number[],
  next: number,
  maxSamples: number,
): number {
  samples.push(next);
  if (samples.length > maxSamples) {
    samples.shift();
  }
  const total = samples.reduce((sum, value) => sum + value, 0);
  return total / samples.length;
}

export function Canvas({ boardId, boardName }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewportReady, setViewportReady] = useState(false);
  const { zoom, pan, setViewport, selectedTool, setSelectedTool } = useUIStore();

  // Yjs and Socket.io connection state
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [yjsConnected, setYjsConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Board objects state (derived from Yjs Y.Map)
  const [boardObjects, setBoardObjects] = useState<BoardObject[]>([]);

  // Selection and editing state
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const selectedObjectIdsRef = useRef<string[]>([]);
  const editingObjectIdRef = useRef<string | null>(null);
  const boardObjectsRef = useRef<BoardObject[]>([]);
  const yDocRef = useRef<Y.Doc | null>(null);
  const applySelectionRef = useRef<
    (objectIds: string[], preferredPrimaryId?: string | null) => void
  >(() => {});

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
  const [marqueeSelection, setMarqueeSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
  } | null>(null);
  const [isStagePanning, setIsStagePanning] = useState(false);
  const [isWheelZooming, setIsWheelZooming] = useState(false);
  const [isObjectDragging, setIsObjectDragging] = useState(false);
  const [isMultiDragActive, setIsMultiDragActive] = useState(false);
  const multiDragSessionRef = useRef<{
    primaryId: string;
    movableIds: string[];
    initialPositions: Map<string, { x: number; y: number }>;
    followerNodes: Array<{ node: Konva.Node; initialX: number; initialY: number }>;
    pendingPrimaryPosition: { x: number; y: number } | null;
    rafId: number | null;
  } | null>(null);

  const [userColor, setUserColor] = useState<string>('#3b82f6');
  // Store session info in refs so cursor emission never needs async calls
  const sessionUserIdRef = useRef<string>('');
  const sessionUserNameRef = useRef<string>('Anonymous');
  const CURSOR_THROTTLE_MS = 40; // 25Hz (within 20-30Hz target)
  const emitCursorMoveThrottledRef = useRef<(event: CursorMoveEvent) => void>(() => {});
  const cursorEmitMetricsRef = useRef({
    emittedInWindow: 0,
    lastLogAt: 0,
  });
  const pendingObjectChangeIdsRef = useRef<Set<string>>(new Set());
  const boardObjectIndexByIdRef = useRef<Map<string, number>>(new Map());
  const boardObserverMetricsRef = useRef({
    observedInWindow: 0,
    flushedInWindow: 0,
    lastLogAt: 0,
  });
  const renderMetricsRef = useRef({
    lastLogAt: 0,
  });
  const objectSyncSamplesRef = useRef<number[]>([]);
  const cursorSyncSamplesRef = useRef<number[]>([]);
  const zoomSpeedSamplesRef = useRef<number[]>([]);
  const [fps, setFps] = useState<number | null>(null);
  const [objectSyncLatencyMs, setObjectSyncLatencyMs] = useState<number | null>(null);
  const [cursorSyncLatencyMs, setCursorSyncLatencyMs] = useState<number | null>(null);
  const [zoomSpeedPercentPerSecond, setZoomSpeedPercentPerSecond] = useState<number | null>(null);
  const [panDragFps, setPanDragFps] = useState<number | null>(null);
  const [aiPromptExecutionMs, setAiPromptExecutionMs] = useState<number | null>(null);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const performanceHudUpdateRef = useRef({
    objectLatencyUpdatedAt: 0,
    cursorLatencyUpdatedAt: 0,
    zoomSpeedUpdatedAt: 0,
  });
  const zoomSpeedMetricsRef = useRef<{
    lastZoomAppliedAt: number;
    idleResetTimer: ReturnType<typeof setTimeout> | null;
  }>({
    lastZoomAppliedAt: 0,
    idleResetTimer: null,
  });
  const panDragMetricsRef = useRef<{
    active: boolean;
    rafId: number | null;
    framesInWindow: number;
    lastSampleAt: number;
    idleResetTimer: ReturnType<typeof setTimeout> | null;
  }>({
    active: false,
    rafId: null,
    framesInWindow: 0,
    lastSampleAt: 0,
    idleResetTimer: null,
  });
  const viewportRef = useRef({ zoom, pan });
  const wheelZoomStateRef = useRef<{
    rafId: number | null;
    pixelDeltaY: number;
    pointer: { x: number; y: number } | null;
  }>({
    rafId: null,
    pixelDeltaY: 0,
    pointer: null,
  });
  const wheelZoomIdleResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const objectLookup = useMemo(
    () => buildObjectLookup(boardObjects),
    [boardObjects],
  );
  const selectedObjectIdSet = useMemo(
    () => new Set(selectedObjectIds),
    [selectedObjectIds],
  );
  selectedObjectIdsRef.current = selectedObjectIds;
  editingObjectIdRef.current = editingObjectId;
  boardObjectsRef.current = boardObjects;
  yDocRef.current = yDoc;
  const isDenseBoard = boardObjects.length >= 500;
  const simplifyDenseInteractionRendering =
    isDenseBoard &&
    (isStagePanning || isWheelZooming || isObjectDragging || isMultiDragActive);

  useEffect(() => {
    viewportRef.current = { zoom, pan };
  }, [zoom, pan]);

  const viewportBounds = useMemo(
    () => computeCanvasViewport(dimensions, pan, zoom, 200),
    [dimensions, pan, zoom],
  );

  const visibleBoardObjects = useMemo(() => {
    // Culling has overhead; skip it on small boards.
    if (boardObjects.length <= 220) {
      return boardObjects;
    }

    return boardObjects.filter((object) => {
      if (selectedObjectIdSet.has(object.id) || object.id === editingObjectId) {
        return true;
      }

      return isObjectVisible(object, viewportBounds, objectLookup);
    });
  }, [boardObjects, selectedObjectIdSet, editingObjectId, viewportBounds, objectLookup]);

  const layeredVisibleObjects = useMemo(() => {
    const frames: BoardObject[] = [];
    const connectors: Array<{
      object: BoardObject;
      fromId: string;
      toId: string;
      color: string;
      strokeWidth: number;
      points: ConnectorLinePoints | null;
    }> = [];
    const shapes: BoardObject[] = [];
    const stickyNotes: BoardObject[] = [];

    for (const object of visibleBoardObjects) {
      if (object.type === 'frame') {
        frames.push(object);
      } else if (object.type === 'connector') {
        const fromId = String(object.properties.fromId ?? '');
        const toId = String(object.properties.toId ?? '');
        const fromObject = objectLookup.get(fromId);
        const toObject = objectLookup.get(toId);
        const points =
          fromObject && toObject
            ? getConnectorLinePoints(fromObject, toObject)
            : null;

        connectors.push({
          object,
          fromId,
          toId,
          color: String(object.properties.color ?? '#1d4ed8'),
          strokeWidth: Number(object.properties.strokeWidth ?? 2),
          points,
        });
      } else if (object.type === 'sticky_note') {
        stickyNotes.push(object);
      } else if (
        object.type === 'rectangle' ||
        object.type === 'circle' ||
        object.type === 'line' ||
        object.type === 'text'
      ) {
        shapes.push(object);
      }
    }

    return { frames, connectors, shapes, stickyNotes };
  }, [visibleBoardObjects, objectLookup]);

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
    viewportRef.current = saved;
    setViewport(saved);
    setViewportReady(true);
  }, [boardId, setViewport]);

  // Debounced persist: write viewport to localStorage 150ms after the last change
  useEffect(() => {
    if (!viewportReady) return; // skip the initial render before rehydration completes
    const timer = setTimeout(() => {
      saveViewport(boardId, { zoom, pan });
    }, 150);
    return () => clearTimeout(timer);
  }, [boardId, zoom, pan, viewportReady]);

  // Lightweight FPS monitor for live performance HUD.
  useEffect(() => {
    let rafId = 0;
    let lastSampleAt = performance.now();
    let frames = 0;

    const tick = (now: number): void => {
      frames += 1;
      const elapsedMs = now - lastSampleAt;
      if (elapsedMs >= 1000) {
        setFps((frames * 1000) / elapsedMs);
        frames = 0;
        lastSampleAt = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Build a stable, throttled cursor emitter so pointer movement cannot exceed ~30Hz.
  useEffect(() => {
    emitCursorMoveThrottledRef.current = createThrottle(
      (event: CursorMoveEvent): void => {
        if (!socket || !socket.connected) return;

        emitCursorMove(socket, event);

        if (process.env.NODE_ENV === 'development') {
          const now = Date.now();
          const metrics = cursorEmitMetricsRef.current;
          metrics.emittedInWindow += 1;

          if (metrics.lastLogAt === 0) {
            metrics.lastLogAt = now;
            return;
          }

          const elapsedMs = now - metrics.lastLogAt;
          if (elapsedMs >= 5000) {
            const emittedPerSecond = Number(
              (metrics.emittedInWindow / (elapsedMs / 1000)).toFixed(1),
            );
            console.debug('[Canvas Perf] cursor emit rate', {
              emittedPerSecond,
              intervalMs: elapsedMs,
            });
            metrics.emittedInWindow = 0;
            metrics.lastLogAt = now;
          }
        }
      },
      CURSOR_THROTTLE_MS,
    );
  }, [socket, CURSOR_THROTTLE_MS]);

  useEffect(() => {
    const wheelState = wheelZoomStateRef.current;
    const zoomSpeedMetrics = zoomSpeedMetricsRef.current;
    return () => {
      const rafId = wheelState.rafId;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (zoomSpeedMetrics.idleResetTimer !== null) {
        clearTimeout(zoomSpeedMetrics.idleResetTimer);
      }
      if (wheelZoomIdleResetTimerRef.current !== null) {
        clearTimeout(wheelZoomIdleResetTimerRef.current);
        wheelZoomIdleResetTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const panMetrics = panDragMetricsRef.current;
    return () => {
      if (panMetrics.rafId !== null) {
        window.cancelAnimationFrame(panMetrics.rafId);
      }
      if (panMetrics.idleResetTimer !== null) {
        clearTimeout(panMetrics.idleResetTimer);
      }
    };
  }, []);

  const flushPendingWheelZoom = (): void => {
    const stage = stageRef.current;
    const wheelState = wheelZoomStateRef.current;
    wheelState.rafId = null;

    if (!stage || !wheelState.pointer || wheelState.pixelDeltaY === 0) {
      wheelState.pixelDeltaY = 0;
      wheelState.pointer = null;
      return;
    }

    const currentViewport = viewportRef.current;
    const nextViewport = applyPointerAnchoredWheelZoom({
      viewport: currentViewport,
      pointer: wheelState.pointer,
      deltaY: wheelState.pixelDeltaY,
      deltaMode: 0,
      pageHeight: 1,
    });

    wheelState.pixelDeltaY = 0;
    wheelState.pointer = null;

    if (
      nextViewport.zoom === currentViewport.zoom &&
      nextViewport.pan.x === currentViewport.pan.x &&
      nextViewport.pan.y === currentViewport.pan.y
    ) {
      return;
    }

    const zoomSpeedMetrics = zoomSpeedMetricsRef.current;
    const now = performance.now();
    if (zoomSpeedMetrics.lastZoomAppliedAt > 0) {
      const elapsedMs = now - zoomSpeedMetrics.lastZoomAppliedAt;
      if (elapsedMs > 0) {
        const baseZoom = currentViewport.zoom > 0 ? currentViewport.zoom : 1;
        const zoomDeltaPercent = Math.abs(((nextViewport.zoom - currentViewport.zoom) / baseZoom) * 100);
        const instantaneousSpeed = (zoomDeltaPercent * 1000) / elapsedMs;
        const smoothedSpeed = appendRollingSample(
          zoomSpeedSamplesRef.current,
          instantaneousSpeed,
          20,
        );

        if (now - performanceHudUpdateRef.current.zoomSpeedUpdatedAt >= 80) {
          setZoomSpeedPercentPerSecond(smoothedSpeed);
          performanceHudUpdateRef.current.zoomSpeedUpdatedAt = now;
        }
      }
    }
    zoomSpeedMetrics.lastZoomAppliedAt = now;
    if (zoomSpeedMetrics.idleResetTimer !== null) {
      clearTimeout(zoomSpeedMetrics.idleResetTimer);
    }
    zoomSpeedMetrics.idleResetTimer = setTimeout(() => {
      zoomSpeedSamplesRef.current = [];
      setZoomSpeedPercentPerSecond(null);
    }, 300);

    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  };

  // Handle zoom with mouse wheel/trackpad (coalesced to one write per frame).
  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const wheelState = wheelZoomStateRef.current;
    const pageHeight = dimensions.height > 0 ? dimensions.height : window.innerHeight;
    wheelState.pixelDeltaY += normalizeWheelDelta(
      e.evt.deltaY,
      e.evt.deltaMode,
      pageHeight,
    );
    wheelState.pointer = { x: pointer.x, y: pointer.y };

    if (!isWheelZooming) {
      setIsWheelZooming(true);
    }
    if (wheelZoomIdleResetTimerRef.current !== null) {
      clearTimeout(wheelZoomIdleResetTimerRef.current);
    }
    wheelZoomIdleResetTimerRef.current = setTimeout(() => {
      setIsWheelZooming(false);
      wheelZoomIdleResetTimerRef.current = null;
    }, 180);

    if (wheelState.rafId !== null) return;
    wheelState.rafId = window.requestAnimationFrame(flushPendingWheelZoom);
  };

  const runPanDragMetricsTick = (now: number): void => {
    const metrics = panDragMetricsRef.current;
    if (!metrics.active) return;

    metrics.framesInWindow += 1;
    const elapsedMs = now - metrics.lastSampleAt;
    if (elapsedMs >= 400) {
      setPanDragFps((metrics.framesInWindow * 1000) / elapsedMs);
      metrics.framesInWindow = 0;
      metrics.lastSampleAt = now;
    }

    metrics.rafId = window.requestAnimationFrame(runPanDragMetricsTick);
  };

  const handleStageDragStart = (e: KonvaEventObject<DragEvent>): void => {
    if (e.target !== stageRef.current) return;

    const metrics = panDragMetricsRef.current;
    metrics.active = true;
    metrics.framesInWindow = 0;
    metrics.lastSampleAt = performance.now();
    if (metrics.idleResetTimer !== null) {
      clearTimeout(metrics.idleResetTimer);
      metrics.idleResetTimer = null;
    }
    if (metrics.rafId !== null) {
      window.cancelAnimationFrame(metrics.rafId);
    }
    metrics.rafId = window.requestAnimationFrame(runPanDragMetricsTick);

    setIsStagePanning(true);
  };

  // Handle pan on drag end — only update pan when the Stage itself was dragged,
  // not when a child object's dragend event bubbles up to the Stage.
  const handleDragEnd = (e: KonvaEventObject<DragEvent>): void => {
    if (e.target !== stageRef.current) return;

    const panMetrics = panDragMetricsRef.current;
    panMetrics.active = false;
    if (panMetrics.rafId !== null) {
      window.cancelAnimationFrame(panMetrics.rafId);
      panMetrics.rafId = null;
    }
    if (panMetrics.idleResetTimer !== null) {
      clearTimeout(panMetrics.idleResetTimer);
    }
    panMetrics.idleResetTimer = setTimeout(() => {
      setPanDragFps(null);
    }, 700);
    setIsStagePanning(false);

    const stage = e.target as Konva.Stage;
    const nextViewport = {
      zoom: viewportRef.current.zoom,
      pan: { x: stage.x(), y: stage.y() },
    };
    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  };

  // Handle mouse move — emit throttled cursor event AND update shape preview
  const handleMouseMove = (): void => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Convert screen coordinates to canvas coordinates
    const canvasX = (pointerPos.x - stage.x()) / stage.scaleX();
    const canvasY = (pointerPos.y - stage.y()) / stage.scaleY();

    // Emit cursor event through the shared throttle helper (~20-30Hz target)
    if (sessionUserIdRef.current) {
      emitCursorMoveThrottledRef.current({
        userId: sessionUserIdRef.current,
        userName: sessionUserNameRef.current,
        x: canvasX,
        y: canvasY,
        color: userColor,
        sentAt: Date.now(),
      });
    }

    // Update marquee selection rectangle while shift-dragging on empty canvas.
    if (marqueeSelection) {
      setMarqueeSelection((prev) =>
        prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null,
      );
      return;
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
    const pendingObjectChangeIds = pendingObjectChangeIdsRef.current;
    const boardObjectIndexById = boardObjectIndexByIdRef.current;
    let frameId: number | null = null;
    let isInitialFlush = true;

    const flushBoardObjects = (): void => {
      frameId = null;
      const changedKeysSnapshot = Array.from(pendingObjectChangeIds);
      pendingObjectChangeIds.clear();
      const runFullLoad = isInitialFlush;
      isInitialFlush = false;

      setBoardObjects((previousObjects) => {
        const nextObjects = runFullLoad
          ? getAllObjects(objects)
          : applyObjectMapChanges(previousObjects, objects, changedKeysSnapshot);

        // Keep index cache aligned with the computed next state. Rebuilding from
        // nextObjects avoids stale-index issues when React double-invokes state
        // updaters in development.
        boardObjectIndexById.clear();
        for (let index = 0; index < nextObjects.length; index += 1) {
          boardObjectIndexById.set(nextObjects[index].id, index);
        }

        if (process.env.NODE_ENV === 'development') {
          const now = Date.now();
          const metrics = boardObserverMetricsRef.current;
          metrics.flushedInWindow += 1;

          if (metrics.lastLogAt === 0) {
            metrics.lastLogAt = now;
            return nextObjects;
          }

          const elapsedMs = now - metrics.lastLogAt;
          if (elapsedMs >= 5000) {
            console.debug('[Canvas Perf] yjs observer throughput', {
              observedPerSecond: Number(
                (metrics.observedInWindow / (elapsedMs / 1000)).toFixed(1),
              ),
              flushedPerSecond: Number(
                (metrics.flushedInWindow / (elapsedMs / 1000)).toFixed(1),
              ),
              objectCount: nextObjects.length,
            });

            metrics.observedInWindow = 0;
            metrics.flushedInWindow = 0;
            metrics.lastLogAt = now;
          }
        }

        return nextObjects;
      });
    };

    const scheduleBoardFlush = (): void => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(flushBoardObjects);
    };

    const observer = (event: Y.YMapEvent<BoardObject>): void => {
      if (process.env.NODE_ENV === 'development') {
        boardObserverMetricsRef.current.observedInWindow += 1;
      }

      const now = Date.now();
      for (const key of event.keysChanged) {
        pendingObjectChangeIds.add(key);
        const changedObject = objects.get(key);
        if (!changedObject) continue;
        if (changedObject.createdBy === sessionUserIdRef.current) continue;

        const updatedAtMs = Date.parse(changedObject.updatedAt);
        if (!Number.isFinite(updatedAtMs)) continue;

        const latencyMs = now - updatedAtMs;
        if (latencyMs < 0 || latencyMs > 5000) continue;

        const averageLatencyMs = appendRollingSample(
          objectSyncSamplesRef.current,
          latencyMs,
          20,
        );
        if (now - performanceHudUpdateRef.current.objectLatencyUpdatedAt >= 250) {
          setObjectSyncLatencyMs(averageLatencyMs);
          performanceHudUpdateRef.current.objectLatencyUpdatedAt = now;
        }
      }

      scheduleBoardFlush();
    };

    // Observe changes
    objects.observe(observer);

    // Initial load
    pendingObjectChangeIds.clear();
    flushBoardObjects();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      objects.unobserve(observer);
      pendingObjectChangeIds.clear();
      boardObjectIndexById.clear();
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
        setOnlineUsersCount(1);
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

  // Track online user count for live performance indicator panel.
  useEffect(() => {
    if (!provider) return;

    const updateOnlineUsers = (): void => {
      const states = Array.from(provider.awareness.getStates().values()) as AwarenessState[];
      const userIds = new Set<string>();
      for (const state of states) {
        const userId = state.user?.userId;
        if (userId) userIds.add(userId);
      }
      setOnlineUsersCount(userIds.size);
    };

    provider.awareness.on('change', updateOnlineUsers);
    updateOnlineUsers();

    return () => {
      provider.awareness.off('change', updateOnlineUsers);
    };
  }, [provider]);

  // Remote cursor state and cleanup are handled inside RemoteCursorsLayer
  // to prevent cursor updates from re-rendering sticky notes and the grid.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const now = Date.now();
    const metrics = renderMetricsRef.current;
    if (metrics.lastLogAt !== 0 && now - metrics.lastLogAt < 5000) {
      return;
    }

    metrics.lastLogAt = now;
    console.debug('[Canvas Perf] render sample', {
      totalObjects: boardObjects.length,
      renderedObjects: visibleBoardObjects.length,
      culledObjects: Math.max(boardObjects.length - visibleBoardObjects.length, 0),
      zoom,
    });
  }, [boardObjects.length, visibleBoardObjects.length, zoom]);

  const isColorPickerEligible = (object: BoardObject | undefined): boolean =>
    !!object &&
    object.type !== 'line' &&
    object.type !== 'connector' &&
    object.type !== 'frame' &&
    object.type !== 'text';

  const applySelection = (
    objectIds: string[],
    preferredPrimaryId: string | null =
      objectIds.length > 0 ? objectIds[objectIds.length - 1] : null,
  ): void => {
    multiDragSessionRef.current = null;
    selectedObjectIdsRef.current = objectIds;
    setSelectedObjectIds(objectIds);
    setSelectedObjectId(preferredPrimaryId);

    if (objectIds.length !== 1) {
      setShowColorPicker(false);
      return;
    }

    const selectedObject = objectLookup.get(objectIds[0]);
    setShowColorPicker(isColorPickerEligible(selectedObject));
  };
  applySelectionRef.current = applySelection;

  const handleCursorLatencySample = (latencyMs: number): void => {
    const averageLatencyMs = appendRollingSample(
      cursorSyncSamplesRef.current,
      latencyMs,
      20,
    );
    const now = Date.now();
    if (now - performanceHudUpdateRef.current.cursorLatencyUpdatedAt >= 250) {
      setCursorSyncLatencyMs(averageLatencyMs);
      performanceHudUpdateRef.current.cursorLatencyUpdatedAt = now;
    }
  };

  // Handle keyboard shortcuts (delete + select all)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const key = (e.key ?? '').toLowerCase();
      const isSelectAllShortcut =
        (e.metaKey || e.ctrlKey) && !e.altKey && (key === 'a' || e.code === 'KeyA');
      const currentEditingObjectId = editingObjectIdRef.current;
      const currentSelectedObjectIds = selectedObjectIdsRef.current;

      // Keep native text-selection behavior in focused text inputs.
      if (isSelectAllShortcut && isTextEditableTarget(e.target)) {
        return;
      }

      if (isSelectAllShortcut && !currentEditingObjectId) {
        e.preventDefault();
        const allObjectIds = boardObjectsRef.current.map((object) => object.id);
        applySelectionRef.current(allObjectIds);
        return;
      }

      if (
        !isDeleteKeyboardEvent(e) ||
        currentSelectedObjectIds.length === 0 ||
        currentEditingObjectId
      ) {
        return;
      }

      e.preventDefault();
      const currentDoc = yDocRef.current;
      if (!currentDoc) return;

      const objects = currentDoc.getMap<BoardObject>('objects');
      const selectedIds = new Set(currentSelectedObjectIds);

      currentSelectedObjectIds.forEach((id) => {
        removeObject(objects, id);
      });

      // Remove any connectors whose fromId or toId referenced a deleted object
      objects.forEach((obj, key) => {
        if (obj.type !== 'connector') return;
        const fromId =
          typeof obj.properties.fromId === 'string' ? obj.properties.fromId : '';
        const toId =
          typeof obj.properties.toId === 'string' ? obj.properties.toId : '';
        if (selectedIds.has(fromId) || selectedIds.has(toId)) {
          objects.delete(key);
        }
      });

      applySelectionRef.current([]);
    };

    // Capture phase ensures board shortcuts still fire when nested components
    // attach their own key handlers.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Create single-click objects (sticky note / text) on empty canvas
  const handleStageClick = async (e: KonvaEventObject<MouseEvent>): Promise<void> => {
    const stage = stageRef.current;
    const canCreateSingleClickObject = selectedTool === 'sticky' || selectedTool === 'text';
    if (!stage || !yDoc || !canCreateSingleClickObject) return;

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

    const objects = yDoc.getMap<BoardObject>('objects');
    if (selectedTool === 'sticky') {
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

      addObject(objects, newNote);

      // Switch back to select tool
      setSelectedTool('select');
      applySelection([newNote.id], newNote.id);
      setShowColorPicker(true);

      console.log('[Canvas] Created sticky note:', newNote.id);
      return;
    }

    const newText: BoardObject = {
      id: crypto.randomUUID(),
      type: 'text',
      x: canvasX,
      y: canvasY,
      width: 240,
      height: 56,
      rotation: 0,
      zIndex: boardObjects.length + 1,
      properties: {
        text: '',
        textColor: '#1f2937',
        fontSize: 28,
      },
      createdBy: session.user.id,
      updatedAt: new Date().toISOString(),
    };

    addObject(objects, newText);
    setSelectedTool('select');
    applySelection([newText.id], newText.id);
    setShowColorPicker(false);
    setEditingObjectId(newText.id);

    console.log('[Canvas] Created text object:', newText.id);
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
  const handleSelectObject = (
    id: string,
    options?: { additive: boolean },
  ): void => {
    if (selectedTool === 'connector') {
      handleConnectorObjectClick(id);
      return;
    }

    if (options?.additive) {
      const currentlySelected = selectedObjectIdSet.has(id);
      const nextIds = currentlySelected
        ? selectedObjectIds.filter((selectedId) => selectedId !== id)
        : [...selectedObjectIds, id];

      applySelection(
        nextIds,
        currentlySelected && selectedObjectId === id
          ? (nextIds.length > 0 ? nextIds[nextIds.length - 1] : null)
          : id,
      );
      return;
    }

    applySelection([id], id);
  };

  const handleAICommandMetrics = (metrics: {
    elapsedMs: number;
    success: boolean;
    objectsAffected: number;
  }): void => {
    if (!metrics.success || metrics.objectsAffected <= 0) return;
    setAiPromptExecutionMs(metrics.elapsedMs);
  };

  const clearMultiDragSession = (): void => {
    const session = multiDragSessionRef.current;
    if (!session) return;
    if (session.rafId !== null) {
      window.cancelAnimationFrame(session.rafId);
    }
    setIsMultiDragActive(false);
    multiDragSessionRef.current = null;
  };

  const flushMultiDragPreview = (): void => {
    const session = multiDragSessionRef.current;
    if (!session) return;

    session.rafId = null;

    const primaryPosition = session.pendingPrimaryPosition;
    if (!primaryPosition) return;
    session.pendingPrimaryPosition = null;

    const dragDelta = computePrimaryDragDelta(
      session.initialPositions,
      session.primaryId,
      primaryPosition,
    );
    if (!dragDelta) return;

    for (const follower of session.followerNodes) {
      follower.node.position({
        x: follower.initialX + dragDelta.x,
        y: follower.initialY + dragDelta.y,
      });
    }

    const layer =
      shapeRefs.current.get(session.primaryId)?.getLayer()
      ?? session.followerNodes[0]?.node.getLayer();
    layer?.batchDraw();
  };

  const handleObjectDragStart = (id: string): void => {
    setIsObjectDragging(true);

    if (selectedObjectIds.length < 2 || !selectedObjectIdSet.has(id)) {
      clearMultiDragSession();
      return;
    }

    const movableIds = getMovableSelectionIds(selectedObjectIds, objectLookup);
    if (movableIds.length < 2 || !movableIds.includes(id)) {
      clearMultiDragSession();
      return;
    }

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const selectedId of movableIds) {
      const object = objectLookup.get(selectedId);
      if (!object) continue;
      initialPositions.set(selectedId, { x: object.x, y: object.y });
    }

    const primaryInitial = initialPositions.get(id);
    if (!primaryInitial) {
      clearMultiDragSession();
      return;
    }

    const followerNodes: Array<{ node: Konva.Node; initialX: number; initialY: number }> = [];
    for (const selectedId of movableIds) {
      if (selectedId === id) continue;
      const node = shapeRefs.current.get(selectedId);
      const initialPosition = initialPositions.get(selectedId);
      if (!node || !initialPosition) continue;
      followerNodes.push({
        node,
        initialX: initialPosition.x,
        initialY: initialPosition.y,
      });
    }

    multiDragSessionRef.current = {
      primaryId: id,
      movableIds,
      initialPositions,
      followerNodes,
      pendingPrimaryPosition: primaryInitial,
      rafId: null,
    };
    setIsMultiDragActive(true);
  };

  const handleObjectDragMove = (id: string, x: number, y: number): void => {
    const session = multiDragSessionRef.current;
    if (!session || session.primaryId !== id) return;

    session.pendingPrimaryPosition = { x, y };
    if (session.rafId !== null) return;
    session.rafId = window.requestAnimationFrame(flushMultiDragPreview);
  };

  // Handle object drag end — update position in Yjs
  const handleObjectDragEnd = (id: string, x: number, y: number): void => {
    setIsObjectDragging(false);

    if (!yDoc) {
      clearMultiDragSession();
      return;
    }
    const objects = yDoc.getMap<BoardObject>('objects');
    const session = multiDragSessionRef.current;

    if (session && session.primaryId === id) {
      if (session.rafId !== null) {
        window.cancelAnimationFrame(session.rafId);
        session.rafId = null;
      }
      session.pendingPrimaryPosition = { x, y };
      flushMultiDragPreview();

      const dragDelta = computePrimaryDragDelta(
        session.initialPositions,
        id,
        { x, y },
      );
      if (!dragDelta) {
        clearMultiDragSession();
        return;
      }

      const updates = buildMovedPositionUpdates(
        session.movableIds,
        session.initialPositions,
        dragDelta,
      );
      const updatedAt = new Date().toISOString();

      yDoc.transact(() => {
        updateObjectPositions(objects, updates, updatedAt);
      });

      clearMultiDragSession();
      return;
    }

    updateObject(objects, id, { x, y });
  };

  // Attach/detach Transformer when the selection changes.
  // For now, resize/rotate handles stay in single-object mode.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const isSingleSelection = selectedObjectIds.length === 1;
    const selected = selectedObjectId ? objectLookup.get(selectedObjectId) : undefined;
    // Lines and connectors don't get resize/rotate handles
    const excluded = !selected || selected.type === 'line' || selected.type === 'connector';
    const node =
      isSingleSelection && selectedObjectId
        ? shapeRefs.current.get(selectedObjectId)
        : undefined;

    tr.nodes(node && !excluded ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedObjectId, selectedObjectIds, objectLookup]);

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
    const isStageTarget = e.target === stage;

    // Canvas interactions should relinquish focus from text inputs (e.g. AI bar)
    // so keyboard shortcuts like Cmd/Ctrl+A apply to board objects.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Shift+drag on empty canvas enters marquee selection mode.
    if (selectedTool === 'select' && isStageTarget && e.evt.shiftKey) {
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const canvasX = (pos.x - stage.x()) / stage.scaleX();
      const canvasY = (pos.y - stage.y()) / stage.scaleY();

      stage.draggable(false);
      setMarqueeSelection({
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
        additive: e.evt.metaKey || e.evt.ctrlKey,
      });
      setShowColorPicker(false);
      return;
    }

    // Deselect when clicking empty canvas
    if (isStageTarget) {
      applySelection([]);
    }

    // Cancel connector flow on empty-canvas click
    if (selectedTool === 'connector' && isStageTarget) {
      setConnectingFrom(null);
    }

    // Start drawing if a shape or frame tool is active and target is empty canvas
    const shapeTool = selectedTool as string;
    if (
      (shapeTool === 'rectangle' || shapeTool === 'circle' || shapeTool === 'line' || shapeTool === 'frame') &&
      isStageTarget
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

    if (marqueeSelection) {
      const left = Math.min(marqueeSelection.startX, marqueeSelection.currentX);
      const top = Math.min(marqueeSelection.startY, marqueeSelection.currentY);
      const right = Math.max(marqueeSelection.startX, marqueeSelection.currentX);
      const bottom = Math.max(marqueeSelection.startY, marqueeSelection.currentY);
      const width = right - left;
      const height = bottom - top;

      if (width < 4 || height < 4) {
        if (!marqueeSelection.additive) {
          applySelection([]);
        }
        setMarqueeSelection(null);
        return;
      }

      const intersectingIds = selectIntersectingObjectIds(boardObjects, {
        left,
        top,
        right,
        bottom,
      }, objectLookup);
      const nextIds = marqueeSelection.additive
        ? Array.from(new Set([...selectedObjectIds, ...intersectingIds]))
        : intersectingIds;

      applySelection(nextIds);
      setMarqueeSelection(null);
      return;
    }

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
    applySelection([newShape.id], newShape.id);
    setShowColorPicker(type !== 'line' && type !== 'frame');

    console.log(`[Canvas] Created ${type}:`, newShape.id);
  };

  if (dimensions.width === 0 || dimensions.height === 0 || !viewportReady) {
    return null; // Wait for dimensions and viewport rehydration before rendering
  }

  // Get editing object details
  const editingObject = editingObjectId
    ? objectLookup.get(editingObjectId) ?? null
    : null;

  // Get selected object for color picker
  const selectedObject = selectedObjectIds.length === 1 && selectedObjectId
    ? objectLookup.get(selectedObjectId) ?? null
    : null;

  return (
    <div className="fixed inset-0 bg-gray-50">
      <BoardHeader boardName={boardName} />

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

      {/* Live project performance targets panel */}
      <PerformanceHUD
        fps={fps}
        objectSyncLatencyMs={objectSyncLatencyMs}
        cursorSyncLatencyMs={cursorSyncLatencyMs}
        zoomSpeedPercentPerSecond={zoomSpeedPercentPerSecond}
        panDragFps={panDragFps}
        aiPromptExecutionMs={aiPromptExecutionMs}
        objectCount={boardObjects.length}
        onlineUsers={onlineUsersCount}
        yjsConnected={yjsConnected}
        socketConnected={socketConnected}
      />

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
        onDragStart={handleStageDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        x={pan.x}
        y={pan.y}
        scaleX={zoom}
        scaleY={zoom}
        style={{
          cursor: ['rectangle', 'circle', 'line', 'frame'].includes(selectedTool)
            ? 'crosshair'
            : selectedTool === 'connector'
              ? 'cell'
              : selectedTool === 'text'
                ? 'text'
                : 'default',
        }}
      >
        {/* Grid background */}
        <Grid
          width={dimensions.width}
          height={dimensions.height}
          scale={zoom}
          offsetX={pan.x}
          offsetY={pan.y}
          isPanning={isStagePanning || isWheelZooming}
        />

        {/* Main content layer */}
        <Layer>
          {/* 1. Frames — bottom, behind everything */}
          {layeredVisibleObjects.frames.map((obj) => (
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
                isSelected={selectedObjectIdSet.has(obj.id) && !editingObjectId}
                onSelect={handleSelectObject}
                onDragStart={handleObjectDragStart}
                onDragMove={handleObjectDragMove}
                onDragEnd={handleObjectDragEnd}
                onDoubleClick={handleDoubleClick}
                onTransformEnd={handleTransformEnd}
              />
            ))}

          {/* 2. Connectors — above frames, below shapes */}
          {layeredVisibleObjects.connectors.map((connector) => (
              <Connector
                key={connector.object.id}
                id={connector.object.id}
                fromId={connector.fromId}
                toId={connector.toId}
                color={connector.color}
                strokeWidth={connector.strokeWidth}
                points={connector.points}
                objectLookup={objectLookup}
                isSelected={selectedObjectIdSet.has(connector.object.id) && !editingObjectId}
                onSelect={handleSelectObject}
              />
            ))}

          {/* 3. Shapes */}
          {layeredVisibleObjects.shapes.map((obj) => (
              <Shape
                key={obj.id}
                ref={(node) => {
                  if (node) shapeRefs.current.set(obj.id, node);
                  else shapeRefs.current.delete(obj.id);
                }}
                id={obj.id}
                type={obj.type as 'rectangle' | 'circle' | 'line' | 'text'}
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
                textContent={obj.type === 'text' ? String(obj.properties.text ?? '') : undefined}
                textColor={obj.type === 'text' ? String(obj.properties.textColor ?? '#1f2937') : undefined}
                fontSize={obj.type === 'text' ? Number(obj.properties.fontSize ?? 28) : undefined}
                isSelected={selectedObjectIdSet.has(obj.id) && !editingObjectId}
                reduceEffects={simplifyDenseInteractionRendering}
                onSelect={handleSelectObject}
                onDragStart={handleObjectDragStart}
                onDragMove={handleObjectDragMove}
                onDragEnd={handleObjectDragEnd}
                onTransformEnd={handleTransformEnd}
                onDoubleClick={obj.type === 'text' ? handleDoubleClick : undefined}
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
              reduceEffects={false}
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

          {/* 4b. Marquee selection rectangle (Shift + drag on empty canvas) */}
          {marqueeSelection && (
            <Rect
              x={Math.min(marqueeSelection.startX, marqueeSelection.currentX)}
              y={Math.min(marqueeSelection.startY, marqueeSelection.currentY)}
              width={Math.abs(marqueeSelection.currentX - marqueeSelection.startX)}
              height={Math.abs(marqueeSelection.currentY - marqueeSelection.startY)}
              fill="rgba(59,130,246,0.12)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
            />
          )}

          {/* 5. Sticky notes — top */}
          {layeredVisibleObjects.stickyNotes.map((obj) => (
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
                isSelected={selectedObjectIdSet.has(obj.id) && !editingObjectId}
                reduceEffects={simplifyDenseInteractionRendering}
                hideText={simplifyDenseInteractionRendering}
                onSelect={handleSelectObject}
                onDragStart={handleObjectDragStart}
                onDragMove={handleObjectDragMove}
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
            onLatencySample={handleCursorLatencySample}
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

      {/* AI Command Bar */}
      <AICommandBar boardId={boardId} onCommandMetrics={handleAICommandMetrics} />

      {/* Hidden board ID for testing */}
      <div className="sr-only" data-testid="board-id">
        {boardId}
      </div>
    </div>
  );
}
