import { LOGICAL_HEIGHT as H, LOGICAL_WIDTH as W } from '../core/constants';
import { createRng } from '../game/rng';


export interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export interface Mote {
  x: number;
  y: number;
  r: number;
  /** Rise speed in logical px per second. */
  speed: number;
  sway: number;
  phase: number;
  warm: boolean;
}

/** Stars in the upper sky. The same seed always gives the same sky. */
export function makeStars(seed: number, count: number): Star[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => ({
    x: rng.next() * W,
    y: rng.next() * H * 0.62,
    r: 0.6 + rng.next() * 1.6,
    phase: rng.next() * Math.PI * 2,
    speed: 0.6 + rng.next() * 1.8,
  }));
}

export function makeMotes(seed: number, count: number): Mote[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => ({
    x: rng.next() * W,
    y: rng.next() * H,
    r: 1.2 + rng.next() * 2.6,
    speed: 8 + rng.next() * 22,
    sway: 10 + rng.next() * 26,
    phase: rng.next() * Math.PI * 2,
    warm: rng.next() < 0.55,
  }));
}

/** Where a drifting mote is `timeMs` after the start: it rises, sways, and re-enters from the bottom. */
export function motePosition(m: Mote, timeMs: number): { x: number; y: number } {
  const t = timeMs / 1000;
  const span = H + 60;
  const raw = (m.y - m.speed * t) % span;
  const y = (raw < 0 ? raw + span : raw) - 30;
  return { x: m.x + Math.sin(t * 0.7 + m.phase) * m.sway, y };
}

/** 0..1 brightness of a twinkling star. */
export function twinkle(s: Star, timeMs: number): number {
  return 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((timeMs / 1000) * s.speed + s.phase));
}

const STARS = makeStars(7, 130);
const MOTES = makeMotes(21, 46);

import { cachedLayer, pixelScale } from './cache';

function ridge(ctx: CanvasRenderingContext2D, base: number, amp: number, seed: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const y =
      base -
      amp * (0.55 * Math.sin(x * 0.006 + seed) + 0.3 * Math.sin(x * 0.017 + seed * 2.3) + 0.15 * Math.sin(x * 0.043 + seed * 4.1));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function tower(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number, roof: number): void {
  ctx.fillRect(x - w / 2, baseY - h, w, h);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 3, baseY - h);
  ctx.lineTo(x, baseY - h - roof);
  ctx.lineTo(x + w / 2 + 3, baseY - h);
  ctx.closePath();
  ctx.fill();
}

