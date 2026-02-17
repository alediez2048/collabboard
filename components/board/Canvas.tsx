'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useUIStore } from '@/stores/ui-store';
import { Grid } from './Grid';
import { Toolbar } from './Toolbar';

interface CanvasProps {
  boardId: string;
}

export function Canvas({ boardId }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { zoom, pan, setZoom, setPan } = useUIStore();

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

  if (dimensions.width === 0 || dimensions.height === 0) {
    return null; // Avoid rendering with 0 dimensions
  }

  return (
    <div className="fixed inset-0 bg-gray-50">
      {/* Toolbar */}
      <Toolbar />

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2">
        <span className="text-sm font-medium text-gray-700">
          {Math.round(zoom * 100)}%
        </span>
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
