import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import { CHARACTERS, CHARACTER_IDS } from '../game/characters';
import { columnRows, GRID, HELP_STEPS, helpLayout, stepRows } from './helpScene';

describe('help screen grid', () => {
  const L = helpLayout();

  it('has the same left and right margin on both sides', () => {
    const first = L.columns[0];
    const last = L.columns[2];
    expect(first.x).toBe(GRID.margin);
    expect(LOGICAL_WIDTH - (last.x + last.w)).toBe(GRID.margin);
    expect(L.steps.x).toBe(GRID.margin);
    expect(LOGICAL_WIDTH - (L.steps.x + L.steps.w)).toBe(GRID.margin);
  });

  it('makes the steps panel span exactly the three columns, edge to edge', () => {
    expect(L.steps.x).toBe(L.columns[0].x);
    expect(L.steps.x + L.steps.w).toBe(L.columns[2].x + L.columns[2].w);
  });

  it('uses three equal columns with an equal gutter between them', () => {
    const [a, b, c] = L.columns;
    expect(b.w).toBe(a.w);
    expect(c.w).toBe(a.w);
    expect(b.x - (a.x + a.w)).toBe(GRID.gutter);
    expect(c.x - (b.x + b.w)).toBe(GRID.gutter);
    expect(a.y).toBe(b.y);
    expect(b.y).toBe(c.y);
    expect(a.h).toBe(b.h);
    expect(b.h).toBe(c.h);
  });

  it('separates every block vertically by the same gap', () => {
    const col = L.columns[0];
    expect(col.y - (L.steps.y + L.steps.h)).toBe(GRID.gap);
    expect(L.button.y - (col.y + col.h)).toBe(GRID.gap);
  });

  it('keeps everything on screen with the button centered', () => {
    expect(L.button.x + L.button.w / 2).toBe(LOGICAL_WIDTH / 2);
    expect(L.button.y + L.button.h).toBeLessThanOrEqual(LOGICAL_HEIGHT - 16);
    expect(L.heading.cx).toBe(LOGICAL_WIDTH / 2);
    // the heading band (about 62 px tall) ends above the steps panel
    expect(L.heading.cy + 31).toBeLessThanOrEqual(L.steps.y);
  });
});

describe('text rows inside the panels', () => {
  const L = helpLayout();

  it('keeps every character row inside its column, with room at the bottom', () => {
    for (const id of CHARACTER_IDS) {
      const rows = columnRows(CHARACTERS[id]);
      expect(rows.last + GRID.row / 2).toBeLessThanOrEqual(L.columns[0].h - 8);
      expect(rows.attackHeading).toBeGreaterThan(rows.description + GRID.row / 2); // clear of the description
    }
  });

  it('puts all rules on the same 21 px row grid, with half a row of air before the heal section', () => {
    const rows = columnRows(CHARACTERS.mage);
    for (let i = 1; i < rows.attackRules.length; i++) expect(rows.attackRules[i] - rows.attackRules[i - 1]).toBe(GRID.row);
    expect(rows.attackRules[0] - rows.attackHeading).toBe(GRID.row);
    expect(rows.healHeading - rows.attackRules.at(-1)!).toBe(GRID.row * 1.5);
    for (let i = 1; i < rows.healRules.length; i++) expect(rows.healRules[i] - rows.healRules[i - 1]).toBe(GRID.row);
  });

  it('starts the attack and heal headings at the same offset in every column (so the headings line up when the rules lists match)', () => {
    const tops = CHARACTER_IDS.map((id) => columnRows(CHARACTERS[id]).attackHeading);
    expect(new Set(tops).size).toBe(1);
    const names = CHARACTER_IDS.map((id) => columnRows(CHARACTERS[id]).name);
    expect(new Set(names).size).toBe(1);
  });

  it('keeps the steps inside their panel on an even 22 px pitch', () => {
    const r = stepRows(HELP_STEPS.length);
    expect(r.title).toBeLessThan(r.rows[0] - 16);
    for (let i = 1; i < r.rows.length; i++) expect(r.rows[i] - r.rows[i - 1]).toBe(22);
    expect(r.rows.at(-1)! + 11).toBeLessThanOrEqual(L.steps.h - 8);
  });
});
