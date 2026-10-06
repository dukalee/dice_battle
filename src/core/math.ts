/** Move `current` toward `target` at `speedPerSec` units per second without overshooting. */
export function approach(current: number, target: number, speedPerSec: number, dtMs: number): number {
  const step = speedPerSec * (dtMs / 1000);
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
