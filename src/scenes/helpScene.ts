import { LOGICAL_WIDTH } from '../core/constants';
import type { Rect } from '../core/geometry';
import type { Scene } from '../core/scene';
import { CHARACTERS, CHARACTER_IDS, type CharacterDef } from '../game/characters';
import { drawBackground } from '../render/background';
import { drawText } from '../render/text';
import { Button, BUTTON_STYLES } from '../render/ui/button';
import { ButtonGroup } from '../render/ui/buttonGroup';
import { CARD_THEMES } from '../render/ui/characterCard';
import { drawHeading } from '../render/ui/hud';
import { ACCENT, drawPanel, rgba } from '../render/ui/theme';
import type { AppContext } from './types';

export const HELP_STEPS = [
  '캐릭터를 하나 고르면 ROUND 1이 시작됩니다. 상대는 ROUND마다 랜덤으로 나타납니다.',
  '내 턴에 [공격] 또는 [회복]을 고른 뒤, 주사위를 꾹 눌렀다 떼서 던집니다.',
  '눈금에 따라 데미지나 회복량이 정해집니다. 특별한 조합은 Critical!, 나에게 불리한 조합은 FAIL!이 뜹니다.',
  '상대의 HP를 0으로 만들면 최대 HP의 절반을 회복하고 다음 ROUND로 넘어갑니다.',
  '내 HP가 0이 되면 GAME OVER. 얼마나 멀리 갈 수 있는지 도전하세요!',
];

/**
 * The help screen sits on one grid. Horizontally: a 40 px margin on both sides, three equal columns and a 24 px gutter,
 * and the steps panel spans exactly the three columns. Vertically: every block is separated by the same 16 px gap.
 * Text inside a panel starts 24 px from its left edge, and rows are 21 px apart.
 */
export const GRID = {
  margin: 40,
  gutter: 24,
  gap: 16,
  /** Inner padding of every panel. */
  pad: 24,
  /** Distance between text rows inside the character columns. */
  row: 21,
} as const;

export interface HelpLayout {
  heading: { cx: number; cy: number };
  steps: Rect;
  columns: Rect[];
  button: Rect;
}

export function helpLayout(): HelpLayout {
  const contentW = LOGICAL_WIDTH - GRID.margin * 2;
  const colW = (contentW - GRID.gutter * 2) / 3;
  const stepsY = 90;
  const stepsH = 160;
  const colY = stepsY + stepsH + GRID.gap;
  const colH = 370;
  const buttonY = colY + colH + GRID.gap;
  return {
    heading: { cx: LOGICAL_WIDTH / 2, cy: 46 },
    steps: { x: GRID.margin, y: stepsY, w: contentW, h: stepsH },
    columns: [0, 1, 2].map((i) => ({ x: GRID.margin + i * (colW + GRID.gutter), y: colY, w: colW, h: colH })),
    button: { x: (LOGICAL_WIDTH - 240) / 2, y: buttonY, w: 240, h: 48 },
  };
}

/** Where each text row of a character column sits (y offsets from the column's top). */
export interface ColumnRows {
  name: number;
  description: number;
  attackHeading: number;
  attackRules: number[];
  healHeading: number;
  healRules: number[];
  /** The lowest row center, to check it stays inside the panel. */
  last: number;
}

export function columnRows(c: Pick<CharacterDef, 'rules'>): ColumnRows {
  const top = 100; // center of the first row (the attack heading)
  const r = GRID.row;
  const attackRules = c.rules.attack.map((_, i) => top + (i + 1) * r);
  // a half row of air before the heal section
  const healHeading = top + (c.rules.attack.length + 1) * r + r / 2;
  const healRules = c.rules.heal.map((_, i) => healHeading + (i + 1) * r);
  return {
    name: 27,
    description: 68,
    attackHeading: top,
    attackRules,
    healHeading,
    healRules,
    last: healRules.at(-1) ?? healHeading,
  };
}

/** Where each step row of the steps panel sits (center y offsets from the panel's top). */
export function stepRows(count: number): { title: number; rows: number[] } {
  return { title: 24, rows: Array.from({ length: count }, (_, i) => 52 + i * 22) };
}

export class HelpScene implements Scene {
  private readonly buttons: ButtonGroup;
  private time = 0;

  constructor(app: AppContext) {
    this.buttons = new ButtonGroup([
      new Button(helpLayout().button, '돌아가기', () => app.manager.go('title'), { ...BUTTON_STYLES.blue, fontSize: 28 }),
    ]);
  }

  update(dtMs: number): void {
    this.time += dtMs;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const L = helpLayout();
    drawBackground(ctx, this.time);
    drawHeading(ctx, L.heading.cx, L.heading.cy, '설명서', 42);

    // how to play: spans the three columns exactly
    const s = L.steps;
    drawPanel(ctx, s, { radius: 18, border: 'rgba(150,170,245,0.8)' });
    const sr = stepRows(HELP_STEPS.length);
    drawText(ctx, '게임 방법', s.x + GRID.pad, s.y + sr.title, { size: 26, baseline: 'middle', color: ACCENT.gold });
    HELP_STEPS.forEach((line, i) => {
      const y = s.y + sr.rows[i];
      ctx.fillStyle = ACCENT.gold;
      ctx.beginPath();
      ctx.arc(s.x + GRID.pad + 10, y, 10, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, String(i + 1), s.x + GRID.pad + 10, y + 1, { size: 14, align: 'center', baseline: 'middle', color: '#4a2a00' });
      drawText(ctx, line, s.x + GRID.pad + 32, y, { size: 19, baseline: 'middle' });
    });

    // one column per character, in the character's own color
    CHARACTER_IDS.forEach((id, i) => {
      const c = CHARACTERS[id];
      const theme = CARD_THEMES[id];
      const col = L.columns[i];
      const rows = columnRows(c);
      const left = col.x + GRID.pad;
      const right = col.x + col.w - GRID.pad;

      drawPanel(ctx, col, { radius: 18, border: theme.button, glow: rgba(theme.button, 0.45), borderWidth: 2.5 });
      // colored header strip, inset 4 px from the panel edge on every side
      ctx.save();
      const hg = ctx.createLinearGradient(col.x, 0, col.x + col.w, 0);
      hg.addColorStop(0, rgba(theme.button, 0.55));
      hg.addColorStop(1, rgba(theme.button, 0.05));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.roundRect(col.x + 4, col.y + 4, col.w - 8, 46, 14);
      ctx.fill();
      ctx.restore();

      drawText(ctx, c.name, left, col.y + rows.name, { size: 30, display: true, baseline: 'middle', color: '#ffffff' });
      drawText(ctx, `HP ${c.maxHp}  ·  주사위 ${c.diceCount}개`, right, col.y + rows.name + 1, {
        size: 20,
        align: 'right',
        baseline: 'middle',
        color: '#ffffff',
      });
      drawText(ctx, c.description, left, col.y + rows.description, { size: 17, baseline: 'middle', color: '#c9d0f0' });

      drawText(ctx, '공격', left, col.y + rows.attackHeading, { size: 20, baseline: 'middle', color: '#ff9a9a' });
      c.rules.attack.forEach((rule, k) => drawText(ctx, `· ${rule}`, left, col.y + rows.attackRules[k], { size: 17, baseline: 'middle' }));
      drawText(ctx, '회복', left, col.y + rows.healHeading, { size: 20, baseline: 'middle', color: '#8fe8a3' });
      c.rules.heal.forEach((rule, k) => drawText(ctx, `· ${rule}`, left, col.y + rows.healRules[k], { size: 17, baseline: 'middle' }));
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

