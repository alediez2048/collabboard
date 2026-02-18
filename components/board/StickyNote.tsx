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
  onSelect: (id: string) => void;
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
      onSelect,
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
        draggable
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDblClick={() => onDoubleClick(id)}
        onDblTap={() => onDoubleClick(id)}
        onDragEnd={(e) => {
          const node = e.target;
          onDragEnd(id, node.x(), node.y());
        }}
        onTransformEnd={() => onTransformEnd?.(id)}
      >
        {/* Background rectangle */}
        <Rect
          width={width}
          height={height}
          fill={color}
          cornerRadius={8}
          shadowColor="rgba(0, 0, 0, 0.2)"
          shadowBlur={10}
          shadowOffset={{ x: 0, y: 4 }}
          shadowOpacity={0.3}
          stroke={isSelected ? '#2563eb' : undefined}
          strokeWidth={isSelected ? 3 : 0}
        />

        {/* Text content */}
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
      </Group>
    );
  },
);
