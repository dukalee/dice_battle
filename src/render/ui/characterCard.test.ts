import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../core/constants';
import { CHARACTERS, CHARACTER_IDS } from '../../game/characters';
import { CARD_H, CARD_THEMES, cardRect, hpSegments } from './characterCard';

describe('card layout', () => {
  it('puts three equal cards side by side, centered, inside the screen', () => {
    const rects = [0, 1, 2].map(cardRect);
    for (const r of rects) {
      expect(r.w).toBe(rects[0].w);
      expect(r.h).toBe(rects[0].h);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(LOGICAL_WIDTH);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(LOGICAL_HEIGHT);
    }
    expect(rects[1].x).toBeGreaterThan(rects[0].x + rects[0].w);
    expect(rects[2].x).toBeGreaterThan(rects[1].x + rects[1].w);
    expect(rects[0].x).toBeCloseTo(LOGICAL_WIDTH - (rects[2].x + rects[2].w), 6);
  });

  it('keeps the screen heading clear of the cards', () => {
    expect(cardRect(0).y).toBeGreaterThan(80);
  });
});

describe('hpSegments', () => {
  it('shows max HP in tens, rounded, between 1 and 10', () => {
    expect(hpSegments(100)).toBe(10);
    expect(hpSegments(75)).toBe(8);
    expect(hpSegments(70)).toBe(7);
    expect(hpSegments(50)).toBe(5);
    expect(hpSegments(1)).toBe(1);
    expect(hpSegments(500)).toBe(10);
  });

  it('orders the three characters by their HP', () => {
    expect(hpSegments(CHARACTERS.warrior.maxHp)).toBeGreaterThan(hpSegments(CHARACTERS.rogue.maxHp));
    expect(hpSegments(CHARACTERS.rogue.maxHp)).toBeGreaterThan(hpSegments(CHARACTERS.mage.maxHp));
  });
});

describe('card content', () => {
  it('has a theme and text for every character', () => {
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      expect(CARD_THEMES[id].top).toMatch(/^#[0-9a-f]{6}$/i);
      expect(CARD_THEMES[id].glow).toMatch(/^#[0-9a-f]{6}$/i); // used with an alpha suffix
      expect(c.englishName.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect([...c.description].length).toBeLessThanOrEqual(28); // one line under the stats
      expect(c.cardRules.some((r) => r.kind === 'attack')).toBe(true);
      expect(c.cardRules.some((r) => r.kind === 'heal')).toBe(true);
    }
  });

  it('keeps every card rule short enough to fit the card (at most 28 characters each, five rows)', () => {
    for (const id of CHARACTER_IDS) {
      const rules = CHARACTERS[id].cardRules;
      expect(rules.length).toBeLessThanOrEqual(5);
      for (const r of rules) expect([...r.text].length).toBeLessThanOrEqual(28); // fits one line of the card at 16px
    }
  });

  it('mentions the key numbers of every character on the card', () => {
    const text = (id: keyof typeof CHARACTERS) => CHARACTERS[id].cardRules.map((r) => r.text).join(' ');
    expect(text('warrior')).toContain('x 4');
    expect(text('warrior')).toContain('50');
    expect(text('rogue')).toContain('75');
    expect(text('rogue')).toContain('50');
    expect(text('rogue')).toContain('30');
    expect(text('rogue')).toContain('20');
    expect(text('mage')).toContain('100');
    expect(text('mage')).toContain('25');
    expect(text('mage')).toContain('즉사');
  });

  it('is tall enough for the rows below the stats (art 282, intro 380, rows from 414, hint at the bottom)', () => {
    expect(CARD_H).toBeGreaterThanOrEqual(600);
  });

  it('gives each character its own color', () => {
    const tops = CHARACTER_IDS.map((id) => CARD_THEMES[id].top);
    expect(new Set(tops).size).toBe(3);
  });
});
