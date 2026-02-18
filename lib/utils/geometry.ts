/**
 * Normalizes geometry after a Konva Transformer interaction.
 *
 * Konva's Transformer applies resize by scaling the node (scaleX/scaleY) rather
 * than changing width/height directly. This helper converts the scale factors into
 * absolute dimensions, enforces a minimum size, and resets scale to 1 so that
 * Yjs becomes the single source of truth for geometry.
 */
export function normalizeGeometry(
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  minSize = 20,
): { width: number; height: number } {
  return {
    width: Math.max(minSize, width * scaleX),
    height: Math.max(minSize, height * scaleY),
  };
}
