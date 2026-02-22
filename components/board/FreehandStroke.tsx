'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Group, Line } from 'react-konva';
import Konva from 'konva';

interface FreehandStrokeProps {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  points: number[];
  strokeColor: string;
  strokeWidth: number;
  isSelected: boolean;
  isInteractive?: boolean;
  onSelect: (id: string, options?: { additive: boolean }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export const FreehandStroke = forwardRef<Konva.Group, FreehandStrokeProps>(
  function FreehandStroke(
    {
      id,
      x,
      y,
      rotation,
      points,
      strokeColor,
      strokeWidth,
      isSelected,
      isInteractive = true,
      onSelect,
      onDragStart,
      onDragMove,
      onDragEnd,
    },
    ref,
  ): React.ReactElement | null {
    const internalRef = useRef<Konva.Group>(null);

    useEffect(() => {
      const group = internalRef.current;
      if (!group) return;

      const stage = group.getStage();
      if (!stage) return;

      const handleDragStart = (): void => {
        stage.draggable(false);
      };
      const handleDragEnd = (): void => {
        stage.draggable(true);
      };

      group.on('dragstart', handleDragStart);
      group.on('dragend', handleDragEnd);

      return () => {
        group.off('dragstart', handleDragStart);
        group.off('dragend', handleDragEnd);
      };
    }, []);

    const mergeRef = (node: Konva.Group | null): void => {
      (internalRef as React.MutableRefObject<Konva.Group | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<Konva.Group | null>).current = node;
      }
    };

    if (points.length < 2) {
      return null;
    }

    const isDraggable = isInteractive;
    const hitStrokeWidth = Math.max(strokeWidth + 14, 18);

    return (
      <Group
        ref={mergeRef}
        x={x}
        y={y}
        rotation={rotation ?? 0}
        draggable={isDraggable}
        onClick={(e) => {
          if (!isInteractive) return;
          onSelect(id, {
            additive: e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
          });
        }}
        onTap={() => {
          if (!isInteractive) return;
          onSelect(id);
        }}
        onDragStart={() => {
          if (!isDraggable) return;
          onDragStart?.(id);
        }}
        onDragMove={(e) => {
          if (!isDraggable) return;
          const node = e.target;
          onDragMove?.(id, node.x(), node.y());
        }}
        onDragEnd={(e) => {
          if (!isDraggable) return;
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
      >
        <Line
          points={points}
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
          lineCap="round"
          lineJoin="round"
          listening={isInteractive}
        />
        <Line
          points={points}
          stroke={isSelected ? '#2563eb' : strokeColor}
          strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
          lineCap="round"
          lineJoin="round"
          tension={0.2}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  },
);
