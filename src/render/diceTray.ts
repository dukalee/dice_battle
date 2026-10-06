import { containsPoint, type Rect } from '../core/geometry';
import { FONT_DISPLAY } from '../core/constants';
import { clamp } from '../core/math';
import type { Rng } from '../game/rng';
import { drawDie } from './dice';
import { drawText, roundRectPath } from './text';
import { drawPanel } from './ui/theme';

/** The faces to show. `extra` are the rogue's two additional dice, rolled automatically after the first batch. */
export interface DiceResult {
  first: number[];
  extra?: number[];
}

export interface DiceTrayCallbacks {
  /**
   * The player let go. Return the (already decided) dice to show, or null to ignore the throw.
   * `power` (0..1) only shapes the animation.
   */
  onRelease(power: number): DiceResult | null;
  /** Every die has stopped (after the extra dice too, when there are any). */
  onSettled(): void;
}

export type TrayState = 'hidden' | 'ready' | 'charging' | 'rolling' | 'settled';

/** Hold time -> throw strength. Even a tap gives a small positive power (a weak throw); about 1.2 s is full strength. */
export function holdToPower(holdMs: number): number {
  return clamp(0.12 + holdMs / 1400, 0.12, 1);
}

export interface Slot {
  x: number;
  y: number;
}

export function dieSizeFor(count: number): number {
  return count >= 4 ? 62 : 74;
}

/** Resting positions for `count` dice, centered in the tray. */
export function layoutSlots(rect: Rect, count: number): Slot[] {
  const size = dieSizeFor(count);
  const spacing = size * 1.32;
  const startX = rect.x + rect.w / 2 - ((count - 1) * spacing) / 2;
  // a little above the middle, which leaves room below the dice for the effect explanation
  const y = rect.y + rect.h * 0.4;
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * spacing, y }));
}

export interface DieAnim {
  /** The face this die ends on. */
  face: number;
  /** When (ms after the roll began) this die is thrown. */
  startAt: number;
  duration: number;
  from: Slot;
  to: Slot;
  arcHeight: number;
  /** Total rotation during the flight, in radians. */
  spin: number;
  /** Final resting tilt. */
  tilt: number;
  /** Hidden until it is thrown (the rogue's extra dice). */
  hiddenUntilStart: boolean;
  /** Scale once it has settled (the rogue's dice shrink a little to make room for four). Default 1. */
  endScale?: number;
  /** The rogue's bonus stage, on a die of the first pair: it pops, then slides aside to make room for the extra pair. */
  bonus?: { at: number; popIndex: number; slideStart: number; slideMs: number; slideTo: Slot; slideScale: number };
  /** An extra die shows an empty "?" slot from this time (ms into the roll) until it is thrown. */
  placeholderFrom?: number;
}

export interface DieFrame {
  visible: boolean;
  x: number;
  y: number;
  angle: number;
  scale: number;
  lift: number;
  /** Seen face; spins randomly in flight and locks onto the real one near the end. */
  face: number;
  settled: boolean;
  /** 0..1 golden glow behind the die while it is being highlighted. */
  glow: number;
  /** True for an empty "?" slot that waits for an extra die (the die itself is not shown yet). */
  placeholder?: boolean;
}

