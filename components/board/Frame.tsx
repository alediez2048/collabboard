'use client';

import { useEffect, useRef } from 'react';
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
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
}

export function Frame({
  id,
  x,
  y,
  width,
  height,
  title,
  fillColor,
  strokeColor,
  isSelected,
  onSelect,
  onDragEnd,
  onDoubleClick,
}: FrameProps): React.ReactElement {
  const groupRef = useRef<Konva.Group>(null);

  // Disable stage dragging while dragging this frame (same pattern as StickyNote/Shape)
  useEffect(() => {
    const group = groupRef.current;
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
      {/* Title label above the frame */}
      <Text
        text={title || 'Frame'}
        x={0}
        y={-28}
        fontSize={13}
        fill={isSelected ? '#2563eb' : '#1e40af'}
        fontStyle="bold"
        listening={false}
      />
      {/* Frame border + fill */}
      <Rect
        width={width}
        height={height}
        fill={fillColor}
        stroke={isSelected ? '#2563eb' : strokeColor}
        strokeWidth={isSelected ? 3 : 2}
        dash={[8, 4]}
        cornerRadius={6}
      />
    </Group>
  );
}
