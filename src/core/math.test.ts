import { describe, expect, it } from 'vitest';
import { approach, clamp } from './math';

describe('approach', () => {
  it('moves toward a higher target at the given speed', () => {
    expect(approach(0, 100, 50, 1000)).toBe(50);
    expect(approach(0, 100, 50, 500)).toBe(25);
  });

  it('moves toward a lower target', () => {
    expect(approach(100, 0, 50, 1000)).toBe(50);
  });

  it('never overshoots', () => {
    expect(approach(90, 100, 50, 1000)).toBe(100);
    expect(approach(10, 0, 50, 1000)).toBe(0);
  });

  it('does not move when dt is 0 (paused)', () => {
    expect(approach(10, 100, 50, 0)).toBe(10);
  });
});

describe('clamp', () => {
  it('limits a value to the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
