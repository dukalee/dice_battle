import { describe, expect, it } from 'vitest';
import { createRng, rollDice, rollDie } from './rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('returns numbers in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rollDie / rollDice', () => {
  it('always rolls an integer from 1 to 6', () => {
    const rng = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = rollDie(rng);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(rollDice(createRng(42), 3)).toEqual(rollDice(createRng(42), 3));
  });

  it('rolls the requested number of dice', () => {
    expect(rollDice(createRng(1), 0)).toEqual([]);
    expect(rollDice(createRng(1), 4)).toHaveLength(4);
  });

  it('covers every face with roughly uniform frequency', () => {
    const rng = createRng(2024);
    const counts = new Array(7).fill(0);
    const n = 60000;
    for (let i = 0; i < n; i++) counts[rollDie(rng)]++;
    for (let face = 1; face <= 6; face++) {
      expect(counts[face] / n).toBeGreaterThan(1 / 6 - 0.01);
      expect(counts[face] / n).toBeLessThan(1 / 6 + 0.01);
    }
  });

  it('maps the edges of the unit interval to faces 1 and 6', () => {
    expect(rollDie({ next: () => 0 })).toBe(1);
    expect(rollDie({ next: () => 0.999999 })).toBe(6);
  });
});
