import { LOGICAL_WIDTH } from '../../core/constants';
import type { Rect } from '../../core/geometry';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../../game/characters';
import { drawDie } from '../dice';
import { drawSprite, type SpriteLibrary } from '../sprites';
import { drawText, roundRectPath, setFont, wrapLines } from '../text';

export const CARD_W = 396;
export const CARD_GAP = 24;
export const CARD_TOP = 96;
export const CARD_H = 608;

/** Each character gets a color of its own, like the faction cards it is modeled on. */
export const CARD_THEMES: Record<CharacterId, { border: string; top: string; bottom: string; glow: string; button: string; buttonDark: string; bar: string }> = {
  warrior: { border: '#c8651a', top: '#ffc15a', bottom: '#e5532b', glow: '#fff1b8', button: '#ffb21f', buttonDark: '#e0701a', bar: '#ffd34d' },
  rogue: { border: '#23794a', top: '#9be58f', bottom: '#2a8a58', glow: '#f0ffd0', button: '#4fd16a', buttonDark: '#1f9a4c', bar: '#9bf27e' },
  mage: { border: '#5a3fb8', top: '#b8a2ff', bottom: '#5b3fc0', glow: '#f1e8ff', button: '#9a6bff', buttonDark: '#5d38d6', bar: '#cdb8ff' },
};

/** Position of card `index` (0..2): three equal cards centered on the screen. */
export function cardRect(index: number): Rect {
  const total = CARD_W * 3 + CARD_GAP * 2;
  return { x: (LOGICAL_WIDTH - total) / 2 + index * (CARD_W + CARD_GAP), y: CARD_TOP, w: CARD_W, h: CARD_H };
}

/** Filled segments of the 10-segment HP gauge: max HP in tens, rounded (100 -> 10, 75 -> 8, 50 -> 5). */
export function hpSegments(maxHp: number): number {
  return Math.max(1, Math.min(10, Math.round(maxHp / 10)));
}

export interface CardState {
  /** 0 (resting) .. 1 (fully hovered): the card lifts and grows a little. */
  lift: number;
  pressed: boolean;
  /** Game time in ms, for the pulsing "click to choose" line. */
  time: number;
}

const RULE_FONT = 16;
const RULE_LINE = 20;
const RULE_GAP = 8;
const CHIP_W = 48;

/** Lines each rule row needs at the given text width (rows wrap to a second line when they must). */
export function ruleLines(measure: (s: string) => number, text: string, width: number): string[] {
  return wrapLines(measure, text, width);
}

