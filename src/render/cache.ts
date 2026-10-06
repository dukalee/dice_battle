/**
 * Pre-rendered pieces of the screen. Blur shadows, gradients and big clipped regions are expensive to repaint
 * every frame (especially in Firefox), so anything that does not change is drawn once into an off-screen canvas
 * and then just copied.
 */

/** Device pixels per logical pixel the main canvas currently has, rounded up to 1 or 2: the resolution to cache at. */
export function pixelScale(ctx: CanvasRenderingContext2D): number {
  const a = ctx.getTransform().a;
  return Math.min(2, Math.max(1, Math.ceil(a - 0.01)));
}

const layers = new Map<string, HTMLCanvasElement>();

/** A cached canvas of `w` x `h` logical px. `paint` draws in logical coordinates and runs only the first time for a key. */
export function cachedLayer(
  key: string,
  w: number,
  h: number,
  scale: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const fullKey = `${key}@${scale}`;
  let layer = layers.get(fullKey);
  if (!layer) {
    layer = document.createElement('canvas');
    layer.width = Math.ceil(w * scale);
    layer.height = Math.ceil(h * scale);
    const ctx = layer.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    ctx.scale(scale, scale);
    paint(ctx);
    layers.set(fullKey, layer);
  }
  return layer;
}

/** Number of cached layers (for tests and for keeping an eye on memory). */
export function cachedLayerCount(): number {
  return layers.size;
}
