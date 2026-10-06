/** Pip positions for each face on a 3x3 grid, as [column, row] with 0 = left/top, 1 = middle, 2 = right/bottom. */
export const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

export interface DieDrawOptions {
  /** Center position in logical px. */
  x: number;
  y: number;
  /** Edge length in logical px (before `scale`). */
  size: number;
  face: number;
  angle?: number;
  /** Extra scale, e.g. > 1 while the die is in the air. */
  scale?: number;
  /** How high the die is above the table (0 = resting); moves and softens the shadow. */
  lift?: number;
  /** Set to false for dice that float in the air (no shadow on the table). */
  shadow?: boolean;
}

/** A six-sided die with round corners, drawn flat and rotated by `angle`. The pips are always readable. */
export function drawDie(ctx: CanvasRenderingContext2D, o: DieDrawOptions): void {
  const { x, y, size, face } = o;
  const scale = o.scale ?? 1;
  const lift = o.lift ?? 0;
  const half = (size * scale) / 2;

  // shadow stays on the table while the die flies above it
  if (o.shadow !== false) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.34 - lift / 260)})`;
    ctx.beginPath();
    ctx.ellipse(x + lift * 0.25, y + half * 0.95 + lift * 0.9, half * (0.95 + lift / 300), half * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.angle ?? 0);
  const r = half * 0.28;
  const g = ctx.createLinearGradient(-half, -half, half, half);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#d9dcea');
  ctx.beginPath();
  ctx.roundRect(-half, -half, half * 2, half * 2, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(2, half * 0.07);
  ctx.strokeStyle = '#3a3f66';
  ctx.stroke();

  const pipR = half * (face === 1 ? 0.26 : 0.17);
  const step = half * 0.56;
  ctx.fillStyle = face === 1 ? '#d63a3a' : '#23264a';
  for (const [col, row] of PIPS[face] ?? []) {
    ctx.beginPath();
    ctx.arc((col - 1) * step, (row - 1) * step, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
