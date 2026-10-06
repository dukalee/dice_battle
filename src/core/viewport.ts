import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants';

export interface Viewport {
  /** Displayed pixels per logical pixel. */
  scale: number;
  /** Canvas position inside the window, in CSS pixels (the rest is letterbox). */
  offsetX: number;
  offsetY: number;
  /** Canvas size in CSS pixels. Always 16:9. */
  width: number;
  height: number;
}

/** Fit the 1280x720 logical screen into the window, keeping the aspect ratio and centering it. */
export function computeViewport(windowWidth: number, windowHeight: number): Viewport {
  const scale = Math.max(0, Math.min(windowWidth / LOGICAL_WIDTH, windowHeight / LOGICAL_HEIGHT));
  const width = LOGICAL_WIDTH * scale;
  const height = LOGICAL_HEIGHT * scale;
  return {
    scale,
    offsetX: (windowWidth - width) / 2,
    offsetY: (windowHeight - height) / 2,
    width,
    height,
  };
}

/** Convert window (client) coordinates to logical coordinates. Points in the letterbox fall outside 0..1280 / 0..720. */
export function screenToLogical(clientX: number, clientY: number, viewport: Viewport): { x: number; y: number } {
  if (viewport.scale === 0) return { x: 0, y: 0 };
  return {
    x: (clientX - viewport.offsetX) / viewport.scale,
    y: (clientY - viewport.offsetY) / viewport.scale,
  };
}
