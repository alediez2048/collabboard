'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface FrameProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  fillColor: string;
  strokeColor: string;
  rotation?: number;
  isSelected: boolean;
  isInteractive?: boolean;
  onSelect: (id: string, options?: { additive: boolean }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
  onTransformEnd?: (id: string) => void;
}

export const Frame = forwardRef<Konva.Group, FrameProps>(function Frame(
  {
    id,
    x,
    y,
    width,
    height,
    title,
    fillColor,
    strokeColor,
    rotation,
    isSelected,
    isInteractive = true,
    onSelect,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDoubleClick,
    onTransformEnd,
  },
  ref,
): React.ReactElement {
  const internalRef = useRef<Konva.Group>(null);

  // Disable stage dragging while dragging this frame (same pattern as StickyNote/Shape)
  useEffect(() => {
    const group = internalRef.current;
    if (!group) return;

    const stage = group.getStage();
    if (!stage) return;

    const handleDragStart = (): void => {
      stage.draggable(false);
    };
    const handleDragEndEvt = (): void => {
      stage.draggable(true);
    };

    group.on('dragstart', handleDragStart);
    group.on('dragend', handleDragEndEvt);

    return () => {
      group.off('dragstart', handleDragStart);
      group.off('dragend', handleDragEndEvt);
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

  return (
    <Group
      ref={mergeRef}
      x={x}
      y={y}
      rotation={rotation ?? 0}
      draggable={isInteractive}
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
      onDblClick={() => {
        if (!isInteractive) return;
        onDoubleClick(id);
      }}
      onDblTap={() => {
        if (!isInteractive) return;
        onDoubleClick(id);
      }}
      onDragStart={() => {
        if (!isInteractive) return;
        onDragStart?.(id);
      }}
      onDragMove={(e) => {
        if (!isInteractive) return;
        const node = e.target;
        onDragMove?.(id, node.x(), node.y());
      }}
      onDragEnd={(e) => {
        if (!isInteractive) return;
        const node = e.target;
        onDragEnd(id, node.x(), node.y());
      }}
      onTransformEnd={() => {
        if (!isInteractive) return;
        onTransformEnd?.(id);
      }}
    >
      {/* Title label above the frame */}
      <Text
        text={title || 'Frame'}
        x={0}
        y={-28}
        fontSize={13}
        fill={isSelected ? '#3b82f6' : '#000000'}
        fontStyle="bold"
        listening={false}
      />
      {/* Frame border + fill */}
      <Rect
        width={width}
        height={height}
        fill={fillColor}
        stroke={isSelected ? '#3b82f6' : (strokeColor === 'transparent' ? strokeColor : '#000000')}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
      />
    </Group>
  );
});
