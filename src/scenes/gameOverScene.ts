import { FONT_DISPLAY, LOGICAL_WIDTH } from '../core/constants';
import type { Scene } from '../core/scene';
import { CHARACTERS } from '../game/characters';
import { drawBackground, drawPlatform } from '../render/background';
import { cachedLayer, pixelScale } from '../render/cache';
import { drawSprite } from '../render/sprites';
import { drawText } from '../render/text';
import { Button, BUTTON_STYLES } from '../render/ui/button';
import { ButtonGroup } from '../render/ui/buttonGroup';
import { drawPanel } from '../render/ui/theme';
import type { AppContext, SceneParams } from './types';

export class GameOverScene implements Scene {
  private readonly buttons: ButtonGroup;
  private time = 0;

  constructor(
    private readonly app: AppContext,
    private readonly params: SceneParams['gameOver'],
  ) {
    const w = 300;
    const gap = 40;
    const x = (LOGICAL_WIDTH - (w * 2 + gap)) / 2;
    this.buttons = new ButtonGroup([
      new Button({ x, y: 524, w, h: 84 }, '재시작', () => app.manager.go('characterSelect'), { ...BUTTON_STYLES.gold, fontSize: 36 }),
      new Button({ x: x + w + gap, y: 524, w, h: 84 }, '타이틀', () => app.manager.go('title'), { ...BUTTON_STYLES.blue, fontSize: 36 }),
    ]);
  }

  update(dtMs: number): void {
    this.time += dtMs;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackground(ctx, this.time);
    // a red wash, so the screen feels like a defeat
    const wash = ctx.createRadialGradient(LOGICAL_WIDTH / 2, 200, 40, LOGICAL_WIDTH / 2, 200, 640);
    wash.addColorStop(0, 'rgba(255, 60, 70, 0.28)');
    wash.addColorStop(1, 'rgba(255, 60, 70, 0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, 720);

    const title = cachedLayer('gameover-title', LOGICAL_WIDTH, 240, pixelScale(ctx), (c) => {
      c.font = `124px ${FONT_DISPLAY}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 22;
      c.strokeStyle = '#2a0610';
      c.strokeText('GAME OVER', LOGICAL_WIDTH / 2, 120);
      const g = c.createLinearGradient(0, 60, 0, 180);
      g.addColorStop(0, '#ff9a8a');
      g.addColorStop(1, '#e02a3a');
      c.shadowColor = 'rgba(255, 60, 60, 0.8)';
      c.shadowBlur = 26;
      c.fillStyle = g;
      c.fillText('GAME OVER', LOGICAL_WIDTH / 2, 120);
    });
    ctx.drawImage(title, 0, 30, LOGICAL_WIDTH, 240);

    drawPanel(ctx, { x: LOGICAL_WIDTH / 2 - 310, y: 236, w: 620, h: 252 }, { radius: 22, border: '#ff8a8a', glow: 'rgba(255, 90, 90, 0.4)', borderWidth: 3 });
    drawPlatform(ctx, LOGICAL_WIDTH / 2 - 190, 436, 70, '#8a90c0', this.time);
    drawSprite(ctx, this.app.sprites, this.params.character, 'hit', LOGICAL_WIDTH / 2 - 190, 352, 'right', 0.3);
    drawText(ctx, 'ROUND', LOGICAL_WIDTH / 2 + 70, 284, { size: 26, align: 'center', baseline: 'middle', color: '#c9d0f0' });
    drawText(ctx, String(this.params.round), LOGICAL_WIDTH / 2 + 70, 356, { size: 96, display: true, align: 'center', baseline: 'middle', color: '#ffd34d' });
    drawText(ctx, '까지 진행했습니다', LOGICAL_WIDTH / 2 + 70, 424, { size: 24, align: 'center', baseline: 'middle' });
    drawText(ctx, `${CHARACTERS[this.params.character].name}(으)로 플레이`, LOGICAL_WIDTH / 2, 464, {
      size: 20,
      align: 'center',
      baseline: 'middle',
      color: '#aab2e0',
    });
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
