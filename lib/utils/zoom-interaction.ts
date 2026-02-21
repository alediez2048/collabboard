export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface PointerPosition {
  x: number;
  y: number;
}

export interface PointerAnchoredWheelZoomInput {
  viewport: ViewportState;
  pointer: PointerPosition;
  deltaY: number;
  deltaMode: number;
  pageHeight: number;
  sensitivity?: number;
  minZoom?: number;
  maxZoom?: number;
}

export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 10;
export const DEFAULT_WHEEL_SENSITIVITY = 0.0005;

const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;
const LINE_HEIGHT_PX = 16;
const DEFAULT_PAGE_HEIGHT_PX = 800;

export function clampZoom(
  nextZoom: number,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
): number {
  return Math.max(minZoom, Math.min(maxZoom, nextZoom));
}

export function normalizeWheelDelta(
  deltaY: number,
  deltaMode: number,
  pageHeight: number,
): number {
  if (deltaMode === WHEEL_DELTA_LINE) {
    return deltaY * LINE_HEIGHT_PX;
  }
  if (deltaMode === WHEEL_DELTA_PAGE) {
    const safePageHeight = pageHeight > 0 ? pageHeight : DEFAULT_PAGE_HEIGHT_PX;
    return deltaY * safePageHeight;
  }
  return deltaY;
}

/**
 * Calculates a pointer-anchored viewport after wheel input.
 * Negative delta zooms in; positive delta zooms out.
 */
export function applyPointerAnchoredWheelZoom(
  input: PointerAnchoredWheelZoomInput,
): ViewportState {
  const {
    viewport,
    pointer,
    deltaY,
    deltaMode,
    pageHeight,
    sensitivity = DEFAULT_WHEEL_SENSITIVITY,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
  } = input;

  const safeCurrentZoom = viewport.zoom > 0 ? viewport.zoom : 1;
  const normalizedDeltaY = normalizeWheelDelta(deltaY, deltaMode, pageHeight);
  const proposedZoom = safeCurrentZoom * Math.exp(-normalizedDeltaY * sensitivity);
  const nextZoom = clampZoom(proposedZoom, minZoom, maxZoom);

  if (nextZoom === safeCurrentZoom) {
    return {
      zoom: safeCurrentZoom,
      pan: { x: viewport.pan.x, y: viewport.pan.y },
    };
  }

  const anchorX = (pointer.x - viewport.pan.x) / safeCurrentZoom;
  const anchorY = (pointer.y - viewport.pan.y) / safeCurrentZoom;

  return {
    zoom: nextZoom,
    pan: {
      x: pointer.x - anchorX * nextZoom,
      y: pointer.y - anchorY * nextZoom,
    },
  };
}
