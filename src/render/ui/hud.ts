import { FONT_DISPLAY } from '../../core/constants';
import type { Rect } from '../../core/geometry';
import { clamp } from '../../core/math';
import type { CharacterId } from '../../game/characters';
import { drawSprite, type SpriteLibrary } from '../sprites';
import { drawText, roundRectPath } from '../text';
import { ACCENT, drawPanel, rgba, shade } from './theme';

export function hpColor(ratio: number): string {
  if (ratio > 0.5) return '#46d36e';
  if (ratio > 0.25) return '#f0cb3c';
  return '#ea4f45';
}

/** The three parts of an HP bar, as fractions of its length: solid, plus a pale "just lost / about to gain" strip. */
export interface BarSplit {
  solid: number;
  trail: number;
  /** damage: the bar shows more than the real HP (a pale strip fades away); heal: it shows less. */
  kind: 'damage' | 'heal' | 'none';
}

/**
 * `hp` is the real HP, `shown` the animated value the bar is catching up with.
 * After a hit the solid part drops right away and a pale strip drains behind it; a heal fills the other way.
 */
export function splitBar(shown: number, hp: number, max: number): BarSplit {
  const s = clamp(shown / max, 0, 1);
  const h = clamp(hp / max, 0, 1);
  if (s > h) return { solid: h, trail: s, kind: 'damage' };
  if (s < h) return { solid: s, trail: h, kind: 'heal' };
  return { solid: h, trail: h, kind: 'none' };
}

/** A game-style HP bar: dark track, glossy colored fill, 10% ticks, and the damage/heal strip. */
export function drawHpGauge(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  split: BarSplit,
  align: 'left' | 'right',
  label: string,
): void {
  const { x, y, w, h } = rect;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(2, 4, 20, 0.85)';
  ctx.fill();
  ctx.clip();

  const fillRect = (ratio: number, paint: string | CanvasGradient) => {
    const bw = (w - 4) * ratio;
    if (bw <= 0) return;
    const bx = align === 'left' ? x + 2 : x + w - 2 - bw;
    ctx.fillStyle = paint;
    ctx.fillRect(bx, y + 2, bw, h - 4);
  };
  if (split.kind !== 'none') fillRect(split.trail, split.kind === 'damage' ? '#ffe9a0' : '#bff7d0');
  const color = hpColor(split.solid);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.3));
  fillRect(split.solid, g);

  // gloss and ticks
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + 4, y + 3, w - 8, h * 0.28);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 1; i < 10; i++) ctx.fillRect(x + (w * i) / 10 - 0.5, y + 2, 1, h - 4);
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(210, 222, 255, 0.95)';
  ctx.stroke();

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.font = `${Math.round(h * 0.78)}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 4, 24, 0.9)';
  ctx.strokeText(label, x + w / 2, y + h / 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

export interface HudOptions {
  rect: Rect;
  /** Left for the player, right for the opponent: the portrait sits on the outer edge. */
  side: 'left' | 'right';
  character: CharacterId;
  /** Display name, e.g. "전사". */
  name: string;
  tag: string;
  shown: number;
  hp: number;
  max: number;
}

/** A player panel: round portrait, name and tag, HP gauge with numbers. */
export function drawHud(ctx: CanvasRenderingContext2D, sprites: SpriteLibrary, o: HudOptions): void {
  const { rect: r, side } = o;
  const accent = side === 'left' ? ACCENT.blue : ACCENT.red;
  drawPanel(ctx, r, {
    radius: 20,
    top: side === 'left' ? 'rgba(44, 76, 170, 0.92)' : 'rgba(150, 48, 70, 0.92)',
    bottom: side === 'left' ? 'rgba(14, 24, 74, 0.95)' : 'rgba(54, 14, 36, 0.95)',
    border: accent,
    glow: rgba(accent, 0.7),
  });

  const pr = 31;
  const px = side === 'left' ? r.x + 46 : r.x + r.w - 46;
  const py = r.y + r.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fillStyle = rgba(accent, 0.35);
  ctx.fill();
  ctx.clip();
  // the face sits well above the torso anchor the sprites are placed by
  drawSprite(ctx, sprites, o.character, 'idle', px, py + 24, side === 'left' ? 'right' : 'left', 0.3);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.arc(px, py, pr + 4, 0, Math.PI * 2);
  ctx.stroke();

  const bx = side === 'left' ? r.x + 94 : r.x + 22;
  const bw = r.w - 94 - 22;
  const nameX = side === 'left' ? bx + 2 : bx + bw - 2;
  drawText(ctx, o.name, nameX, r.y + 29, { size: 24, display: true, align: side, baseline: 'middle' });
  drawText(ctx, o.tag, side === 'left' ? nameX + 66 : nameX - 66, r.y + 30, {
    size: 17,
    align: side,
    baseline: 'middle',
    color: rgba(accent, 1),
  });
  drawHpGauge(ctx, { x: bx, y: r.y + 44, w: bw, h: 24 }, splitBar(o.shown, o.hp, o.max), side, `${o.hp} / ${o.max}`);
}

/** A gold ribbon with the round number. */
export function drawRoundBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string): void {
  const w = 190;
  const h = 46;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const notch = 14;
  const ribbon = () => {
    ctx.beginPath();
    ctx.moveTo(x - 18, y + 4);
    ctx.lineTo(x + 6, y + 4);
    ctx.lineTo(x + 6, y - 2);
    ctx.lineTo(x + w - 6, y - 2);
    ctx.lineTo(x + w - 6, y + 4);
    ctx.lineTo(x + w + 18, y + 4);
    ctx.lineTo(x + w + 18 - notch, y + h / 2 + 2);
    ctx.lineTo(x + w + 18, y + h + 2);
    ctx.lineTo(x + w - 6, y + h + 2);
    ctx.lineTo(x + w - 6, y + h + 4);
    ctx.lineTo(x + 6, y + h + 4);
    ctx.lineTo(x + 6, y + h + 2);
    ctx.lineTo(x - 18, y + h + 2);
    ctx.lineTo(x - 18 + notch, y + h / 2 + 2);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(0, 5);
  ribbon();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.translate(0, -5);
  ribbon();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ffe58a');
  g.addColorStop(0.5, '#f5b82e');
  g.addColorStop(1, '#c97a14');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fff3c4';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = `30px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 244, 200, 0.9)';
  ctx.strokeText(text, cx, cy + 3);
  ctx.fillStyle = '#6b3a06';
  ctx.fillText(text, cx, cy + 3);
  ctx.restore();
}

