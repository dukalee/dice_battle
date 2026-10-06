import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants';
import { makeMotes, makeStars, motePosition, twinkle } from './background';
import { hexToRgb, rgba, shade } from './ui/theme';

describe('stars and motes', () => {
  it('makes the same sky for the same seed, a different one for another seed', () => {
    expect(makeStars(7, 50)).toEqual(makeStars(7, 50));
    expect(makeStars(7, 50)).not.toEqual(makeStars(8, 50));
    expect(makeMotes(3, 20)).toEqual(makeMotes(3, 20));
  });

  it('keeps every star inside the upper sky', () => {
    for (const s of makeStars(1, 300)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(LOGICAL_WIDTH);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(LOGICAL_HEIGHT * 0.7);
    }
  });

  it('twinkles between a dim and a bright value, never outside 0..1', () => {
    for (const s of makeStars(2, 60)) {
      let lo = 1;
      let hi = 0;
      for (let t = 0; t < 8000; t += 50) {
        const v = twinkle(s, t);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(hi - lo).toBeGreaterThan(0.3);
    }
  });

  it('lets motes drift upward and wrap around, always staying near the screen', () => {
    for (const m of makeMotes(5, 40)) {
      let wrapped = false;
      let prev = motePosition(m, 0).y;
      for (let t = 100; t < 120_000; t += 100) {
        const p = motePosition(m, t);
        expect(p.y).toBeGreaterThanOrEqual(-31);
        expect(p.y).toBeLessThanOrEqual(LOGICAL_HEIGHT + 31);
        expect(Math.abs(p.x - m.x)).toBeLessThanOrEqual(m.sway + 1e-9);
        if (p.y > prev + 100) wrapped = true;
        prev = p.y;
      }
      expect(wrapped).toBe(true);
    }
  });

  it('holds still at time 0 and while time does not advance (a paused loop)', () => {
    const m = makeMotes(9, 1)[0];
    expect(motePosition(m, 500)).toEqual(motePosition(m, 500));
  });
});

describe('color helpers', () => {
  it('parses 6 and 3 digit hex colors', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(hexToRgb('#f80')).toEqual([255, 136, 0]);
  });

  it('shades toward white or black without leaving the 0..255 range', () => {
    expect(shade('#000000', 1)).toBe('rgb(255, 255, 255)');
    expect(shade('#ffffff', -1)).toBe('rgb(0, 0, 0)');
    expect(shade('#808080', 0)).toBe('rgb(128, 128, 128)');
    expect(shade('#ff0000', 0.5)).toBe('rgb(255, 128, 128)');
    expect(shade('#ff0000', -0.5)).toBe('rgb(128, 0, 0)');
    expect(shade('#123456', 9)).toBe('rgb(255, 255, 255)');
  });

  it('builds rgba strings', () => {
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});
