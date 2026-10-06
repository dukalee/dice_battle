import { FONT_DISPLAY } from '../../core/constants';
import type { Rect } from '../../core/geometry';
import type { LogKind } from '../../game/messages';
import { setFont } from '../text';
import { drawPanel } from './theme';

export type { LogKind };

export interface LogEntry {
  text: string;
  kind: LogKind;
}

/** The most recent messages, oldest dropped first once the limit is reached. */
export class LogBuffer {
  private entries: LogEntry[] = [];

  constructor(private readonly limit = 30) {}

  push(message: string, kind: LogKind = 'info'): void {
    this.entries.push({ text: message, kind });
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
  }

  /** The text of the last `count` messages, oldest first. */
  recent(count: number): string[] {
    return this.entries.slice(-count).map((e) => e.text);
  }

  /** The last `count` messages with their kinds, oldest first. */
  recentEntries(count: number): readonly LogEntry[] {
    return this.entries.slice(-count);
  }

  get all(): readonly string[] {
    return this.entries.map((e) => e.text);
  }

  clear(): void {
    this.entries = [];
  }
}

/** Colors of a log line: the text, the strong accent (numbers, icon) and the tint strip behind it. */
export const LOG_COLORS: Record<LogKind, { text: string; accent: string; tint: string }> = {
  damage: { text: '#ffe3e3', accent: '#ff5a5a', tint: 'rgba(255, 90, 90, 0.26)' },
  heal: { text: '#dffff0', accent: '#4fe38a', tint: 'rgba(79, 227, 138, 0.24)' },
  fail: { text: '#f0e2ff', accent: '#c58bff', tint: 'rgba(197, 139, 255, 0.26)' },
  clear: { text: '#fff5cf', accent: '#ffd34d', tint: 'rgba(255, 211, 77, 0.24)' },
  info: { text: '#dfe6ff', accent: '#8fb8ff', tint: 'rgba(143, 184, 255, 0.16)' },
};

/** Splits a line into runs of digits (shown big and colored) and the text between them. */
export function splitNumbers(text: string): Array<{ text: string; number: boolean }> {
  const parts: Array<{ text: string; number: boolean }> = [];
  for (const piece of text.split(/(\d+)/)) {
    if (piece === '') continue;
    parts.push({ text: piece, number: /^\d+$/.test(piece) });
  }
  return parts;
}

/** A small icon in the line's accent color: burst for damage, cross for healing, warning triangle, star, dot. */
function drawIcon(ctx: CanvasRenderingContext2D, kind: LogKind, cx: number, cy: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'damage': {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 9 : 4.2;
        const a = (Math.PI / 8) * i - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'heal': {
      ctx.fillRect(-2.6, -8, 5.2, 16);
      ctx.fillRect(-8, -2.6, 16, 5.2);
      break;
    }
    case 'fail': {
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(9, 7);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a0f33';
      ctx.fillRect(-1.3, -3, 2.6, 5.5);
      ctx.fillRect(-1.3, 3.6, 2.6, 2.4);
      break;
    }
    case 'clear': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 9.5 : 4;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawLogWindow(ctx: CanvasRenderingContext2D, rect: Rect, log: LogBuffer, visibleLines: number): void {
  drawPanel(ctx, rect, { radius: 14, top: 'rgba(24, 30, 86, 0.88)', bottom: 'rgba(6, 8, 30, 0.92)', border: 'rgba(150, 170, 245, 0.8)' });
  const entries = log.recentEntries(visibleLines);
  const lineHeight = (rect.h - 16) / visibleLines;

  ctx.save();
  entries.forEach((entry, i) => {
    const c = LOG_COLORS[entry.kind];
    const age = entries.length - 1 - i;
    const y = rect.y + 8 + i * lineHeight;
    const cy = y + lineHeight / 2;

    // a tinted strip fading to the right, in the line's color
    const strip = ctx.createLinearGradient(rect.x + 10, 0, rect.x + rect.w - 10, 0);
    strip.addColorStop(0, c.tint);
    strip.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = age === 0 ? 1 : age === 1 ? 0.75 : 0.5;
    ctx.fillStyle = strip;
    ctx.fillRect(rect.x + 10, y + 1, rect.w - 20, lineHeight - 2);
    ctx.fillStyle = c.accent;
    ctx.fillRect(rect.x + 10, y + 1, 4, lineHeight - 2);

    drawIcon(ctx, entry.kind, rect.x + 34, cy, c.accent);

    // the text, with every number picked out in the accent color and the heavy display font
    ctx.globalAlpha = age === 0 ? 1 : age === 1 ? 0.85 : 0.62;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let x = rect.x + 54;
    for (const part of splitNumbers(entry.text)) {
      if (part.number) {
        ctx.font = `23px ${FONT_DISPLAY}`;
        ctx.fillStyle = c.accent;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 0, 20, 0.7)';
        ctx.strokeText(part.text, x, cy + 1);
      } else {
        setFont(ctx, 21);
        ctx.fillStyle = c.text;
      }
      ctx.fillText(part.text, x, cy + 1);
      x += ctx.measureText(part.text).width;
    }
  });
  ctx.restore();
}
