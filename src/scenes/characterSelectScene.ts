import { LOGICAL_WIDTH } from '../core/constants';
import { approach } from '../core/math';
import type { Scene } from '../core/scene';
import { CHARACTERS, CHARACTER_IDS } from '../game/characters';
import { drawBackground } from '../render/background';
import { drawHeading } from '../render/ui/hud';
import { Button } from '../render/ui/button';
import { cardRect, drawCharacterCard } from '../render/ui/characterCard';
import type { AppContext } from './types';

export class CharacterSelectScene implements Scene {
  /** Each card is one big button: pressing anywhere on it (including its select button) picks that character. */
  private readonly cards: Button[];
  /** How far each card is lifted by hovering, 0..1, easing over time. */
  private readonly lift: number[] = [0, 0, 0];
  private time = 0;

  constructor(private readonly app: AppContext) {
    this.cards = CHARACTER_IDS.map(
      (id, i) => new Button(cardRect(i), CHARACTERS[id].name, () => app.manager.go('game', { character: id })),
    );
  }

  update(dtMs: number): void {
    this.time += dtMs;
    this.cards.forEach((card, i) => {
      this.lift[i] = approach(this.lift[i], card.hover || card.pressed ? 1 : 0, 7, dtMs);
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackground(ctx, this.time);
    drawHeading(ctx, LOGICAL_WIDTH / 2, 52, '캐릭터를 선택하세요', 38);

    CHARACTER_IDS.forEach((id, i) => {
      drawCharacterCard(ctx, this.app.sprites, id, this.cards[i].rect, { lift: this.lift[i], pressed: this.cards[i].pressed, time: this.time });
    });
  }

  onPointerDown(x: number, y: number): void {
    for (const c of this.cards) c.pointerDown(x, y);
  }
  onPointerMove(x: number, y: number): void {
    for (const c of this.cards) c.pointerMove(x, y);
  }
  onPointerUp(x: number, y: number): void {
    for (const c of this.cards) c.pointerUp(x, y);
  }
  onPointerCancel(): void {
    for (const c of this.cards) c.cancel();
  }
}
