'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface StickyNoteProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  rotation?: number;
  isSelected: boolean;
  isInteractive?: boolean;
  reduceEffects?: boolean;
  hideText?: boolean;
  onSelect: (id: string, options?: { additive: boolean }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
  onTransformEnd?: (id: string) => void;
}

export const StickyNote = forwardRef<Konva.Group, StickyNoteProps>(
  function StickyNote(
    {
      id,
      x,
      y,
      width,
      height,
      text,
      color,
      rotation,
      isSelected,
      isInteractive = true,
      reduceEffects,
      hideText,
      onSelect,
      onDragStart,
      onDragMove,
      onDragEnd,
      onDoubleClick,
      onTransformEnd,
    },
    ref,
  ) {
    const internalRef = useRef<Konva.Group>(null);

    // Disable stage dragging when dragging this sticky note
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

    return (
      <Group
        ref={(node) => {
          // Populate both the internal ref (for dragstart/dragend) and the forwarded ref
          (internalRef as React.MutableRefObject<Konva.Group | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<Konva.Group | null>).current = node;
          }
        }}
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
        {/* Background rectangle */}
        <Rect
          width={width}
          height={height}
          fill={color}
          cornerRadius={8}
          shadowColor={reduceEffects ? 'transparent' : 'rgba(0, 0, 0, 0.2)'}
          shadowBlur={reduceEffects ? 0 : 10}
          shadowOffset={reduceEffects ? { x: 0, y: 0 } : { x: 0, y: 4 }}
          shadowOpacity={reduceEffects ? 0 : 0.3}
          perfectDrawEnabled={false}
          stroke={isSelected ? '#2563eb' : undefined}
          strokeWidth={isSelected ? 3 : 0}
        />

        {/* Text is the most expensive sticky-note node; hide it during dense interactions */}
        {!hideText && (
          <Text
            text={text}
            x={12}
            y={12}
            width={width - 24}
            height={height - 24}
            fontSize={16}
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
            fill="#1f2937"
            align="left"
            verticalAlign="top"
            wrap="word"
            ellipsis={true}
            listening={false}
          />
        )}
      </Group>
    );
  },
);
