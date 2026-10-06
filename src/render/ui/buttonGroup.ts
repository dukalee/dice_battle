import type { Button } from './button';

/** Forwards pointer events to several buttons and draws them. */
export class ButtonGroup {
  constructor(public readonly buttons: Button[]) {}

  pointerDown(x: number, y: number): void {
    for (const b of this.buttons) b.pointerDown(x, y);
  }

  pointerMove(x: number, y: number): void {
    for (const b of this.buttons) b.pointerMove(x, y);
  }

  pointerUp(x: number, y: number): void {
    for (const b of this.buttons) b.pointerUp(x, y);
  }

  cancel(): void {
    for (const b of this.buttons) b.cancel();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.buttons) b.draw(ctx);
  }
}
