import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import { drawText, setFont } from './text';

export const COPYRIGHT_TEXT = '© 2026 aishift. all rights reserved';

const STYLE = { size: 13, color: 'rgba(244, 241, 234, 0.75)', align: 'right', baseline: 'bottom' } as const;

/** Footer shown at the bottom right of every screen, drawn over the scene each frame. */
export function drawCopyright(ctx: CanvasRenderingContext2D): void {
  const x = LOGICAL_WIDTH - 12;
  const y = LOGICAL_HEIGHT - 6;
  ctx.save();
  // A dark outline keeps the small text readable on both bright and dark backdrops.
  setFont(ctx, STYLE.size);
  ctx.textAlign = STYLE.align;
  ctx.textBaseline = STYLE.baseline;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.strokeText(COPYRIGHT_TEXT, x, y);
  drawText(ctx, COPYRIGHT_TEXT, x, y, STYLE);
  ctx.restore();
}
