'use client';

import { Layer, Circle } from 'react-konva';

interface GridProps {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function Grid({ width, height, scale, offsetX, offsetY }: GridProps) {
  const gridSpacing = 50; // Base grid spacing in pixels
  const dotSize = 2; // Dot radius in pixels
  const dotColor = '#d1d5db'; // gray-300

  // Calculate visible grid bounds with padding
  const padding = gridSpacing * 2;
  const startX = Math.floor((-offsetX - padding) / (gridSpacing * scale)) * gridSpacing;
  const endX = Math.ceil((width - offsetX + padding) / (gridSpacing * scale)) * gridSpacing;
  const startY = Math.floor((-offsetY - padding) / (gridSpacing * scale)) * gridSpacing;
  const endY = Math.ceil((height - offsetY + padding) / (gridSpacing * scale)) * gridSpacing;

  const dots: Array<{ x: number; y: number }> = [];

  // Generate dot positions
  for (let x = startX; x <= endX; x += gridSpacing) {
    for (let y = startY; y <= endY; y += gridSpacing) {
      dots.push({ x, y });
    }
  }

  return (
    <Layer listening={false}>
      {dots.map((dot, i) => (
        <Circle
          key={`dot-${i}`}
          x={dot.x}
          y={dot.y}
          radius={dotSize / scale}
          fill={dotColor}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
    </Layer>
  );
}
