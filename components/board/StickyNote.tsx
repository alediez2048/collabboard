'use client';

import { useRef, useEffect } from 'react';
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
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
}

export function StickyNote({
  id,
  x,
  y,
  width,
  height,
  text,
  color,
  isSelected,
  onSelect,
  onDragEnd,
  onDoubleClick,
}: StickyNoteProps) {
  const groupRef = useRef<Konva.Group>(null);

  // Disable stage dragging when dragging this sticky note
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

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      draggable
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      onDblClick={() => onDoubleClick(id)}
      onDblTap={() => onDoubleClick(id)}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd(id, node.x(), node.y());
      }}
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
        listening={false} // Text doesn't need to listen to events
      />
    </Group>
  );
}
