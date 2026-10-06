import { FONT_LOGO, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import type { Scene } from '../core/scene';
import type { CharacterId } from '../game/characters';
import { drawBackground } from '../render/background';
import { cachedLayer, pixelScale } from '../render/cache';
import { drawSprite } from '../render/sprites';
import { drawText } from '../render/text';
import { Button, BUTTON_STYLES } from '../render/ui/button';
import { ButtonGroup } from '../render/ui/buttonGroup';
import { drawPanel } from '../render/ui/theme';
import type { AppContext } from './types';

interface Fighter {
  id: CharacterId;
  x: number;
  y: number;
  scale: number;
  /** The direction it looks on screen. */
  facing: 'left' | 'right';
  /** Glow color behind it. */
  color: string;
  /** Which way it lunges (+1 right, -1 left), or 0 to just float. */
  lunge: -1 | 0 | 1;
  phase: number;
}

/**
 * Three-way standoff in a triangle: the mage hovers at the back in the middle, the warrior and the rogue
 * stand in front on either side, all three mid critical attack. They are listed back to front.
 */
const FIGHTERS: readonly Fighter[] = [
  { id: 'mage', x: 640, y: 392, scale: 0.78, facing: 'left', color: '#b79bff', lunge: 0, phase: 0 },
  { id: 'warrior', x: 236, y: 452, scale: 0.7, facing: 'right', color: '#ffa63a', lunge: 1, phase: 0 },
  { id: 'rogue', x: 1044, y: 452, scale: 0.7, facing: 'left', color: '#5fe08a', lunge: -1, phase: 0.6 },
];

/**
 * How far a fighter has lunged toward its rival (px), 0 at rest. A quick strike and recoil that repeats,
 * with each fighter offset in time so they trade blows instead of moving in lockstep.
 */
export function lungeOffset(timeMs: number, phase = 0): number {
  const t = (timeMs / 1000 + phase) % 2.4;
  if (t < 0.35) return (t / 0.35) * 26; // strike
  if (t < 0.8) return 26 * (1 - (t - 0.35) / 0.45); // recoil
  return 0;
}

export class TitleScene implements Scene {
  private time = 0;
  private readonly buttons: ButtonGroup;

  constructor(private readonly app: AppContext) {
    const w = 330;
    const gap = 36;
    const x = (LOGICAL_WIDTH - (w * 2 + gap)) / 2;
    this.buttons = new ButtonGroup([
      new Button({ x, y: 618, w, h: 80 }, '게임 시작', () => app.manager.go('characterSelect'), { ...BUTTON_STYLES.gold, fontSize: 38 }),
      new Button({ x: x + w + gap, y: 618, w, h: 80 }, '설명서', () => app.manager.go('help'), { ...BUTTON_STYLES.blue, fontSize: 34 }),
    ]);
  }

  update(dtMs: number): void {
    this.time += dtMs;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackground(ctx, this.time);
    const t = this.time / 1000;

    // a glow of each fighter's color behind it
    for (const f of FIGHTERS) {
      const glow = cachedLayer(`title-glow-${f.color}`, 620, 620, pixelScale(ctx), (c) => {
        const g = c.createRadialGradient(310, 310, 10, 310, 310, 310);
        g.addColorStop(0, f.color + '66');
        g.addColorStop(0.5, f.color + '22');
        g.addColorStop(1, f.color + '00');
        c.fillStyle = g;
        c.fillRect(0, 0, 620, 620);
      });
      ctx.drawImage(glow, f.x - 310, f.y - 290, 620, 620);
    }

    FIGHTERS.forEach((f, i) => {
      // the mage floats on a slow wave; the other two strike toward each other
      const lunge = f.lunge === 0 ? 0 : f.lunge * lungeOffset(this.time, f.phase);
      const bob = f.lunge === 0 ? Math.sin(t * 1.6) * 9 : Math.sin(t * 3 + i) * 4;
      drawSprite(ctx, this.app.sprites, f.id, 'critical_attack', f.x + lunge, f.y + bob, f.facing, f.scale);
    });

    // the logo (with its glow) is painted once; only its bobbing position changes
    const cy = 112 + Math.sin(t * 2) * 5;
    const halo = ctx.createRadialGradient(LOGICAL_WIDTH / 2, cy, 20, LOGICAL_WIDTH / 2, cy, 420);
    halo.addColorStop(0, 'rgba(255, 190, 60, 0.28)');
    halo.addColorStop(1, 'rgba(255, 190, 60, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT * 0.5);
    const logo = cachedLayer('title-logo', LOGICAL_WIDTH, 260, pixelScale(ctx), (c) => {
      c.lineJoin = 'round';
      c.font = `140px ${FONT_LOGO}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 22;
      c.strokeStyle = '#2a1850';
      c.strokeText('Dice Battle', LOGICAL_WIDTH / 2, 136);
      c.lineWidth = 10;
      c.strokeStyle = '#8b4dd8';
      c.strokeText('Dice Battle', LOGICAL_WIDTH / 2, 130);
      const g = c.createLinearGradient(0, 64, 0, 196);
      g.addColorStop(0, '#fff6b0');
      g.addColorStop(0.5, '#ffc53a');
      g.addColorStop(1, '#f07a14');
      c.shadowColor = 'rgba(255, 170, 40, 0.8)';
      c.shadowBlur = 24;
      c.fillStyle = g;
      c.fillText('Dice Battle', LOGICAL_WIDTH / 2, 130);
    });
    ctx.drawImage(logo, 0, cy - 130, LOGICAL_WIDTH, 260);
    // the tagline sits on a dark capsule so the mage's bright effect never washes it out
    drawPanel(ctx, { x: LOGICAL_WIDTH / 2 - 190, y: 182, w: 380, h: 40 }, { radius: 20, top: 'rgba(14, 16, 54, 0.88)', bottom: 'rgba(8, 10, 36, 0.9)', border: 'rgba(245, 197, 66, 0.7)', shadow: false });
    drawText(ctx, '주사위로 싸우는 턴제 배틀', LOGICAL_WIDTH / 2, 202, { size: 26, align: 'center', baseline: 'middle', color: '#f3f0ff' });

    this.buttons.draw(ctx);
  }

  onPointerDown(x: number, y: number): void {
    this.buttons.pointerDown(x, y);
  }
  onPointerMove(x: number, y: number): void {
    this.buttons.pointerMove(x, y);
  }
  onPointerUp(x: number, y: number): void {
    this.buttons.pointerUp(x, y);
  }
  onPointerCancel(): void {
    this.buttons.cancel();
  }
}
