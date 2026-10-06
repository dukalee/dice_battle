import { describe, expect, it } from 'vitest';
import { bannerAlpha, bannerScale } from './banner';

describe('bannerScale', () => {
  it('starts large, settles to 1 and stays there', () => {
    expect(bannerScale(0)).toBeGreaterThan(1.4);
    expect(bannerScale(110)).toBeLessThan(bannerScale(0));
    expect(bannerScale(110)).toBeGreaterThan(1);
    expect(bannerScale(220)).toBe(1);
    expect(bannerScale(5000)).toBe(1);
  });
});

describe('bannerAlpha', () => {
  it('stays fully visible, then fades to nothing at the end of its life', () => {
    expect(bannerAlpha(0, 1500)).toBe(1);
    expect(bannerAlpha(1000, 1500)).toBe(1);
    expect(bannerAlpha(1325, 1500)).toBeCloseTo(0.5, 5);
    expect(bannerAlpha(1500, 1500)).toBe(0);
    expect(bannerAlpha(9000, 1500)).toBe(0);
  });
});