/** Where a die is and what it shows `elapsed` ms into the roll. `flicker` supplies a random face while it tumbles. */
export function dieFrameAt(anim: DieAnim, elapsed: number, flicker: (step: number) => number): DieFrame {
  const local = elapsed - anim.startAt;
  const endScale = anim.endScale ?? 1;
  if (local < 0) {
    if (anim.hiddenUntilStart && anim.placeholderFrom !== undefined && elapsed >= anim.placeholderFrom) {
      return { visible: false, placeholder: true, x: anim.to.x, y: anim.to.y, angle: 0, scale: endScale, lift: 0, face: anim.face, settled: false, glow: 0 };
    }
    return {
      visible: !anim.hiddenUntilStart,
      x: anim.from.x,
      y: anim.from.y,
      angle: 0,
      scale: 1,
      lift: 0,
      face: anim.face,
      settled: false,
      glow: 0,
    };
  }
  const t = clamp(local / anim.duration, 0, 1);
  if (t >= 1) {
    const b = anim.bonus;
    if (b && elapsed >= b.at) {
      // bonus stage: pop and glow while the rogue's "one more!" is announced, then slide aside and shrink
      const h = highlightFrame(elapsed - b.at, b.popIndex);
      const p = clamp((elapsed - b.slideStart) / b.slideMs, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      return {
        visible: true,
        x: anim.to.x + (b.slideTo.x - anim.to.x) * e,
        y: anim.to.y + (b.slideTo.y - anim.to.y) * e - h.lift * (1 - e),
        angle: anim.tilt,
        scale: h.scale + (b.slideScale - h.scale) * e,
        lift: h.lift * (1 - e),
        face: anim.face,
        settled: true,
        glow: h.glow * (1 - e),
      };
    }
    return { visible: true, x: anim.to.x, y: anim.to.y, angle: anim.tilt, scale: endScale, lift: 0, face: anim.face, settled: true, glow: 0 };
  }
  const ease = 1 - Math.pow(1 - t, 3);
  const lift = anim.arcHeight * Math.pow(1 - t, 1.5) * Math.abs(Math.sin(t * Math.PI * 3));
  return {
    visible: true,
    x: anim.from.x + (anim.to.x - anim.from.x) * ease,
    y: anim.from.y + (anim.to.y - anim.from.y) * ease - lift,
    angle: anim.spin * (1 - ease) + anim.tilt,
    scale: (1 + (lift / Math.max(1, anim.arcHeight)) * 0.25) * endScale,
    lift,
    face: t < 0.82 ? flicker(Math.floor(local / 70)) : anim.face,
    settled: false,
    glow: 0,
  };
}

/** Each die pops up and swells in turn ("pop, pop, pop"), then keeps a soft glow while its effect is explained. */
export const HIGHLIGHT_STAGGER_MS = 150;
export const HIGHLIGHT_POP_MS = 440;

export function highlightFrame(highlightMs: number, index: number): { scale: number; lift: number; glow: number } {
  const local = highlightMs - index * HIGHLIGHT_STAGGER_MS;
  if (local < 0) return { scale: 1, lift: 0, glow: 0 };
  if (local < HIGHLIGHT_POP_MS) {
    const pop = Math.sin((local / HIGHLIGHT_POP_MS) * Math.PI);
    return { scale: 1 + 0.5 * pop, lift: 30 * pop, glow: 0.4 + 0.6 * pop };
  }
  return { scale: 1.08, lift: 0, glow: 0.5 };
}

const STAGGER_MS = 70;

/**
 * The rogue's bonus stage, between the first pair stopping and the extra pair being thrown (all in ms):
 * a short beat, then "one more!" is announced while the first pair pops; part-way through, the first pair slides
 * aside and two empty "?" slots appear; the dice are thrown only after the tension has built.
 */
export const BONUS_BEAT_MS = 220;
export const BONUS_ANNOUNCE_MS = 1300;
export const BONUS_SLIDE_AT_MS = 560;
export const BONUS_SLIDE_MS = 380;

export type BonusPhase = 'none' | 'announce';

/**
 * The dice area. It is inactive until `enable()`, then waits for the player to press and release inside it.
 * Holding shakes the dice; the hold time only changes how strong the throw looks (never the faces).
 * All timing runs from `update(dtMs)`, so a paused loop (dt = 0) freezes everything.
 */
export class DiceTray {
  state: TrayState = 'hidden';
  /** The faces the dice end on (all of them, including extra). Empty before the first roll. */
  faces: number[] = [];
  /** How many ms the player has been holding (for the shake and the gauge). */
  holdMs = 0;

  private slots: Slot[] = [];
  private restFaces: number[] = [];
  private anims: DieAnim[] = [];
  private elapsed = 0;
  private rollEnd = 0;
  private clock = 0;
  private flickerFaces: number[] = [];
  /** Time since the highlight began (ms), or -1 when no highlight is running. */
  private highlightMs = -1;
  /** How many dice the first throw has (decides the dice size). */
  private baseCount = 2;
  /** When the bonus stage begins and when the extra pair is thrown (ms into the roll), or -1 without extra dice. */
  private bonusAt = -1;
  private extraStart = -1;

  constructor(
    readonly rect: Rect,
    private readonly cosmetic: Rng,
    private readonly callbacks: DiceTrayCallbacks,
  ) {}

  /** Make the tray ready for the player's throw with `diceCount` dice. */
  enable(diceCount: number): void {
    this.slots = layoutSlots(this.rect, diceCount);
    this.baseCount = diceCount;
    this.restFaces = this.slots.map((_, i) => ((i * 2 + 2) % 6) + 1);
    this.faces = [];
    this.anims = [];
    this.holdMs = 0;
    this.state = 'ready';
  }

  /** Hide the dice area. */
  clear(): void {
    this.state = 'hidden';
    this.anims = [];
    this.faces = [];
    this.holdMs = 0;
    this.highlightMs = -1;
    this.bonusAt = -1;
    this.extraStart = -1;
  }

  /** Start the pop-pop-pop highlight of the dice that have settled. */
  startHighlight(): void {
    if (this.state === 'settled') this.highlightMs = 0;
  }

  stopHighlight(): void {
    this.highlightMs = -1;
  }

  get isHighlighting(): boolean {
    return this.highlightMs >= 0;
  }

  /** 'announce' while the rogue's "one more!" is on screen, before the extra pair is thrown. */
  get bonusPhase(): BonusPhase {
    if (this.bonusAt < 0 || this.state !== 'rolling') return 'none';
    return this.elapsed >= this.bonusAt && this.elapsed < this.extraStart ? 'announce' : 'none';
  }

  get isRolling(): boolean {
    return this.state === 'rolling';
  }

  get isActive(): boolean {
    return this.state === 'ready' || this.state === 'charging';
  }

  pointerDown(x: number, y: number): boolean {
    if (this.state !== 'ready' || !containsPoint(this.rect, x, y)) return false;
    this.state = 'charging';
    this.holdMs = 0;
    return true;
  }

  /** Releasing anywhere throws, so letting go outside the tray still works. */
  pointerUp(): void {
    if (this.state !== 'charging') return;
    const power = holdToPower(this.holdMs);
    const result = this.callbacks.onRelease(power);
    if (!result) {
      this.state = 'ready';
      this.holdMs = 0;
      return;
    }
    this.startRoll(result, power);
  }

  pointerCancel(): void {
    if (this.state !== 'charging') return;
    this.state = 'ready';
    this.holdMs = 0;
  }

  /** Roll without player input (the AI's turn). */
  rollAuto(result: DiceResult, power = 0.7): void {
    this.startRoll(result, power);
  }

  private startRoll(result: DiceResult, power: number): void {
    const extra = result.extra ?? [];
    const all = [...result.first, ...extra];
    // The first throw always lands in the ordinary layout for its own dice, centered, so nothing about it hints that
    // an extra pair is coming. Only the bonus stage rearranges the tray to make room for four.
    const firstSlots = layoutSlots(this.rect, result.first.length);
    const finalSlots = layoutSlots(this.rect, all.length);
    this.slots = finalSlots;
    this.baseCount = result.first.length;
    this.faces = all;
    this.elapsed = 0;
    this.flickerFaces = [];

    const duration = 650 + 750 * power;
    const hand: Slot = { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h * 0.9 };
    const makeAnim = (face: number, slot: Slot, startAt: number, strength: number, hidden: boolean): DieAnim => ({
      face,
      startAt,
      duration: 650 + 750 * strength,
      from: { x: hand.x + (this.cosmetic.next() - 0.5) * 60, y: hand.y },
      to: slot,
      arcHeight: 40 + 90 * strength,
      spin: (6 + 18 * strength) * (this.cosmetic.next() < 0.5 ? -1 : 1),
      tilt: (this.cosmetic.next() - 0.5) * 0.3,
      hiddenUntilStart: hidden,
    });

    this.anims = [];
    const firstEnd = (result.first.length - 1) * STAGGER_MS + duration;
    const shrink = dieSizeFor(all.length) / dieSizeFor(result.first.length);
    const hasExtra = extra.length > 0;
    this.bonusAt = hasExtra ? firstEnd + BONUS_BEAT_MS : -1;
    this.extraStart = hasExtra ? this.bonusAt + BONUS_ANNOUNCE_MS : -1;
    result.first.forEach((face, i) => {
      const anim = makeAnim(face, firstSlots[i], i * STAGGER_MS, power, false);
      if (hasExtra) {
        anim.bonus = { at: this.bonusAt, popIndex: i, slideStart: this.bonusAt + BONUS_SLIDE_AT_MS, slideMs: BONUS_SLIDE_MS, slideTo: finalSlots[i], slideScale: shrink };
      }
      this.anims.push(anim);
    });
    // the rogue's extra dice are thrown on their own once the bonus stage is over
    const extraPower = Math.max(power, 0.6);
    extra.forEach((face, j) => {
      const anim = makeAnim(face, finalSlots[result.first.length + j], this.extraStart + j * STAGGER_MS, extraPower, true);
      anim.endScale = shrink;
      anim.placeholderFrom = this.bonusAt + BONUS_SLIDE_AT_MS;
      this.anims.push(anim);
    });
    this.rollEnd = Math.max(...this.anims.map((a) => a.startAt + a.duration));
    this.state = 'rolling';
  }

  update(dtMs: number): void {
    this.clock += dtMs;
    if (this.highlightMs >= 0) this.highlightMs += dtMs;
    if (this.state === 'charging') this.holdMs += dtMs;
    if (this.state !== 'rolling') return;
    this.elapsed += dtMs;
    if (this.elapsed >= this.rollEnd) {
      this.state = 'settled';
      this.callbacks.onSettled();
    }
  }

  /** What each die looks like right now. Exposed for drawing and tests. */
  frames(): DieFrame[] {
    const size = this.slots.length;
    if (this.state === 'rolling' || this.state === 'settled') {
      return this.anims.map((a, i) => {
        const f = dieFrameAt(a, this.state === 'settled' ? Infinity : this.elapsed, (step) => this.flicker(i, step));
        if (this.highlightMs < 0 || this.state !== 'settled') return f;
        const h = highlightFrame(this.highlightMs, i);
        return { ...f, y: f.y - h.lift, scale: h.scale * f.scale, lift: h.lift, glow: h.glow };
      });
    }
    if (this.state === 'hidden') return [];
    const power = this.state === 'charging' ? holdToPower(this.holdMs) : 0;
    return Array.from({ length: size }, (_, i) => {
      const slot = this.slots[i];
      const amp = this.state === 'charging' ? 2 + 12 * power : 0;
      const t = this.clock / 1000;
      const face =
        this.state === 'charging' ? ((this.restFaces[i] + Math.floor(this.clock / 90) * (i + 1)) % 6) + 1 : this.restFaces[i];
      return {
        visible: true,
        x: slot.x + Math.sin(t * 47 + i * 2.1) * amp,
        y: slot.y + Math.cos(t * 53 + i * 1.3) * amp,
        angle: this.state === 'charging' ? Math.sin(t * 41 + i) * 0.18 * power : 0,
        scale: 1,
        lift: 0,
        face,
        settled: false,
        glow: 0,
      };
    });
  }

  /** An empty slot that waits for an extra die: a dashed box with a heartbeat-pulsing "?". */
  private drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const beat = 1 + 0.07 * Math.sin(this.clock / 90);
    const s = size * beat;
    ctx.save();
    ctx.translate(x, y);
    roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.28);
    ctx.fillStyle = 'rgba(12, 14, 46, 0.7)';
    ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 190, 90, 0.95)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${Math.round(s * 0.62)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText('?', 0, 3);
    ctx.restore();
  }

  /** "홀짝이 같다! 한 번 더!" under the dice, thumping with the beat. */
  private drawBonusText(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.rect;
    const cx = x + w / 2;
    const cy = y + h * 0.4 + 92;
    const beat = 1 + 0.08 * Math.max(0, Math.sin(this.clock / 85));
    drawText(ctx, '홀짝이 같다!', cx, cy - 30, { size: 21, align: 'center', baseline: 'middle', color: '#ffe08a' });
    ctx.save();
    ctx.translate(cx, cy + 12);
    ctx.scale(beat, beat);
    ctx.font = `46px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#4a1608';
    ctx.strokeText('한 번 더!', 0, 0);
    ctx.fillStyle = '#ff9a4a';
    ctx.fillText('한 번 더!', 0, 0);
    ctx.restore();
  }

  /** A face that changes every step but stays the same within one step. */
  private flicker(die: number, step: number): number {
    const key = die * 100000 + step;
    if (this.flickerFaces[key] === undefined) this.flickerFaces[key] = 1 + Math.floor(this.cosmetic.next() * 6);
    return this.flickerFaces[key];
  }

  draw(ctx: CanvasRenderingContext2D, caption: string): void {
    if (this.state === 'hidden') return;
    const { x, y, w, h } = this.rect;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock / 260);

    const active = this.state === 'ready' || this.state === 'charging';
    drawPanel(ctx, this.rect, {
      radius: 22,
      top: 'rgba(30, 38, 108, 0.7)',
      bottom: 'rgba(8, 10, 36, 0.78)',
      border: active ? 'rgba(245,197,66,0.85)' : 'rgba(160,175,230,0.6)',
      borderWidth: 3,
    });
    if (active) {
      // the border pulses while the tray waits for the throw
      ctx.save();
      roundRectPath(ctx, x - 2, y - 2, w + 4, h + 4, 24);
      ctx.lineWidth = this.state === 'ready' ? 2 + pulse * 3 : 3;
      ctx.strokeStyle = `rgba(255, 214, 90, ${0.25 + pulse * 0.6})`;
      ctx.stroke();
      ctx.restore();
    }

    const size = dieSizeFor(this.baseCount);
    const tense = this.bonusPhase === 'announce';
    if (tense) {
      // the border throbs red-orange like a heartbeat while the bonus throw is coming
      const beat = 0.5 + 0.5 * Math.sin(this.clock / 85);
      ctx.save();
      roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 25);
      ctx.lineWidth = 3 + beat * 4;
      ctx.strokeStyle = `rgba(255, 110, 60, ${0.35 + beat * 0.55})`;
      ctx.stroke();
      ctx.restore();
    }
    for (const f of this.frames()) {
      if (f.placeholder) {
        this.drawPlaceholder(ctx, f.x, f.y, size * f.scale);
        continue;
      }
      if (!f.visible) continue;
      if (f.glow > 0) {
        const gr = size * (0.9 + f.glow * 0.5);
        const g = ctx.createRadialGradient(f.x, f.y, size * 0.2, f.x, f.y, gr);
        g.addColorStop(0, `rgba(255, 224, 110, ${0.75 * f.glow})`);
        g.addColorStop(1, 'rgba(255, 224, 110, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x - gr, f.y - gr, gr * 2, gr * 2);
      }
      drawDie(ctx, { x: f.x, y: f.y, size, face: f.face, angle: f.angle, scale: f.scale, lift: f.lift });
    }

    if (tense) this.drawBonusText(ctx);

    let hint = '';
    if (this.state === 'ready') hint = '여기를 꾹 눌렀다 떼서 던지세요!';
    else if (this.state === 'charging') hint = '손을 떼면 던집니다!';
    drawText(ctx, hint || caption, x + w / 2, y + 26, { size: 22, align: 'center', baseline: 'middle', color: '#ffe08a' });
    if (hint && caption) drawText(ctx, caption, x + w / 2, y + h - 22, { size: 19, align: 'center', baseline: 'middle', color: '#c9d0f0' });

    if (this.state === 'charging') {
      const power = holdToPower(this.holdMs);
      const gw = w - 80;
      roundRectPath(ctx, x + 40, y + h - 50, gw, 14, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      roundRectPath(ctx, x + 40, y + h - 50, Math.max(14, gw * power), 14, 7);
      ctx.fillStyle = power > 0.8 ? '#ff6a3d' : '#f5c542';
      ctx.fill();
    }
  }
}
