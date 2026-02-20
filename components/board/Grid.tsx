'use client';

import { useMemo } from 'react';
import { Layer, Circle } from 'react-konva';

interface GridProps {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  isPanning?: boolean;
}

export function Grid({ width, height, scale, offsetX, offsetY, isPanning = false }: GridProps) {
  const gridSpacing = 50; // Base grid spacing in pixels
  const dotSize = 2; // Dot radius in pixels
  const dotColor = '#d1d5db'; // gray-300
  const safeScale = scale > 0 ? scale : 1;
  const effectiveDotSize = isPanning ? 1.6 : dotSize;

  const dots = useMemo((): Array<{ x: number; y: number }> => {
    const basePadding = isPanning ? gridSpacing : gridSpacing * 2;
    const maxDots = isPanning ? 1800 : 6000;

    let spacing = isPanning ? gridSpacing * 2 : gridSpacing;
    let startX = Math.floor((-offsetX - basePadding) / (spacing * safeScale)) * spacing;
    let endX = Math.ceil((width - offsetX + basePadding) / (spacing * safeScale)) * spacing;
    let startY = Math.floor((-offsetY - basePadding) / (spacing * safeScale)) * spacing;
    let endY = Math.ceil((height - offsetY + basePadding) / (spacing * safeScale)) * spacing;

    const estimateColumns = Math.max(Math.floor((endX - startX) / spacing) + 1, 0);
    const estimateRows = Math.max(Math.floor((endY - startY) / spacing) + 1, 0);
    const estimatedDotCount = estimateColumns * estimateRows;

    if (estimatedDotCount > maxDots) {
      const spacingMultiplier = Math.ceil(Math.sqrt(estimatedDotCount / maxDots));
      spacing = gridSpacing * spacingMultiplier;
      startX = Math.floor((-offsetX - basePadding) / (spacing * safeScale)) * spacing;
      endX = Math.ceil((width - offsetX + basePadding) / (spacing * safeScale)) * spacing;
      startY = Math.floor((-offsetY - basePadding) / (spacing * safeScale)) * spacing;
      endY = Math.ceil((height - offsetY + basePadding) / (spacing * safeScale)) * spacing;
    }

    const nextDots: Array<{ x: number; y: number }> = [];
    for (let x = startX; x <= endX; x += spacing) {
      for (let y = startY; y <= endY; y += spacing) {
        nextDots.push({ x, y });
      }
    }

    return nextDots;
  }, [gridSpacing, height, isPanning, offsetX, offsetY, safeScale, width]);

  return (
    <Layer listening={false}>
      {dots.map((dot, i) => (
        <Circle
          key={`dot-${i}`}
          x={dot.x}
          y={dot.y}
          radius={effectiveDotSize / safeScale}
          fill={dotColor}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
    </Layer>
  );
}
