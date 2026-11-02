import type { AudioChannel, AudioSettings } from '../../core/bgm';
import { containsPoint, type Rect } from '../../core/geometry';
import { clamp } from '../../core/math';
import { drawText } from '../text';
import { Button, BUTTON_STYLES } from './button';
import { shade } from './theme';

const MUTE_SIZE = 56;
const KNOB_RADIUS = 15;
const PERCENT_WIDTH = 64;

/** Where the slider track sits inside a control of this size. */
export function sliderTrack(rect: Rect): Rect {
  const x = rect.x + MUTE_SIZE + 24;
  const right = rect.x + rect.w - PERCENT_WIDTH - KNOB_RADIUS;
  return { x, y: rect.y + rect.h - 23, w: right - x, h: 10 };
}

/** Volume 0..1 for a pointer at `x`; positions beyond either end clamp to it. */
export function volumeFromX(track: Rect, x: number): number {
  return clamp((x - track.x) / track.w, 0, 1);
}

/**
 * A mute button, a label and a volume slider in one row, for one channel (music or sound effects).
 * Shared by the title menu and the pause menu.
 * Dragging keeps working when the pointer leaves the slider (the canvas captures the pointer).
 */
export class SoundControl {
  private readonly muteButton: Button;
  private dragging = false;

  constructor(
    public readonly rect: Rect,
    private readonly audio: AudioSettings,
    private readonly channel: AudioChannel,
    private readonly label: string,
  ) {
    this.muteButton = new Button({ x: rect.x, y: rect.y, w: MUTE_SIZE, h: MUTE_SIZE }, '', () => audio.toggleMute(channel), BUTTON_STYLES.blue);
  }

  private sliderHit(): Rect {
    const t = sliderTrack(this.rect);
    return { x: t.x - KNOB_RADIUS, y: this.rect.y, w: t.w + KNOB_RADIUS * 2, h: this.rect.h };
  }

  pointerDown(x: number, y: number): boolean {
    if (this.muteButton.pointerDown(x, y)) return true;
    if (!containsPoint(this.sliderHit(), x, y)) return false;
    this.dragging = true;
    this.audio.setVolume(this.channel, volumeFromX(sliderTrack(this.rect), x));
    return true;
  }

  pointerMove(x: number, y: number): void {
    this.muteButton.pointerMove(x, y);
    if (this.dragging) this.audio.setVolume(this.channel, volumeFromX(sliderTrack(this.rect), x));
  }

  pointerUp(x: number, y: number): void {
    this.muteButton.pointerUp(x, y);
    this.dragging = false;
  }

  cancel(): void {
    this.muteButton.cancel();
    this.dragging = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const volume = this.audio.volume(this.channel);
    const off = this.audio.isMuted(this.channel) || volume === 0;
    this.muteButton.style = off ? BUTTON_STYLES.red : BUTTON_STYLES.blue;
    this.muteButton.draw(ctx);
    const iconY = this.rect.y + MUTE_SIZE / 2 + (this.muteButton.pressed ? 3 : 0);
    drawSpeaker(ctx, this.rect.x + MUTE_SIZE / 2, iconY, off, volume);

    const t = sliderTrack(this.rect);
    const shown = off ? 0 : volume;
    const cy = t.y + t.h / 2;
    ctx.save();
    ctx.lineCap = 'round';
    const line = (width: number, color: string, toX: number): void => {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(t.x, cy);
      ctx.lineTo(toX, cy);
      ctx.stroke();
    };
    line(t.h + 4, 'rgba(8, 10, 36, 0.9)', t.x + t.w);
    line(t.h, '#3a4278', t.x + t.w);
    if (shown > 0) line(t.h, '#ffc53a', t.x + t.w * shown);

    const kx = t.x + t.w * shown;
    const knob = ctx.createLinearGradient(0, cy - KNOB_RADIUS, 0, cy + KNOB_RADIUS);
    knob.addColorStop(0, '#fff6b0');
    knob.addColorStop(1, shade('#ffae1a', -0.1));
    ctx.beginPath();
    ctx.arc(kx, cy + 2, KNOB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(kx, cy, KNOB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = knob;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#7a4a08';
    ctx.stroke();
    ctx.restore();

    drawText(ctx, this.label, t.x - KNOB_RADIUS + 4, this.rect.y + 12, { size: 20, align: 'left', baseline: 'middle', color: '#c9d0f0' });
    drawText(ctx, `${Math.round(shown * 100)}%`, this.rect.x + this.rect.w, cy, {
      size: 26,
      align: 'right',
      baseline: 'middle',
      color: off ? '#ff9aa0' : '#f3f0ff',
    });
  }
}

/** A speaker icon centered at (cx, cy): sound waves when on, a cross when off. */
function drawSpeaker(ctx: CanvasRenderingContext2D, cx: number, cy: number, off: boolean, volume: number): void {
  ctx.save();
  ctx.translate(cx - 4, cy);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -5);
  ctx.lineTo(-4, -5);
  ctx.lineTo(4, -12);
  ctx.lineTo(4, 12);
  ctx.lineTo(-4, 5);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  if (off) {
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.lineTo(22, 7);
    ctx.moveTo(22, -7);
    ctx.lineTo(10, 7);
    ctx.stroke();
  } else {
    const waves = volume > 0.66 ? 3 : volume > 0.33 ? 2 : 1;
    for (let i = 0; i < waves; i++) {
      ctx.beginPath();
      ctx.arc(4, 0, 8 + i * 6, -0.9, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}
