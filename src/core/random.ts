import { createRng, type Rng } from '../game/rng';

/**
 * Seed for a new game: the `seed` URL parameter when present (handy for reproducing a game), otherwise the clock.
 * `src/game` must never call Math.random itself, so the seed is chosen here and injected.
 */
export function chooseSeed(search: string = ''): number {
  const raw = new URLSearchParams(search).get('seed');
  const parsed = raw === null ? NaN : Number(raw);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return (Math.random() * 0x100000000) >>> 0;
}

export function createGameRng(search: string = ''): Rng {
  return createRng(chooseSeed(search));
}
