import { containsPoint, type Rect } from '../../core/geometry';
import { setFont, roundRectPath } from '../text';
import { shade } from './theme';

export interface ButtonStyle {
  fontSize?: number;
  fill?: string;
  hoverFill?: string;
  pressedFill?: string;
  disabledFill?: string;
  textColor?: string;
  border?: string;
}

/** Ready-made colors: gold for the main action, blue for ordinary buttons, red and green for attack and heal. */
export const BUTTON_STYLES = {
  blue: { fill: '#4468e8', hoverFill: '#5f86ff', pressedFill: '#3049b8', border: '#d3e2ff' },
  gold: { fill: '#ffae1a', hoverFill: '#ffc646', pressedFill: '#dd7d0e', border: '#fff1b8' },
  red: { fill: '#e0454f', hoverFill: '#ff6670', pressedFill: '#b02f38', border: '#ffc2c8' },
  green: { fill: '#2fb467', hoverFill: '#47d681', pressedFill: '#208a4d', border: '#c6f5d8' },
} as const satisfies Record<string, ButtonStyle>;

/**
 * A clickable rectangle. Logic (hover, press, click, disabled) is separate from drawing, so it can be tested
 * without a canvas. A click fires when the pointer is pressed and released inside the button.
 */
export class Button {
  enabled = true;
  hover = false;
  pressed = false;

  constructor(
    public rect: Rect,
    public label: string,
    private readonly onClick: () => void,
    private readonly style: ButtonStyle = BUTTON_STYLES.blue,
  ) {}

  pointerDown(x: number, y: number): boolean {
    this.hover = containsPoint(this.rect, x, y);
    if (!this.enabled || !this.hover) return false;
    this.pressed = true;
    return true;
  }

  pointerMove(x: number, y: number): void {
    this.hover = this.enabled && containsPoint(this.rect, x, y);
  }

  pointerUp(x: number, y: number): void {
    const wasPressed = this.pressed;
    this.pressed = false;
    this.hover = this.enabled && containsPoint(this.rect, x, y);
    if (wasPressed && this.enabled && this.hover) this.onClick();
  }

  cancel(): void {
    this.pressed = false;
    this.hover = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = { ...BUTTON_STYLES.blue, ...this.style };
    let base = s.fill;
    if (!this.enabled) base = s.disabledFill ?? '#3a3f58';
    else if (this.pressed) base = s.pressedFill;
    else if (this.hover) base = s.hoverFill;

    const { x, y, w, h } = this.rect;
    const depth = this.enabled ? 5 : 3;
    const dy = this.pressed ? depth - 2 : 0; // pressed buttons sink toward their lip
    const radius = Math.min(16, h / 2.4);

    ctx.save();
    // the darker lip underneath gives the button its thickness
    roundRectPath(ctx, x, y + depth + (this.pressed ? 2 : 5), w, h, radius);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();
    roundRectPath(ctx, x, y + depth, w, h, radius);
    ctx.fillStyle = shade(base, -0.55);
    ctx.fill();

    const body = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
    body.addColorStop(0, shade(base, this.enabled ? 0.3 : 0.1));
    body.addColorStop(0.5, base);
    body.addColorStop(1, shade(base, -0.22));
    roundRectPath(ctx, x, y + dy, w, h, radius);
    ctx.fillStyle = body;
    ctx.fill();

    // glossy highlight across the upper half
    roundRectPath(ctx, x + 4, y + dy + 3, w - 8, h * 0.46, Math.max(3, radius - 3));
    ctx.fillStyle = `rgba(255, 255, 255, ${this.enabled ? 0.26 + (this.hover ? 0.1 : 0) : 0.08})`;
    ctx.fill();

    roundRectPath(ctx, x, y + dy, w, h, radius);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.enabled ? s.border : '#5d6280';
    ctx.stroke();

    // label with a dark outline so it reads on any color
    const size = s.fontSize ?? 30;
    setFont(ctx, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 7);
    ctx.strokeStyle = this.enabled ? shade(base, -0.7) : 'rgba(10, 12, 30, 0.8)';
    const tx = x + w / 2;
    const ty = y + h / 2 + dy + 1;
    ctx.strokeText(this.label, tx, ty);
    ctx.fillStyle = this.enabled ? (s.textColor ?? '#ffffff') : '#8a8fab';
    ctx.fillText(this.label, tx, ty);
    ctx.restore();
  }
}
