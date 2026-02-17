'use client';

import { useEffect, useRef } from 'react';
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
  x2?: number; // line end point (absolute canvas coords)
  y2?: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function Shape({
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
  isSelected,
  onSelect,
  onDragEnd,
}: ShapeProps): React.ReactElement {
  const groupRef = useRef<Konva.Group>(null);

  // Disable stage dragging while dragging this shape (same pattern as StickyNote)
  useEffect(() => {
    const group = groupRef.current;
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

  const selectionStroke = isSelected ? '#2563eb' : undefined;
  const selectionStrokeWidth = isSelected ? 3 : undefined;

  // Lines are not draggable as a Group positioned at (x,y) with relative points.
  // We position the Group at (x, y) and draw to (x2 - x, y2 - y).
  if (type === 'line') {
    const endDx = (x2 ?? x) - x;
    const endDy = (y2 ?? y) - y;

    return (
      <Group
        ref={groupRef}
        x={x}
        y={y}
        draggable
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
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
    // Store x/y as bounding-box top-left; Konva Circle positions by center
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;

    return (
      <Group
        ref={groupRef}
        x={x}
        y={y}
        draggable
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
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
      ref={groupRef}
      x={x}
      y={y}
      draggable
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd(id, node.x(), node.y());
      }}
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
}
