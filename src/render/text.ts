import { FONT_DISPLAY, FONT_FAMILY } from '../core/constants';

export interface TextStyle {
  size: number;
  color?: string;
  /** Use the heavy display font (titles, banners) instead of the body font. */
  display?: boolean;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export function setFont(ctx: CanvasRenderingContext2D, size: number, display = false): void {
  ctx.font = `${size}px ${display ? FONT_DISPLAY : FONT_FAMILY}`;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): void {
  setFont(ctx, style.size, style.display);
  ctx.fillStyle = style.color ?? '#f4f1ea';
  ctx.textAlign = style.align ?? 'left';
  ctx.textBaseline = style.baseline ?? 'alphabetic';
  ctx.fillText(text, x, y);
}

/**
 * Split text into lines no wider than maxWidth. Breaks at spaces; a word that is too long on its own is
 * broken between characters (Korean text can have long unspaced runs). Explicit "\n" always starts a new line.
 */
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line !== '') lines.push(line);
      line = '';
      // break an over-long word by characters
      for (const ch of word) {
        if (line !== '' && measure(line + ch) > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draw wrapped text; returns the y just below the last line. */
export function drawParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  style: TextStyle & { lineHeight?: number },
): number {
  setFont(ctx, style.size, style.display);
  const lines = wrapLines((s) => ctx.measureText(s).width, text, maxWidth);
  const lineHeight = style.lineHeight ?? Math.round(style.size * 1.4);
  lines.forEach((line, i) => drawText(ctx, line, x, y + i * lineHeight, { ...style, baseline: style.baseline ?? 'top' }));
  return y + lines.length * lineHeight;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
