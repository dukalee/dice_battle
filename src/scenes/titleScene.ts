import { FONT_LOGO, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import { containsPoint, type Rect } from '../core/geometry';
import type { Scene } from '../core/scene';
import type { CharacterId } from '../game/characters';
import { drawBackground } from '../render/background';
import { cachedLayer, pixelScale } from '../render/cache';
import { drawSprite } from '../render/sprites';
import { drawText } from '../render/text';
import { Button, BUTTON_STYLES } from '../render/ui/button';
import { ButtonGroup } from '../render/ui/buttonGroup';
import { SoundControl } from '../render/ui/soundControl';
import { ACCENT, drawPanel } from '../render/ui/theme';
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

const GEAR_SIZE = 56;

/** The settings panel that drops down from the gear button in the top-right corner. */
const MENU_PANEL: Rect = { x: LOGICAL_WIDTH - 24 - 420, y: 84, w: 420, h: 282 };

export class TitleScene implements Scene {
  private time = 0;
  private readonly buttons: ButtonGroup;
  private readonly menuButton: Button;
  private readonly closeButton: Button;
  private readonly soundControls: SoundControl[];
  /** The menu panel is open. While true only the menu takes input. */
  menuOpen = false;

  constructor(private readonly app: AppContext) {
    const w = 330;
    const gap = 36;
    const x = (LOGICAL_WIDTH - (w * 2 + gap)) / 2;
    this.buttons = new ButtonGroup([
      new Button({ x, y: 618, w, h: 80 }, '게임 시작', () => app.manager.go('characterSelect'), { ...BUTTON_STYLES.gold, fontSize: 38 }),
      new Button({ x: x + w + gap, y: 618, w, h: 80 }, '설명서', () => app.manager.go('help'), { ...BUTTON_STYLES.blue, fontSize: 34 }),
    ]);

    this.menuButton = new Button({ x: LOGICAL_WIDTH - 24 - GEAR_SIZE, y: 20, w: GEAR_SIZE, h: GEAR_SIZE }, '', () => this.setMenuOpen(!this.menuOpen), BUTTON_STYLES.blue);
    this.soundControls = [
      new SoundControl({ x: MENU_PANEL.x + 24, y: MENU_PANEL.y + 66, w: 372, h: 56 }, app.audio, 'music', '음악'),
      new SoundControl({ x: MENU_PANEL.x + 24, y: MENU_PANEL.y + 132, w: 372, h: 56 }, app.audio, 'sfx', '효과음'),
    ];
    this.closeButton = new Button({ x: MENU_PANEL.x + (MENU_PANEL.w - 160) / 2, y: MENU_PANEL.y + 206, w: 160, h: 52 }, '닫기', () => this.setMenuOpen(false), {
      ...BUTTON_STYLES.gold,
      fontSize: 28,
    });
  }

  private setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    this.buttons.cancel();
    this.closeButton.cancel();
    for (const c of this.soundControls) c.cancel();
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
    this.menuButton.draw(ctx);
    const { x, y, w, h } = this.menuButton.rect;
    drawGear(ctx, x + w / 2, y + h / 2 + (this.menuButton.pressed ? 3 : 0));
    if (this.menuOpen) {
      drawPanel(ctx, MENU_PANEL, { radius: 22, border: ACCENT.gold, borderWidth: 3, glow: 'rgba(245,197,66,0.5)' });
      drawText(ctx, '소리 설정', MENU_PANEL.x + MENU_PANEL.w / 2, MENU_PANEL.y + 38, { size: 32, display: true, align: 'center', baseline: 'middle', color: ACCENT.gold });
      for (const c of this.soundControls) c.draw(ctx);
      this.closeButton.draw(ctx);
    }
  }

  onPointerDown(x: number, y: number): void {
    if (this.menuOpen) {
      if (this.soundControls.some((c) => c.pointerDown(x, y))) return;
      this.closeButton.pointerDown(x, y);
      this.menuButton.pointerDown(x, y);
      // pressing anywhere outside the panel closes it
      if (!containsPoint(MENU_PANEL, x, y) && !containsPoint(this.menuButton.rect, x, y)) this.setMenuOpen(false);
      return;
    }
    this.menuButton.pointerDown(x, y);
    this.buttons.pointerDown(x, y);
  }
  onPointerMove(x: number, y: number): void {
    this.menuButton.pointerMove(x, y);
    if (this.menuOpen) {
      for (const c of this.soundControls) c.pointerMove(x, y);
      this.closeButton.pointerMove(x, y);
    } else {
      this.buttons.pointerMove(x, y);
    }
  }
  onPointerUp(x: number, y: number): void {
    this.menuButton.pointerUp(x, y);
    if (this.menuOpen) {
      for (const c of this.soundControls) c.pointerUp(x, y);
      this.closeButton.pointerUp(x, y);
      return;
    }
    this.buttons.pointerUp(x, y);
  }
  onPointerCancel(): void {
    this.buttons.cancel();
    this.menuButton.cancel();
    this.closeButton.cancel();
    for (const c of this.soundControls) c.cancel();
  }
}

/** A white gear with eight teeth and a hole in the middle, centered at (cx, cy). */
function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    for (const [da, r] of [[-0.22, 12], [-0.15, 18], [0.15, 18], [0.22, 12]] as const) {
      const px = Math.cos(a + da) * r;
      const py = Math.sin(a + da) * r;
      if (i === 0 && da === -0.22) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.moveTo(6, 0);
  ctx.arc(0, 0, 6, 0, Math.PI * 2, true);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(10, 20, 70, 0.55)';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fill('evenodd');
  ctx.restore();
}
