export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

export const defaultViewport: ViewportState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

function storageKey(boardId: string): string {
  return `canvasViewport:${boardId}`;
}

/**
 * Persist the current viewport for a given board to localStorage.
 * No-ops silently if localStorage is unavailable (e.g. SSR, private mode).
 */
export function saveViewport(boardId: string, state: ViewportState): void {
  try {
    localStorage.setItem(storageKey(boardId), JSON.stringify(state));
  } catch {
    // localStorage unavailable — silently skip
  }
}

/**
 * Load the persisted viewport for a board.
 * Returns `defaultViewport` on any parse/validation failure so the canvas
 * always starts in a safe state.
 */
export function loadViewport(boardId: string): ViewportState {
  try {
    const raw = localStorage.getItem(storageKey(boardId));
    if (!raw) return defaultViewport;

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).zoom !== 'number' ||
      typeof (parsed as Record<string, unknown>).pan !== 'object' ||
      (parsed as Record<string, unknown>).pan === null ||
      typeof ((parsed as Record<string, unknown>).pan as Record<string, unknown>).x !== 'number' ||
      typeof ((parsed as Record<string, unknown>).pan as Record<string, unknown>).y !== 'number'
    ) {
      return defaultViewport;
    }

    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, (parsed as Record<string, unknown>).zoom as number),
    );

    const pan = (parsed as Record<string, unknown>).pan as { x: number; y: number };

    return { zoom, pan: { x: pan.x, y: pan.y } };
  } catch {
    return defaultViewport;
  }
}
