export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Edges count as inside. */
export function containsPoint(rect: Rect, px: number, py: number): boolean {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}
