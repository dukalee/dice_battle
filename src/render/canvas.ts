import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import { computeViewport, type Viewport } from '../core/viewport';

export interface GameCanvas {
  ctx: CanvasRenderingContext2D;
  /** Latest viewport, kept up to date on every resize. */
  readonly viewport: Viewport;
}

/**
 * Size the canvas to the largest 16:9 area that fits the window, centered (the rest is letterbox),
 * and keep it that way on resize. Drawing code always uses logical 1280x720 coordinates.
 */
export function setupCanvas(canvas: HTMLCanvasElement): GameCanvas {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  const state = { viewport: computeViewport(window.innerWidth, window.innerHeight) };

  const resize = () => {
    const vp = computeViewport(window.innerWidth, window.innerHeight);
    state.viewport = vp;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.left = `${vp.offsetX}px`;
    canvas.style.top = `${vp.offsetY}px`;
    canvas.style.width = `${vp.width}px`;
    canvas.style.height = `${vp.height}px`;
    canvas.width = Math.max(1, Math.round(vp.width * dpr));
    canvas.height = Math.max(1, Math.round(vp.height * dpr));
    // Map logical coordinates onto the (possibly high-DPI) backing store.
    const k = canvas.width / LOGICAL_WIDTH;
    ctx.setTransform(k, 0, 0, canvas.height / LOGICAL_HEIGHT, 0, 0);
  };

  resize();
  window.addEventListener('resize', resize);

  return {
    ctx,
    get viewport() {
      return state.viewport;
    },
  };
}
