export interface FreehandDraft {
  points: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FinalizedFreehandPath {
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[];
}

interface Point {
  x: number;
  y: number;
}

export function createFreehandDraft(x: number, y: number): FreehandDraft {
  return {
    points: [x, y],
    minX: x,
    minY: y,
    maxX: x,
    maxY: y,
  };
}

export function appendFreehandPoint(
  draft: FreehandDraft,
  x: number,
  y: number,
): FreehandDraft {
  return {
    points: [...draft.points, x, y],
    minX: Math.min(draft.minX, x),
    minY: Math.min(draft.minY, y),
    maxX: Math.max(draft.maxX, x),
    maxY: Math.max(draft.maxY, y),
  };
}

export function finalizeFreehandDraft(draft: FreehandDraft): FinalizedFreehandPath {
  const x = draft.minX;
  const y = draft.minY;
  const width = Math.max(draft.maxX - draft.minX, 1);
  const height = Math.max(draft.maxY - draft.minY, 1);

  const normalizedPoints: number[] = [];
  for (let index = 0; index < draft.points.length; index += 2) {
    normalizedPoints.push(draft.points[index] - x, draft.points[index + 1] - y);
  }

  return {
    x,
    y,
    width,
    height,
    points: normalizedPoints,
  };
}

function distancePointToSegment(point: Point, segmentStart: Point, segmentEnd: Point): number {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    const px = point.x - segmentStart.x;
    const py = point.y - segmentStart.y;
    return Math.sqrt(px * px + py * py);
  }

  const projection =
    ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / segmentLengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const closestX = segmentStart.x + t * dx;
  const closestY = segmentStart.y + t * dy;
  const distanceX = point.x - closestX;
  const distanceY = point.y - closestY;
  return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
}

export function isPointNearFreehandPath(
  pointX: number,
  pointY: number,
  pathX: number,
  pathY: number,
  normalizedPoints: number[],
  strokeWidth: number,
  extraTolerance = 6,
): boolean {
  if (normalizedPoints.length < 4 || normalizedPoints.length % 2 !== 0) {
    return false;
  }

  const hitRadius = Math.max(strokeWidth / 2 + extraTolerance, 2);
  const point = { x: pointX, y: pointY };

  for (let index = 0; index < normalizedPoints.length - 2; index += 2) {
    const segmentStart = {
      x: pathX + normalizedPoints[index],
      y: pathY + normalizedPoints[index + 1],
    };
    const segmentEnd = {
      x: pathX + normalizedPoints[index + 2],
      y: pathY + normalizedPoints[index + 3],
    };

    if (distancePointToSegment(point, segmentStart, segmentEnd) <= hitRadius) {
      return true;
    }
  }

  return false;
}
