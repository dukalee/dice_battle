import { describe, expect, it } from 'vitest';
import { PIPS } from './dice';

describe('dice pips', () => {
  it('shows exactly as many pips as the face number', () => {
    for (let face = 1; face <= 6; face++) expect(PIPS[face]).toHaveLength(face);
  });

  it('puts every pip on the 3x3 grid, none twice', () => {
    for (let face = 1; face <= 6; face++) {
      const seen = new Set<string>();
      for (const [col, row] of PIPS[face]) {
        expect([0, 1, 2]).toContain(col);
        expect([0, 1, 2]).toContain(row);
        seen.add(`${col},${row}`);
      }
      expect(seen.size).toBe(face);
    }
  });

  it('keeps each face symmetric about the center (point symmetry), as on a real die', () => {
    for (let face = 1; face <= 6; face++) {
      const pips = PIPS[face].map(([c, r]) => `${c},${r}`);
      for (const [c, r] of PIPS[face]) expect(pips).toContain(`${2 - c},${2 - r}`);
    }
  });

  it('uses the standard layouts for 1, 5 and 6', () => {
    expect(PIPS[1]).toEqual([[1, 1]]);
    expect(PIPS[5]).toContainEqual([1, 1]);
    expect(PIPS[6]).not.toContainEqual([1, 1]);
  });
});
