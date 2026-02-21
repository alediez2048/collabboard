'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Group, Rect, Circle, Line, Text as KonvaText } from 'react-konva';
import Konva from 'konva';

interface ShapeProps {
  id: string;
  type: 'rectangle' | 'circle' | 'line' | 'text';
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
  textContent?: string;
  textColor?: string;
  fontSize?: number;
  isSelected: boolean;
  reduceEffects?: boolean;
  onSelect: (id: string, options?: { additive: boolean }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
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
    textContent,
    textColor,
    fontSize,
    isSelected,
    reduceEffects,
    onSelect,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformEnd,
    onDoubleClick,
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
        onClick={(e) =>
          onSelect(id, {
            additive: e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
          })
        }
        onTap={() => onSelect(id)}
        onDragStart={() => onDragStart?.(id)}
        onDragMove={(e) => {
          const node = e.target;
          onDragMove?.(id, node.x(), node.y());
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
        onDblClick={() => onDoubleClick?.(id)}
        onDblTap={() => onDoubleClick?.(id)}
        onTransformEnd={() => onTransformEnd?.(id)}
      >
        {/* Wider transparent hit area so the line is easier to click */}
        <Line
          points={[0, 0, endDx, endDy]}
          stroke="transparent"
          strokeWidth={Math.max(strokeWidth + 12, 16)}
          perfectDrawEnabled={false}
          listening={true}
        />
        {/* Visible line */}
        <Line
          points={[0, 0, endDx, endDy]}
          stroke={isSelected ? '#2563eb' : strokeColor}
          strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
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
        onClick={(e) =>
          onSelect(id, {
            additive: e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
          })
        }
        onTap={() => onSelect(id)}
        onDragStart={() => onDragStart?.(id)}
        onDragMove={(e) => {
          const node = e.target;
          onDragMove?.(id, node.x(), node.y());
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
        onDblClick={() => onDoubleClick?.(id)}
        onDblTap={() => onDoubleClick?.(id)}
        onTransformEnd={() => onTransformEnd?.(id)}
      >
        <Circle
          x={cx}
          y={cy}
          radius={radius}
          fill={fillColor}
          stroke={selectionStroke ?? strokeColor}
          strokeWidth={selectionStrokeWidth ?? strokeWidth}
          shadowColor={reduceEffects ? 'transparent' : 'rgba(0,0,0,0.15)'}
          shadowBlur={reduceEffects ? 0 : 6}
          shadowOffset={reduceEffects ? { x: 0, y: 0 } : { x: 0, y: 3 }}
          shadowOpacity={reduceEffects ? 0 : 0.3}
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  if (type === 'text') {
    return (
      <Group
        ref={mergeRef}
        x={x}
        y={y}
        rotation={rotation ?? 0}
        draggable
        onClick={(e) =>
          onSelect(id, {
            additive: e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
          })
        }
        onTap={() => onSelect(id)}
        onDblClick={() => onDoubleClick?.(id)}
        onDblTap={() => onDoubleClick?.(id)}
        onDragStart={() => onDragStart?.(id)}
        onDragMove={(e) => {
          const node = e.target;
          onDragMove?.(id, node.x(), node.y());
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
        onTransformEnd={() => onTransformEnd?.(id)}
      >
        <Rect
          width={width}
          height={height}
          fill="rgba(255,255,255,0.01)"
          stroke={isSelected ? '#2563eb' : 'transparent'}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
          perfectDrawEnabled={false}
        />
        <KonvaText
          text={textContent ?? ''}
          x={6}
          y={4}
          width={Math.max(width - 12, 24)}
          height={Math.max(height - 8, 20)}
          fontSize={fontSize ?? 28}
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fill={textColor ?? '#1f2937'}
          align="left"
          verticalAlign="top"
          wrap="word"
          listening={false}
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
      onClick={(e) =>
        onSelect(id, {
          additive: e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
        })
      }
      onTap={() => onSelect(id)}
      onDragStart={() => onDragStart?.(id)}
      onDragMove={(e) => {
        const node = e.target;
        onDragMove?.(id, node.x(), node.y());
      }}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd(id, node.x(), node.y());
      }}
      onDblClick={() => onDoubleClick?.(id)}
      onDblTap={() => onDoubleClick?.(id)}
      onTransformEnd={() => onTransformEnd?.(id)}
    >
      <Rect
        width={width}
        height={height}
        fill={fillColor}
        stroke={selectionStroke ?? strokeColor}
        strokeWidth={selectionStrokeWidth ?? strokeWidth}
        cornerRadius={4}
        shadowColor={reduceEffects ? 'transparent' : 'rgba(0,0,0,0.15)'}
        shadowBlur={reduceEffects ? 0 : 6}
        shadowOffset={reduceEffects ? { x: 0, y: 0 } : { x: 0, y: 3 }}
        shadowOpacity={reduceEffects ? 0 : 0.3}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
