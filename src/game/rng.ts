/** Source of randomness. Every dice roll goes through one of these so tests can seed it. */
export interface Rng {
  /** Uniform number in [0, 1). */
  next(): number;
}

/** Small seedable generator (mulberry32). The same seed always yields the same sequence. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** One die: an integer from 1 to 6, each face equally likely. */
export function rollDie(rng: Rng): number {
  return Math.min(6, Math.floor(rng.next() * 6) + 1);
}

export function rollDice(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rollDie(rng));
}
