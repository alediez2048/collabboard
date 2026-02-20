import type { BoardObject } from '@/lib/yjs/board-doc';

interface Position {
  x: number;
  y: number;
}

interface Delta {
  x: number;
  y: number;
}

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
}

export function getMovableSelectionIds(
  selectedIds: string[],
  objectLookup: ReadonlyMap<string, BoardObject>,
): string[] {
  return selectedIds.filter((id) => {
    const object = objectLookup.get(id);
    return !!object && object.type !== 'connector';
  });
}

export function buildMovedPositionUpdates(
  selectedIds: string[],
  initialPositions: ReadonlyMap<string, Position>,
  delta: Delta,
): PositionUpdate[] {
  const updates: PositionUpdate[] = [];

  for (const id of selectedIds) {
    const initial = initialPositions.get(id);
    if (!initial) continue;

    updates.push({
      id,
      x: initial.x + delta.x,
      y: initial.y + delta.y,
    });
  }

  return updates;
}

export function computePrimaryDragDelta(
  initialPositions: ReadonlyMap<string, Position>,
  primaryId: string,
  primaryCurrentPosition: Position,
): Delta | null {
  const primaryInitial = initialPositions.get(primaryId);
  if (!primaryInitial) return null;

  return {
    x: primaryCurrentPosition.x - primaryInitial.x,
    y: primaryCurrentPosition.y - primaryInitial.y,
  };
}

/**
 * Builds absolute positions for the full selection from the primary object's
 * current coordinates. This is useful for live preview updates during drag,
 * where every follower should mirror the primary object's delta from start.
 */
export function buildLiveDragPreviewPositions(
  selectedIds: string[],
  initialPositions: ReadonlyMap<string, Position>,
  primaryId: string,
  primaryCurrentPosition: Position,
): PositionUpdate[] {
  const delta = computePrimaryDragDelta(
    initialPositions,
    primaryId,
    primaryCurrentPosition,
  );
  if (!delta) return [];

  return buildMovedPositionUpdates(selectedIds, initialPositions, delta);
}