function paintBase(ctx: CanvasRenderingContext2D): void {
  // dusk sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#060a22');
  sky.addColorStop(0.4, '#141a55');
  sky.addColorStop(0.72, '#2d2380');
  sky.addColorStop(1, '#5a2f8a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // soft nebula clouds
  const clouds: Array<[number, number, number, string]> = [
    [220, 150, 360, 'rgba(120, 90, 255, 0.28)'],
    [1080, 120, 380, 'rgba(60, 160, 255, 0.22)'],
    [700, 330, 460, 'rgba(255, 90, 170, 0.16)'],
    [120, 420, 300, 'rgba(60, 220, 200, 0.14)'],
  ];
  for (const [x, y, r, c] of clouds) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // light shafts from above
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, spread, a] of [[300, 220, 0.1], [650, 280, 0.12], [1010, 200, 0.09]] as const) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    g.addColorStop(0, `rgba(190, 200, 255, ${a})`);
    g.addColorStop(1, 'rgba(190, 200, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 18, -10);
    ctx.lineTo(x + 18, -10);
    ctx.lineTo(x + spread, H * 0.8);
    ctx.lineTo(x - spread, H * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // distant mountains and a small castle on the horizon
  const far = ctx.createLinearGradient(0, 380, 0, 560);
  far.addColorStop(0, '#2b2a86');
  far.addColorStop(1, '#1a1a5c');
  ridge(ctx, 500, 70, 1.3, far);
  ctx.fillStyle = '#1d1c66';
  tower(ctx, 600, 505, 26, 70, 34);
  tower(ctx, 640, 505, 34, 96, 46);
  tower(ctx, 682, 505, 24, 62, 30);
  ctx.fillRect(572, 480, 140, 30);
  ctx.fillStyle = 'rgba(255, 214, 120, 0.9)';
  for (const [wx, wy] of [[640, 440], [600, 462], [682, 466]]) ctx.fillRect(wx - 2, wy, 4, 7);
  const near = ctx.createLinearGradient(0, 470, 0, 650);
  near.addColorStop(0, '#171650');
  near.addColorStop(1, '#0c0d34');
  ridge(ctx, 565, 55, 4.2, near);
}

function paintVignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 12, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Soft round glow used for the drifting lights; drawn once and stamped many times. */
function glowSprite(warm: boolean): HTMLCanvasElement {
  return cachedLayer(warm ? 'mote-warm' : 'mote-cool', 64, 64, 1, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, warm ? 'rgba(255, 214, 120, 0.95)' : 'rgba(150, 210, 255, 0.9)');
    g.addColorStop(0.35, warm ? 'rgba(255, 190, 90, 0.35)' : 'rgba(120, 180, 255, 0.3)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/**
 * The shared fantasy dusk backdrop: gradient sky, nebula, light shafts, a distant castle and a vignette are one cached
 * image; on top of it only the twinkling stars and the drifting lights are drawn each frame.
 */
export function drawBackground(ctx: CanvasRenderingContext2D, timeMs = 0): void {
  const base = cachedLayer('background', W, H, pixelScale(ctx), (c) => {
    paintBase(c);
    paintVignette(c);
  });
  ctx.drawImage(base, 0, 0, W, H);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const s of STARS) {
    ctx.globalAlpha = twinkle(s, timeMs);
    const d = s.r * 2;
    ctx.fillRect(s.x - s.r, s.y - s.r, d, d);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.6;
  const warm = glowSprite(true);
  const cool = glowSprite(false);
  for (const m of MOTES) {
    const p = motePosition(m, timeMs);
    const d = m.r * 8;
    ctx.drawImage(m.warm ? warm : cool, p.x - d / 2, p.y - d / 2, d, d);
  }
  ctx.restore();
}

export const STAGE_Y = 492;
export const STAGE_FLOOR_Y = 500;

function paintFloor(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, STAGE_FLOOR_Y, 0, H);
  g.addColorStop(0, 'rgba(40, 34, 120, 0.92)');
  g.addColorStop(1, 'rgba(8, 10, 36, 0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, STAGE_FLOOR_Y, W, H - STAGE_FLOOR_Y);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, STAGE_FLOOR_Y, W, H - STAGE_FLOOR_Y);
  ctx.clip();
  ctx.strokeStyle = 'rgba(150, 170, 255, 0.13)';
  ctx.lineWidth = 1;
  const vanishX = W / 2;
  const vanishY = 330;
  for (let i = -14; i <= 14; i++) {
    const bottomX = vanishX + i * 130;
    const k = (STAGE_FLOOR_Y - vanishY) / (H - vanishY);
    ctx.beginPath();
    ctx.moveTo(vanishX + (bottomX - vanishX) * k, STAGE_FLOOR_Y);
    ctx.lineTo(bottomX, H);
    ctx.stroke();
  }
  for (let d = 1; d <= 6; d++) {
    const y = STAGE_FLOOR_Y + Math.pow(d / 6, 1.7) * (H - STAGE_FLOOR_Y);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  const line = ctx.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, 'rgba(160, 190, 255, 0)');
  line.addColorStop(0.5, 'rgba(190, 210, 255, 0.85)');
  line.addColorStop(1, 'rgba(160, 190, 255, 0)');
  ctx.fillStyle = line;
  ctx.fillRect(0, STAGE_FLOOR_Y - 1, W, 2);
}

/** The battle floor: a glowing horizon line, a faint perspective grid and a fade into darkness toward the bottom. */
export function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.drawImage(cachedLayer('floor', W, H, pixelScale(ctx), paintFloor), 0, 0, W, H);
}

/** A glowing round platform with a slowly turning rune ring, in the given color. */
export function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, color: string, timeMs: number): void {
  const ry = rx * 0.19;
  ctx.save();

  const halo = ctx.createRadialGradient(x, y, rx * 0.2, x, y, rx * 1.35);
  halo.addColorStop(0, color + '55');
  halo.addColorStop(1, color + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 1.35, ry * 1.9, 0, 0, Math.PI * 2);
  ctx.fill();

  const disc = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  disc.addColorStop(0, 'rgba(70, 76, 150, 0.9)');
  disc.addColorStop(1, 'rgba(14, 16, 50, 0.95)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // the rim glows through two wider, fainter strokes (cheaper than a blur)
  for (const [lw, alpha] of [[11, '22'], [6, '44']] as const) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = color + alpha;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -(timeMs / 1000) * 22;
  ctx.strokeStyle = color + 'cc';
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