/** One tall character card: name, art, stat gauges, a one-line intro and the rule rows. The whole card is the button. */
export function drawCharacterCard(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteLibrary,
  id: CharacterId,
  rect: Rect,
  state: CardState,
): void {
  const c = CHARACTERS[id];
  const theme = CARD_THEMES[id];
  const { x, y, w, h } = rect;
  const grow = 1 + 0.035 * state.lift;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(grow, grow);
  ctx.translate(-cx, -cy - 10 * state.lift);

  for (let i = 3; i >= 1; i--) {
    // soft drop shadow built from a few translucent layers (a real blur is too slow to redraw every frame)
    roundRectPath(ctx, x - i * 3, y + 6 + i * 3 + 6 * state.lift, w + i * 6, h + i * 3, 24 + i * 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fill();
  }
  roundRectPath(ctx, x, y, w, h, 24);
  ctx.fillStyle = theme.border;
  ctx.fill();

  // inner face
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, theme.top);
  g.addColorStop(1, theme.bottom);
  roundRectPath(ctx, x + 7, y + 7, w - 14, h - 14, 18);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = state.lift > 0.5 ? '#fff4b0' : 'rgba(255,255,255,0.45)';
  ctx.stroke();

  // glow behind the character
  const artX = cx;
  const artY = y + 170;
  const glow = ctx.createRadialGradient(artX, artY, 10, artX, artY, 180);
  glow.addColorStop(0, `${theme.glow}cc`);
  glow.addColorStop(1, `${theme.glow}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(artX, artY, 180, 0, Math.PI * 2);
  ctx.fill();

  drawSprite(ctx, sprites, id, 'idle', artX, artY, 'right', 0.72 + 0.04 * state.lift);

  // name, top left, like the faction cards
  ctx.save();
  setFont(ctx, 42, true);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = theme.border;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.strokeText(c.name, x + 24, y + 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(c.name, x + 24, y + 18);
  setFont(ctx, 18);
  ctx.lineWidth = 5;
  ctx.strokeText(c.englishName, x + 26, y + 66);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(c.englishName, x + 26, y + 66);
  ctx.restore();

  // stat panel: HP gauge and dice
  const px = x + 22;
  const pw = w - 44;
  const py = y + 282;
  roundRectPath(ctx, px, py, pw, 72, 12);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.55)';
  ctx.fill();
  drawText(ctx, '체력', px + 16, py + 20, { size: 18, baseline: 'middle' });
  const segs = hpSegments(c.maxHp);
  for (let i = 0; i < 10; i++) {
    roundRectPath(ctx, px + 78 + i * 22, py + 12, 17, 16, 3);
    ctx.fillStyle = i < segs ? theme.bar : 'rgba(255,255,255,0.18)';
    ctx.fill();
  }
  drawText(ctx, String(c.maxHp), px + pw - 14, py + 20, { size: 20, align: 'right', baseline: 'middle', color: theme.bar });
  drawText(ctx, '주사위', px + 16, py + 52, { size: 18, baseline: 'middle' });
  const faces = [5, 3, 6];
  for (let i = 0; i < c.diceCount; i++) {
    drawDie(ctx, { x: px + 100 + i * 36, y: py + 52, size: 26, face: faces[i], angle: (i - 1) * 0.12 });
  }
  drawText(ctx, `${c.diceCount}개`, px + pw - 14, py + 52, { size: 20, align: 'right', baseline: 'middle', color: theme.bar });

  // one-line intro
  drawText(ctx, c.description, cx, y + 380, { size: 19, align: 'center', baseline: 'middle', color: '#ffffff' });
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 30, y + 400, w - 60, 1.5);

  // rule rows: a colored chip (attack / heal) and what happens, wrapped when it is long
  setFont(ctx, RULE_FONT);
  const textX = x + 24 + CHIP_W + 12;
  const textW = x + w - 22 - textX;
  let ry = y + 414;
  for (const rule of c.cardRules) {
    const lines = ruleLines((s) => ctx.measureText(s).width, rule.text, textW);
    const isAttack = rule.kind === 'attack';
    roundRectPath(ctx, x + 24, ry + 1, CHIP_W, 22, 11);
    ctx.fillStyle = isAttack ? '#d9423f' : '#2f9a58';
    ctx.fill();
    drawText(ctx, isAttack ? '공격' : '회복', x + 24 + CHIP_W / 2, ry + 12, { size: 14, align: 'center', baseline: 'middle' });
    lines.forEach((line, i) => drawText(ctx, line, textX, ry + 12 + i * RULE_LINE, { size: RULE_FONT, baseline: 'middle', color: '#ffffff' }));
    ry += Math.max(24, lines.length * RULE_LINE + 4) + RULE_GAP;
  }

  // there is no select button: the whole card is clickable, and this line says so
  const pulse = 0.5 + 0.5 * Math.sin(state.time / 260);
  ctx.globalAlpha = 0.55 + 0.45 * Math.max(state.lift, pulse * 0.4);
  drawText(ctx, state.pressed ? '선택!' : '▶ 카드를 눌러 선택', cx, y + h - 26, { size: 18, align: 'center', baseline: 'middle', color: '#fff6c8' });
  ctx.globalAlpha = 1;

  ctx.restore();
}

export { CHARACTER_IDS };
