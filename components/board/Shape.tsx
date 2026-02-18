'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Group, Rect, Circle, Line } from 'react-konva';
import Konva from 'konva';

interface ShapeProps {
  id: string;
  type: 'rectangle' | 'circle' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  x2?: number;
  y2?: number;
  rotation?: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd?: (id: string) => void;
}

export const Shape = forwardRef<Konva.Group, ShapeProps>(function Shape(
  {
    id,
    type,
    x,
    y,
    width,
    height,
    fillColor,
    strokeColor,
    strokeWidth,
    x2,
    y2,
    rotation,
    isSelected,
    onSelect,
    onDragEnd,
    onTransformEnd,
  },
  ref,
): React.ReactElement {
  const internalRef = useRef<Konva.Group>(null);

  // Disable stage dragging while dragging this shape (same pattern as StickyNote)
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

  // Merge the internal ref and the forwarded ref onto the same node
  const mergeRef = (node: Konva.Group | null): void => {
    (internalRef as React.MutableRefObject<Konva.Group | null>).current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<Konva.Group | null>).current = node;
    }
  };

  const selectionStroke = isSelected ? '#2563eb' : undefined;
  const selectionStrokeWidth = isSelected ? 3 : undefined;

  if (type === 'line') {
    const endDx = (x2 ?? x) - x;
    const endDy = (y2 ?? y) - y;

    return (
      <Group
        ref={mergeRef}
        x={x}
        y={y}
        rotation={rotation ?? 0}
        draggable
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
        onTransformEnd={() => onTransformEnd?.(id)}
      >
        {/* Wider transparent hit area so the line is easier to click */}
        <Line
          points={[0, 0, endDx, endDy]}
          stroke="transparent"
          strokeWidth={Math.max(strokeWidth + 12, 16)}
          listening={true}
        />
        {/* Visible line */}
        <Line
          points={[0, 0, endDx, endDy]}
          stroke={isSelected ? '#2563eb' : strokeColor}
          strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      </Group>
    );
  }

  if (type === 'circle') {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;

    return (
      <Group
        ref={mergeRef}
        x={x}
        y={y}
        rotation={rotation ?? 0}
        draggable
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
        onTransformEnd={() => onTransformEnd?.(id)}
      >
        <Circle
          x={cx}
          y={cy}
          radius={radius}
          fill={fillColor}
          stroke={selectionStroke ?? strokeColor}
          strokeWidth={selectionStrokeWidth ?? strokeWidth}
          shadowColor="rgba(0,0,0,0.15)"
          shadowBlur={6}
          shadowOffset={{ x: 0, y: 3 }}
          shadowOpacity={0.3}
        />
      </Group>
    );
  }

  // Rectangle (default)
  return (
    <Group
      ref={mergeRef}
      x={x}
      y={y}
      rotation={rotation ?? 0}
      draggable
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd(id, node.x(), node.y());
      }}
      onTransformEnd={() => onTransformEnd?.(id)}
    >
      <Rect
        width={width}
        height={height}
        fill={fillColor}
        stroke={selectionStroke ?? strokeColor}
        strokeWidth={selectionStrokeWidth ?? strokeWidth}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={6}
        shadowOffset={{ x: 0, y: 3 }}
        shadowOpacity={0.3}
      />
    </Group>
  );
});
