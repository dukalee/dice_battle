import type { Rect } from '../../core/geometry';
import { cachedLayer, pixelScale } from '../cache';
import { roundRectPath } from '../text';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a `#rrggbb` color toward white (amount > 0) or black (amount < 0). amount is -1..1. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const k = Math.min(1, Math.abs(amount));
  const mix = (c: number) => Math.round(c + (target - c) * k);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Accent colors shared by every screen. */
export const ACCENT = {
  gold: '#f5c542',
  blue: '#5aa9ff',
  red: '#ff6a6a',
  green: '#5fe08a',
  violet: '#a98bff',
} as const;

export interface PanelStyle {
  radius?: number;
  /** Fill gradient, top to bottom. */
  top?: string;
  bottom?: string;
  border?: string;
  borderWidth?: number;
  /** Soft colored glow around the border. */
  glow?: string;
  shadow?: boolean;
}

const PANEL_PAD = 30;

/**
 * A glass-like panel: dark gradient, soft drop shadow, inner highlight and a colored rim.
 * Each distinct size and style is painted once and then copied, because the blur shadow is costly to redraw every frame.
 */
export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect, s: PanelStyle = {}): void {
  const key = ['panel', r.w, r.h, s.radius, s.top, s.bottom, s.border, s.borderWidth, s.glow, s.shadow].join('|');
  const layer = cachedLayer(key, r.w + PANEL_PAD * 2, r.h + PANEL_PAD * 2, pixelScale(ctx), (c) =>
    paintPanel(c, { x: PANEL_PAD, y: PANEL_PAD, w: r.w, h: r.h }, s),
  );
  ctx.drawImage(layer, r.x - PANEL_PAD, r.y - PANEL_PAD, r.w + PANEL_PAD * 2, r.h + PANEL_PAD * 2);
}

function paintPanel(ctx: CanvasRenderingContext2D, r: Rect, s: PanelStyle): void {
  const radius = s.radius ?? 16;
  const border = s.border ?? 'rgba(170, 190, 255, 0.75)';
  const bw = s.borderWidth ?? 2;

  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, s.top ?? 'rgba(52, 64, 140, 0.92)');
  g.addColorStop(1, s.bottom ?? 'rgba(14, 18, 56, 0.94)');

  ctx.save();
  if (s.shadow !== false) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  }
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  if (s.glow) {
    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 16;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.lineWidth = bw;
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.restore();
  }

  // inner highlight along the top edge
  ctx.save();
  roundRectPath(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, Math.max(2, radius - 3));
  ctx.lineWidth = 1.5;
  const hl = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)');
  hl.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = hl;
  ctx.stroke();
  ctx.restore();

  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.lineWidth = bw;
  ctx.strokeStyle = border;
  ctx.stroke();
}
