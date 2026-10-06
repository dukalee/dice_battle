import { FONT_DISPLAY, FONT_FAMILY, LOGICAL_WIDTH } from '../core/constants';
import { clamp } from '../core/math';
import { roundRectPath, wrapLines } from './text';

export type BannerTone = 'critical' | 'fail' | 'info';

export interface ActiveBanner {
  text: string;
  detail: string;
  tone: BannerTone;
  /** How long it has been on screen (game time, ms). */
  age: number;
  /** How long it stays (ms). */
  life: number;
}

const POP_MS = 220;
/** The effect text sits in the dice area (x 440-840, dice at y ~250-330), below the dice. */
const DETAIL_TOP = 350;
const DETAIL_MAX_WIDTH = 372;
const DETAIL_FONT = 23;
const DETAIL_LINE = 30;
const FADE_MS = 350;
const EXPLAIN_FONT = 21;
const EXPLAIN_LINE = 27;

const COLORS: Record<BannerTone, { fill: string; stroke: string }> = {
  critical: { fill: '#ffd23f', stroke: '#4a2a00' },
  fail: { fill: '#ff4d4d', stroke: '#3a0a0a' },
  info: { fill: '#9ad7ff', stroke: '#0c2a44' },
};

/** The word pops in big and settles to normal size. */
export function bannerScale(ageMs: number): number {
  const t = clamp(ageMs / POP_MS, 0, 1);
  return 1 + 0.6 * (1 - t) * (1 - t);
}

/** Fully visible, then fades out over the last part of its life. */
export function bannerAlpha(ageMs: number, lifeMs: number): number {
  const fadeStart = lifeMs - FADE_MS;
  if (ageMs <= fadeStart) return 1;
  return clamp(1 - (ageMs - fadeStart) / FADE_MS, 0, 1);
}

/** Draw the big word with its explanation underneath, centered near the top of the battlefield. */
/**
 * The effect explanation shown inside the dice area, below the dice, while they are highlighted.
 * `rect` is the dice area; `age` is how long the text has been showing (it pops in, then stays).
 */
export function drawExplanation(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, text: string, tone: BannerTone, age: number): void {
  const { fill } = COLORS[tone];
  const cx = rect.x + rect.w / 2;
  const top = rect.y + rect.h * 0.4 + 52;
  const maxW = rect.w - 28;
  const s = clamp(age / 200, 0, 1);
  ctx.save();
  ctx.font = `${EXPLAIN_FONT}px ${FONT_FAMILY}`;
  const lines = wrapLines((t) => ctx.measureText(t).width, text, maxW - 32);
  const h = lines.length * EXPLAIN_LINE + 18;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34);
  ctx.translate(cx, top + h / 2);
  ctx.scale(0.8 + 0.2 * s, 0.8 + 0.2 * s);
  ctx.globalAlpha = s;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, 14);
  ctx.fillStyle = 'rgba(8, 10, 30, 0.92)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = fill;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, 0, -h / 2 + 9 + EXPLAIN_LINE / 2 + i * EXPLAIN_LINE));
  ctx.restore();
}

export function drawBanner(ctx: CanvasRenderingContext2D, banner: ActiveBanner): void {
  const alpha = bannerAlpha(banner.age, banner.life);
  if (alpha <= 0) return;
  const { fill, stroke } = COLORS[banner.tone];
  const cx = LOGICAL_WIDTH / 2;
  const wordY = 180;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.translate(cx, wordY);
  ctx.scale(bannerScale(banner.age), bannerScale(banner.age));
  ctx.font = `80px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = stroke;
  ctx.strokeText(banner.text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(banner.text, 0, 0);
  ctx.restore();

  if (banner.detail) {
    // The effect is explained inside the dice area, under the dice, so it never hides the numbers.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${DETAIL_FONT}px ${FONT_FAMILY}`;
    const lines = wrapLines((s) => ctx.measureText(s).width, banner.detail, DETAIL_MAX_WIDTH - 32);
    const h = lines.length * DETAIL_LINE + 20;
    const w = Math.min(DETAIL_MAX_WIDTH, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
    roundRectPath(ctx, cx - w / 2, DETAIL_TOP, w, h, 14);
    ctx.fillStyle = 'rgba(8, 10, 24, 0.86)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, cx, DETAIL_TOP + 10 + DETAIL_LINE / 2 + i * DETAIL_LINE));
    ctx.restore();
  }
}
