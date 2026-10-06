import { describe, expect, it } from 'vitest';
import { lungeOffset } from './titleScene';

describe('title fighters lunge', () => {
  it('starts at rest, strikes toward the rival, recoils, then rests until the next round', () => {
    expect(lungeOffset(0)).toBe(0);
    expect(lungeOffset(350)).toBeCloseTo(26, 5); // fully forward
    expect(lungeOffset(800)).toBeCloseTo(0, 5); // recoil finished
    expect(lungeOffset(1500)).toBe(0); // resting
  });

  it('never leaves 0..26 px and repeats every 2.4 s', () => {
    for (let t = 0; t < 10_000; t += 7) {
      const v = lungeOffset(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(26 + 1e-9);
      expect(lungeOffset(t + 2400)).toBeCloseTo(v, 6);
    }
  });

  it('keeps the second fighter out of step with the first', () => {
    expect(lungeOffset(0, 0.6)).not.toBe(lungeOffset(0));
  });

  it('holds still when time does not advance (a paused loop)', () => {
    expect(lungeOffset(1234)).toBe(lungeOffset(1234));
  });
});
