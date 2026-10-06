import { describe, expect, it } from 'vitest';
import { warmUpEffects, WARMUP_TEXT } from './warmup';

// Raw text of every non-test source file, to be sure the warm-up list matches what the game really draws.
const sources = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
const all = Object.values(sources).join('\n');

describe('warm-up', () => {
  it('does nothing (and does not throw) where there is no document', () => {
    expect(() => warmUpEffects()).not.toThrow();
  });

  it('lists the effect texts the game draws for the first time during play', () => {
    const texts = WARMUP_TEXT.map((t) => t[2]);
    for (const needed of ['한 번 더!', '?', 'Critical!', 'FAIL!']) expect(texts).toContain(needed);
    expect(all).toContain("'한 번 더!'");
    expect(all).toContain("'Critical!'");
    expect(all).toContain("'FAIL!'");
  });
});