/** A screen heading: gold display text between two ornaments, on a soft dark band. */
export function drawHeading(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, size = 40): void {
  ctx.save();
  ctx.font = `${size}px ${FONT_DISPLAY}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 130;
  const h = size + 20;
  const band = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  band.addColorStop(0, 'rgba(8, 10, 40, 0)');
  band.addColorStop(0.2, 'rgba(8, 10, 40, 0.7)');
  band.addColorStop(0.8, 'rgba(8, 10, 40, 0.7)');
  band.addColorStop(1, 'rgba(8, 10, 40, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

  const lineY = [cy - h / 2, cy + h / 2];
  const rule = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  rule.addColorStop(0, 'rgba(245, 197, 66, 0)');
  rule.addColorStop(0.5, 'rgba(245, 197, 66, 0.95)');
  rule.addColorStop(1, 'rgba(245, 197, 66, 0)');
  ctx.fillStyle = rule;
  for (const ly of lineY) ctx.fillRect(cx - w / 2, ly - 1, w, 2);

  for (const dir of [-1, 1]) {
    const ox = cx + dir * (tw / 2 + 36);
    ctx.save();
    ctx.translate(ox, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = ACCENT.gold;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#6b3a06';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#3a2208';
  ctx.strokeText(text, cx, cy + 2);
  const tg = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  tg.addColorStop(0, '#fff0a8');
  tg.addColorStop(1, '#f2a91f');
  ctx.fillStyle = tg;
  ctx.fillText(text, cx, cy + 2);
  ctx.restore();
}
