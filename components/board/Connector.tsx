'use client';

import { memo } from 'react';
import { Arrow, Line as KonvaLine } from 'react-konva';
import { type BoardObject } from '@/lib/yjs/board-doc';

export type ConnectorLinePoints = readonly [number, number, number, number];

interface ConnectorProps {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  strokeWidth: number;
  objectLookup?: ReadonlyMap<string, BoardObject>;
  points?: ConnectorLinePoints | null;
  isSelected: boolean;
  onSelect: (id: string, options?: { additive: boolean }) => void;
}

/**
 * Compute the center point of a board object.
 * For lines, the stored x/y is the start and properties.x2/y2 is the end — use midpoint.
 */
function getCenter(obj: BoardObject): { x: number; y: number } {
  if (obj.type === 'line') {
    const x2 = obj.properties.x2 !== undefined ? Number(obj.properties.x2) : obj.x;
    const y2 = obj.properties.y2 !== undefined ? Number(obj.properties.y2) : obj.y;
    return {
      x: (obj.x + x2) / 2,
      y: (obj.y + y2) / 2,
    };
  }
  return {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  };
}

export function getConnectorLinePoints(
  fromObject: BoardObject,
  toObject: BoardObject,
): ConnectorLinePoints {
  const { x: x1, y: y1 } = getCenter(fromObject);
  const { x: x2, y: y2 } = getCenter(toObject);
  return [x1, y1, x2, y2];
}

export const Connector = memo(function Connector({
  id,
  fromId,
  toId,
  color,
  strokeWidth,
  objectLookup,
  points,
  isSelected,
  onSelect,
}: ConnectorProps): React.ReactElement | null {
  let resolvedPoints = points ?? null;

  if (!resolvedPoints) {
    if (!objectLookup) return null;

    const fromObj = objectLookup.get(fromId);
    const toObj = objectLookup.get(toId);
    if (!fromObj || !toObj) return null;

    resolvedPoints = getConnectorLinePoints(fromObj, toObj);
  }

  const [x1, y1, x2, y2] = resolvedPoints;

  const activeColor = isSelected ? '#2563eb' : color;

  return (
    <>
      {/* Wide transparent hit area for easier clicking */}
      <KonvaLine
        points={[x1, y1, x2, y2]}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth + 12, 16)}
        listening={true}
        onClick={(e) =>
          onSelect(id, {
            additive: e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey,
          })
        }
        onTap={() => onSelect(id)}
      />
      {/* Visible arrow */}
      <Arrow
        points={[x1, y1, x2, y2]}
        stroke={activeColor}
        fill={activeColor}
        strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
        pointerLength={10}
        pointerWidth={8}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </>
  );
});
