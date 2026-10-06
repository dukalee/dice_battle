import { describe, expect, it } from 'vitest';
import { hpColor, splitBar } from './hud';

describe('hpColor', () => {
  it('goes from green to yellow to red as HP drops', () => {
    expect(hpColor(1)).toBe('#46d36e');
    expect(hpColor(0.51)).toBe('#46d36e');
    expect(hpColor(0.5)).toBe('#f0cb3c');
    expect(hpColor(0.26)).toBe('#f0cb3c');
    expect(hpColor(0.25)).toBe('#ea4f45');
    expect(hpColor(0)).toBe('#ea4f45');
  });
});

describe('splitBar', () => {
  it('shows a plain bar when the displayed value has caught up', () => {
    expect(splitBar(60, 60, 100)).toEqual({ solid: 0.6, trail: 0.6, kind: 'none' });
  });

  it('after a hit the solid part drops at once and a pale damage strip drains behind it', () => {
    expect(splitBar(100, 68, 100)).toEqual({ solid: 0.68, trail: 1, kind: 'damage' });
    const mid = splitBar(80, 68, 100);
    expect(mid.kind).toBe('damage');
    expect(mid.trail).toBeCloseTo(0.8);
    expect(mid.solid).toBeCloseTo(0.68);
  });

  it('while healing the solid part fills up toward the real HP', () => {
    expect(splitBar(40, 90, 100)).toEqual({ solid: 0.4, trail: 0.9, kind: 'heal' });
  });

  it('never leaves 0..1, even with overkill or odd values', () => {
    for (const [shown, hp] of [[-5, 0], [500, 20], [0, 500], [100, -3]] as const) {
      const b = splitBar(shown, hp, 100);
      for (const v of [b.solid, b.trail]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(b.trail).toBeGreaterThanOrEqual(b.solid);
    }
  });
});
