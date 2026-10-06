import { screenToLogical, type Viewport } from './viewport';

export interface PointerTarget {
  pointerDown(x: number, y: number): void;
  pointerMove(x: number, y: number): void;
  pointerUp(x: number, y: number): void;
  pointerCancel(): void;
}

/**
 * Forward mouse and touch input (Pointer Events) to `target` in logical coordinates.
 * The pointer is captured on press, so releasing outside the canvas still delivers pointerUp.
 * Only one pointer is tracked at a time.
 */
export function attachPointerInput(canvas: HTMLCanvasElement, getViewport: () => Viewport, target: PointerTarget): () => void {
  let activeId: number | null = null;
  const toLogical = (e: PointerEvent) => screenToLogical(e.clientX, e.clientY, getViewport());

  const onDown = (e: PointerEvent) => {
    if (activeId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    activeId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    const p = toLogical(e);
    target.pointerDown(p.x, p.y);
  };
  const onMove = (e: PointerEvent) => {
    if (activeId !== null && e.pointerId !== activeId) return;
    const p = toLogical(e);
    target.pointerMove(p.x, p.y);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    const p = toLogical(e);
    target.pointerUp(p.x, p.y);
  };
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    target.pointerCancel();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
  };
}
