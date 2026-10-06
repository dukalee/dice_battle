import { FONT_DISPLAY, FONT_FAMILY, FONT_LOGO } from '../core/constants';

/** Text drawn the first time during play, as [font size, display font?, text]. Keep in step with the real draw calls. */
export const WARMUP_TEXT: ReadonlyArray<readonly [number, 'display' | 'body' | 'logo', string]> = [
  [46, 'display', '한 번 더!'],
  [46, 'display', '?'],
  [80, 'display', 'Critical!'],
  [80, 'display', 'FAIL!'],
  [30, 'display', 'ROUND CLEAR!'],
  [38, 'display', '공격!'],
  [38, 'display', '회복!'],
  [21, 'body', '홀짝이 같다! 같은 눈금! 두 눈의 합의 4배 데미지'],
  [23, 'body', '유저가 상대에게 데미지를 주었다! 회복했다! 마법이 역류해'],
];

/**
 * Draw every special effect text and gradient once on an off-screen canvas. Browsers (Firefox in particular) spend
 * tens of milliseconds the first time they rasterize big glyphs or build a gradient, which showed up as a visible
 * hitch right when the "one more!" announcement or the Critical! banner first appeared. Doing it up front, while
 * the game is still loading, moves that cost out of the action.
 */
export function warmUpEffects(): void {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  let y = 24;
  for (const [size, kind, text] of WARMUP_TEXT) {
    ctx.font = `${size}px ${kind === 'display' ? FONT_DISPLAY : kind === 'logo' ? FONT_LOGO : FONT_FAMILY}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, 360, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 360, y);
    ctx.measureText(text);
    y = (y + 34) % 300;
  }
  // the glow behind highlighted dice, and a dashed rounded box like the "?" slot
  const g = ctx.createRadialGradient(100, 100, 5, 100, 100, 80);
  g.addColorStop(0, 'rgba(255, 224, 110, 0.7)');
  g.addColorStop(1, 'rgba(255, 224, 110, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(20, 20, 160, 160);
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.roundRect(240, 60, 60, 60, 16);
  ctx.stroke();
}
