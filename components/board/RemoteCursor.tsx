'use client';

import { Group, Line, Text, Rect } from 'react-konva';

interface RemoteCursorProps {
  x: number;
  y: number;
  userName: string;
  color: string;
}

/**
 * RemoteCursor - Konva component for rendering other users' cursors
 * 
 * Displays a cursor pointer shape with the user's name label below.
 * Each cursor has a unique color to distinguish between users.
 */
export function RemoteCursor({ x, y, userName, color }: RemoteCursorProps) {
  // Cursor pointer shape (SVG-like path using lines)
  const cursorPoints = [
    0, 0,      // tip
    0, 16,     // bottom of pointer
    4, 12,     // inner angle
    7, 18,     // tail end
    9, 17,     // tail inner
    6, 11,     // back to inner
    12, 10,    // right side
    0, 0,      // back to tip
  ];

  // Label dimensions
  const labelPadding = 4;
  const labelOffsetY = 22;
  
  // Estimate text width (rough approximation: ~7px per character)
  const textWidth = userName.length * 7;
  const labelWidth = textWidth + labelPadding * 2;
  const labelHeight = 18;

  return (
    <Group x={x} y={y}>
      {/* Cursor pointer shape */}
      <Line
        points={cursorPoints}
        fill={color}
        stroke="#ffffff"
        strokeWidth={1}
        closed
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={4}
        shadowOffset={{ x: 1, y: 1 }}
        shadowOpacity={0.5}
      />

      {/* User name label background */}
      <Rect
        x={0}
        y={labelOffsetY}
        width={labelWidth}
        height={labelHeight}
        fill={color}
        cornerRadius={4}
        shadowColor="rgba(0, 0, 0, 0.2)"
        shadowBlur={3}
        shadowOffset={{ x: 0, y: 1 }}
        shadowOpacity={0.5}
      />

      {/* User name text */}
      <Text
        x={labelPadding}
        y={labelOffsetY + 3}
        text={userName}
        fontSize={12}
        fontFamily="Inter, system-ui, sans-serif"
        fill="#ffffff"
        fontStyle="500"
      />
    </Group>
  );
}
