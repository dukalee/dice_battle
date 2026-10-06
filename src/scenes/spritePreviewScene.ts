import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import type { Scene } from '../core/scene';
import { CHARACTER_IDS, type CharacterId } from '../game/characters';
import { drawBackground } from '../render/background';
import { drawSprite, getPoseConfig, posesOf, type PoseName } from '../render/sprites';
import { drawText } from '../render/text';
import type { AppContext, SceneParams } from './types';

const GRID_SCALE = 0.42;

/**
 * Development tool (open with ?scene=sprites). `grid` shows every pose of every character on one guide line,
 * `duel` shows the player (left, facing right) against the AI (right, facing left); click to cycle the pose.
 */
export class SpritePreviewScene implements Scene {
  private pose: PoseName;

  constructor(
    private readonly app: AppContext,
    private readonly params: SceneParams['spritePreview'],
  ) {
    this.pose = params.pose;
  }

  update(): void {}

  onPointerDown(): void {
    if (this.params.view !== 'duel') return;
    const shared = posesOf(this.params.player).filter((p) => posesOf(this.params.enemy).includes(p));
    this.pose = shared[(shared.indexOf(this.pose) + 1) % shared.length];
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackground(ctx);
    if (this.params.view === 'duel') this.renderDuel(ctx);
    else this.renderGrid(ctx);
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const cols = 7;
    const cellW = LOGICAL_WIDTH / cols;
    const rowH = 224;
    CHARACTER_IDS.forEach((id, row) => {
      const guideY = 16 + row * rowH + 120;
      ctx.strokeStyle = 'rgba(255,90,90,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, guideY);
      ctx.lineTo(LOGICAL_WIDTH, guideY);
      ctx.stroke();
      posesOf(id).forEach((pose, col) => {
        const cx = cellW * col + cellW / 2;
        const cfg = getPoseConfig(id, pose);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeRect(cellW * col, 16 + row * rowH, cellW, rowH);
        drawSprite(ctx, this.app.sprites, id, pose, cx, guideY, 'right', GRID_SCALE);
        ctx.fillStyle = '#ffe14d';
        ctx.fillRect(cx - 3, guideY - 3, 6, 6);
        drawText(ctx, `${id} ${pose} x${cfg.scale}`, cx, 16 + row * rowH + rowH - 10, { size: 13, align: 'center' });
      });
    });
  }

  private renderDuel(ctx: CanvasRenderingContext2D): void {
    const y = 380;
    this.drawOne(ctx, this.params.player, 330, y, 'right');
    this.drawOne(ctx, this.params.enemy, 950, y, 'left');
    drawText(ctx, `${this.params.player} vs ${this.params.enemy}  pose: ${this.pose}  (click to change)`, LOGICAL_WIDTH / 2, 40, {
      size: 26,
      align: 'center',
    });
    ctx.strokeStyle = 'rgba(255,90,90,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LOGICAL_WIDTH, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(0.5, 0.5, LOGICAL_WIDTH - 1, LOGICAL_HEIGHT - 1);
  }

  private drawOne(ctx: CanvasRenderingContext2D, id: CharacterId, x: number, y: number, facing: 'left' | 'right'): void {
    const pose = posesOf(id).includes(this.pose) ? this.pose : 'idle';
    drawSprite(ctx, this.app.sprites, id, pose, x, y, facing);
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
}
