import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { createRng, type Rng } from './rng';
import {
  evaluateAttack,
  evaluateHeal,
  extraDiceCount,
  needsExtraRoll,
  resolveAttack,
  resolveHeal,
  splitRolls,
  type Outcome,
} from './rules';

/** An RNG that returns the given faces in order (face f is encoded as (f - 1) / 6 + a small offset). */
function sequenceRng(faces: number[]): Rng {
  let i = 0;
  return {
    next: () => {
      if (i >= faces.length) throw new Error('sequenceRng ran out of faces');
      return (faces[i++] - 1) / 6 + 0.01;
    },
  };
}

describe('characters', () => {
  it('has the specified stats', () => {
    expect(CHARACTERS.warrior).toMatchObject({ name: '전사', maxHp: 100, diceCount: 2 });
    expect(CHARACTERS.rogue).toMatchObject({ name: '도적', maxHp: 70, diceCount: 2 });
    expect(CHARACTERS.mage).toMatchObject({ name: '마법사', maxHp: 50, diceCount: 3 });
  });

  it('has an introduction and rule summaries for every character', () => {
    for (const c of Object.values(CHARACTERS)) {
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.rules.attack.length).toBeGreaterThan(0);
      expect(c.rules.heal.length).toBeGreaterThan(0);
    }
  });
});

describe('warrior', () => {
  it('attack with equal dice deals (sum) x 4 and is critical', () => {
    const o = evaluateAttack('warrior', [4, 4]);
    expect(o).toMatchObject({ kind: 'damage', amount: 32, critical: true, fail: false, rolls: [4, 4] });
    expect(o.description).toContain('4배');
    expect(evaluateAttack('warrior', [1, 1]).amount).toBe(8);
    expect(evaluateAttack('warrior', [6, 6]).amount).toBe(48);
  });

  it('attack with different dice deals the sum and is not critical', () => {
    expect(evaluateAttack('warrior', [3, 5])).toMatchObject({ kind: 'damage', amount: 8, critical: false });
  });

  it('heal with equal dice heals 50 and is critical', () => {
    expect(evaluateHeal('warrior', [2, 2])).toMatchObject({ kind: 'heal', amount: 50, critical: true });
  });

  it('heal with different dice heals the sum', () => {
    expect(evaluateHeal('warrior', [6, 1])).toMatchObject({ kind: 'heal', amount: 7, critical: false });
  });
});

describe('rogue', () => {
  it('has 70 max HP and two dice', () => {
    expect(CHARACTERS.rogue).toMatchObject({ maxHp: 70, diceCount: 2 });
  });

  it('attack with both even rerolls two more dice and sums all four', () => {
    expect(needsExtraRoll('rogue', [4, 2])).toBe(true);
    const o = evaluateAttack('rogue', [4, 2], [3, 5]);
    expect(o).toMatchObject({ kind: 'damage', amount: 14, critical: true, rolls: [4, 2, 3, 5] });
  });

  it('attack with both odd also triggers the extra roll', () => {
    expect(needsExtraRoll('rogue', [1, 5])).toBe(true);
    expect(evaluateAttack('rogue', [1, 5], [2, 3]).amount).toBe(11);
  });

  it('equal dice count as same parity and trigger the extra roll', () => {
    expect(needsExtraRoll('rogue', [3, 3])).toBe(true);
  });

  it('attack with mixed parity deals the higher die and has no extra roll', () => {
    expect(needsExtraRoll('rogue', [4, 3])).toBe(false);
    const o = evaluateAttack('rogue', [4, 3]);
    expect(o).toMatchObject({ kind: 'damage', amount: 4, critical: false, rolls: [4, 3] });
  });

  it('two pairs among the four dice deal 50 wherever the pairs landed', () => {
    for (const [first, extra] of [
      [[6, 6], [3, 3]],
      [[4, 4], [1, 1]],
      [[1, 1], [6, 6]],
      [[4, 2], [4, 2]], // the pairs are split across the two throws
      [[2, 4], [2, 4]],
      [[3, 5], [5, 3]],
      [[2, 6], [6, 2]],
    ]) {
      const o = evaluateAttack('rogue', first, extra);
      expect(o).toMatchObject({ kind: 'damage', amount: 50, critical: true, fail: false, rolls: [...first, ...extra] });
      expect(o.description).toContain('두 쌍');
    }
  });

  it('a triple among the four dice deals 30 wherever it landed', () => {
    for (const [first, extra] of [
      [[6, 6], [6, 1]],
      [[4, 4], [4, 3]],
      [[2, 4], [4, 4]],
      [[3, 5], [3, 3]],
      [[2, 2], [5, 2]],
    ]) {
      const o = evaluateAttack('rogue', first, extra);
      expect(o).toMatchObject({ kind: 'damage', amount: 30, critical: true, fail: false });
      expect(o.description).toContain('트리플');
    }
  });

  it('four of a kind deals 75 (the one-hit kill) and beats a triple and two pairs', () => {
    for (const face of [1, 2, 3, 4, 5, 6]) {
      const o = evaluateAttack('rogue', [face, face], [face, face]);
      expect(o).toMatchObject({ kind: 'damage', amount: 75, critical: true });
      expect(o.description).toContain('일격필살');
    }
    expect(75).toBeGreaterThanOrEqual(CHARACTERS.rogue.maxHp); // ... which is enough to take down a rogue itself
  });

  it('falls back to the plain sum of all four when nothing groups beyond a single pair', () => {
    expect(evaluateAttack('rogue', [6, 6], [3, 4]).amount).toBe(19);
    expect(evaluateAttack('rogue', [4, 2], [3, 3]).amount).toBe(12);
    expect(evaluateAttack('rogue', [3, 3], [1, 2]).amount).toBe(9);
    expect(evaluateAttack('rogue', [2, 4], [6, 1]).amount).toBe(13);
  });

  it('classifies every first/extra combination the same as an independent count', () => {
    const counts = { seventyFive: 0, fifty: 0, thirty: 0, sum: 0 };
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) {
        if ((a + b) % 2 !== 0) continue; // the extra roll only happens for the same parity
        for (let c = 1; c <= 6; c++)
          for (let d = 1; d <= 6; d++) {
            const faces = [a, b, c, d];
            const tally = [1, 2, 3, 4, 5, 6].map((f) => faces.filter((x) => x === f).length).filter((n) => n > 0).sort((x, y) => y - x);
            const expected = tally[0] === 4 ? 75 : tally[0] === 3 ? 30 : tally[0] === 2 && tally[1] === 2 ? 50 : a + b + c + d;
            const o = evaluateAttack('rogue', [a, b], [c, d]);
            expect(o.amount).toBe(expected);
            if (expected === 75) counts.seventyFive++;
            else if (expected === 50 && tally[0] === 2 && tally[1] === 2) counts.fifty++;
            else if (expected === 30 && tally[0] === 3) counts.thirty++;
            else counts.sum++;
          }
      }
    expect(counts.seventyFive).toBe(6);
    expect(counts.fifty + counts.thirty + counts.seventyFive + counts.sum).toBe(18 * 36);
    expect(counts.fifty).toBeGreaterThan(0);
    expect(counts.thirty).toBeGreaterThan(0);
  });

  it('never rerolls more than once, even if the extra roll is again same-parity', () => {
    const o = evaluateAttack('rogue', [2, 4], [6, 6]);
    expect(o.rolls).toEqual([2, 4, 6, 6]);
    expect(o.amount).toBe(18);
    // resolveAttack draws exactly 4 dice here: 2 + 2, nothing more
    const rng = sequenceRng([2, 4, 6, 6]);
    const resolved = resolveAttack('rogue', rng);
    expect(resolved.rolls).toEqual([2, 4, 6, 6]);
    expect(() => rng.next()).toThrow(); // all four faces were consumed and no fifth was drawn
  });

  it('throws if the extra dice are missing when the condition is met', () => {
    expect(() => evaluateAttack('rogue', [2, 4])).toThrow();
  });
});

describe('rogue heal', () => {
  it('earns one extra die when the first two have the same parity, and none otherwise', () => {
    expect(extraDiceCount('rogue', 'heal', [2, 6])).toBe(1);
    expect(extraDiceCount('rogue', 'heal', [5, 5])).toBe(1);
    expect(extraDiceCount('rogue', 'attack', [2, 6])).toBe(2);
    expect(extraDiceCount('rogue', 'heal', [2, 5])).toBe(0);
    expect(extraDiceCount('warrior', 'heal', [2, 2])).toBe(0);
    expect(extraDiceCount('mage', 'attack', [2, 2, 2])).toBe(0);
  });

  it('heals 20 when all three dice are even or all odd, and is critical', () => {
    const even = evaluateHeal('rogue', [2, 6], [4]);
    expect(even).toMatchObject({ kind: 'heal', amount: 20, critical: true, fail: false, rolls: [2, 6, 4] });
    expect(even.description).toBe('세 개 모두 짝수! 20 회복');
    expect(evaluateHeal('rogue', [5, 5], [1])).toMatchObject({ amount: 20, critical: true });
    expect(evaluateHeal('rogue', [1, 3], [5]).description).toBe('세 개 모두 홀수! 20 회복');
  });

  it('heals the sum of the three dice when the extra die breaks the pattern', () => {
    expect(evaluateHeal('rogue', [2, 6], [3])).toMatchObject({ kind: 'heal', amount: 11, critical: false, rolls: [2, 6, 3] });
    expect(evaluateHeal('rogue', [1, 3], [2]).amount).toBe(6);
    expect(evaluateHeal('rogue', [6, 6], [1]).amount).toBe(13);
  });

  it('with mixed parity there is no extra die and it heals the sum of two', () => {
    expect(evaluateHeal('rogue', [2, 5])).toMatchObject({ kind: 'heal', amount: 7, critical: false, rolls: [2, 5] });
  });

  it('requires the extra die when the parity matches, and refuses one when it does not', () => {
    expect(() => evaluateHeal('rogue', [2, 6])).toThrow();
    expect(() => evaluateHeal('rogue', [2, 5], [3])).toThrow();
    expect(() => evaluateHeal('rogue', [2, 6], [3, 4])).toThrow();
    expect(() => evaluateHeal('warrior', [3, 3], [2])).toThrow();
    expect(() => evaluateHeal('mage', [3, 3, 3], [2])).toThrow();
  });

  it('draws the extra die only when needed, and only one', () => {
    const rng = sequenceRng([2, 6, 4]);
    const o = resolveHeal('rogue', rng);
    expect(o).toEqual(evaluateHeal('rogue', [2, 6], [4]));
    expect(() => rng.next()).toThrow(); // exactly three faces were drawn
    const mixed = sequenceRng([2, 5]);
    expect(resolveHeal('rogue', mixed).rolls).toEqual([2, 5]);
    expect(() => mixed.next()).toThrow();
  });

  it('is not a healing amount that could ever be negative or zero', () => {
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++)
        for (let c = 1; c <= 6; c++) {
          const o = evaluateHeal('rogue', [a, b], (a + b) % 2 === 0 ? [c] : undefined);
          expect(o.amount).toBeGreaterThan(0);
        }
  });
});

describe('mage attack', () => {
  it('6,6,6 deals 100 and is critical: enough to defeat any character in one hit', () => {
    expect(evaluateAttack('mage', [6, 6, 6])).toMatchObject({ kind: 'damage', amount: 100, critical: true, fail: false });
    for (const id of Object.keys(CHARACTERS) as Array<keyof typeof CHARACTERS>) {
      expect(100).toBeGreaterThanOrEqual(CHARACTERS[id].maxHp);
    }
  });

  it('3,3,3 and 5,5,5 deal 25 and are critical', () => {
    for (const face of [3, 5]) {
      expect(evaluateAttack('mage', [face, face, face])).toMatchObject({ kind: 'damage', amount: 25, critical: true, fail: false });
    }
  });

  it('2,2,2 and 4,4,4 backfire: the mage takes 25 itself, FAIL and not critical', () => {
    for (const face of [2, 4]) {
      const o = evaluateAttack('mage', [face, face, face]);
      expect(o).toMatchObject({ kind: 'selfDamage', amount: 25, fail: true, critical: false });
      expect(o.description).toContain('25');
    }
  });

  it('1,1,1 knocks out the mage itself: selfKO and fail, not critical', () => {
    const o = evaluateAttack('mage', [1, 1, 1]);
    expect(o).toMatchObject({ kind: 'selfKO', amount: 0, fail: true, critical: false });
  });

  it('all odd or all even deals (sum) x 2 and is critical', () => {
    expect(evaluateAttack('mage', [1, 3, 1])).toMatchObject({ kind: 'damage', amount: 10, critical: true });
    expect(evaluateAttack('mage', [2, 4, 6])).toMatchObject({ amount: 24, critical: true });
    expect(evaluateAttack('mage', [3, 3, 5])).toMatchObject({ amount: 22, critical: true });
    expect(evaluateAttack('mage', [2, 2, 4])).toMatchObject({ amount: 16, critical: true });
  });

  it('three consecutive numbers deal 45 regardless of order', () => {
    for (const dice of [[1, 2, 3], [3, 4, 5], [4, 5, 6], [3, 1, 2], [6, 4, 5]]) {
      expect(evaluateAttack('mage', dice)).toMatchObject({ kind: 'damage', amount: 45, critical: true });
    }
  });

  it('anything else deals the highest die and is not critical', () => {
    expect(evaluateAttack('mage', [2, 5, 3])).toMatchObject({ kind: 'damage', amount: 5, critical: false });
    expect(evaluateAttack('mage', [1, 1, 2])).toMatchObject({ amount: 2, critical: false });
    expect(evaluateAttack('mage', [1, 2, 4])).toMatchObject({ amount: 4, critical: false });
  });

  it('respects priority: every three-of-a-kind beats the all-same-parity rule', () => {
    expect(evaluateAttack('mage', [6, 6, 6]).amount).toBe(100);
    expect(evaluateAttack('mage', [1, 1, 1]).kind).toBe('selfKO');
    expect(evaluateAttack('mage', [3, 3, 3]).amount).toBe(25); // not (3+3+3) x 2 = 18
    expect(evaluateAttack('mage', [5, 5, 5]).amount).toBe(25); // not (5+5+5) x 2 = 30
    expect(evaluateAttack('mage', [2, 2, 2]).kind).toBe('selfDamage'); // not (2+2+2) x 2 = 12
  });
});

describe('mage attack over all 216 rolls', () => {
  it('splits into the counts worked out by hand, with no overlap between rules', () => {
    const counts = { six: 0, ones: 0, backfire: 0, triple25: 0, parity: 0, consecutive: 0, plain: 0 };
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++)
        for (let c = 1; c <= 6; c++) {
          const o = evaluateAttack('mage', [a, b, c]);
          if (o.amount === 100) counts.six++;
          else if (o.kind === 'selfKO') counts.ones++;
          else if (o.kind === 'selfDamage') counts.backfire++;
          else if (o.critical && o.amount === 25) counts.triple25++;
          else if (o.critical && o.amount === 45) counts.consecutive++;
          else if (o.critical) counts.parity++;
          else counts.plain++;
        }
    // parity: 27 all-odd + 27 all-even, minus the six triples; consecutive: 4 sets x 3! orders
    expect(counts).toEqual({ six: 1, ones: 1, backfire: 2, triple25: 2, parity: 48, consecutive: 24, plain: 138 });
  });
});

describe('mage heal', () => {
  it('three equal dice heal to full (max HP) and are critical', () => {
    expect(evaluateHeal('mage', [2, 2, 2])).toMatchObject({ kind: 'heal', amount: CHARACTERS.mage.maxHp, critical: true });
    expect(evaluateHeal('mage', [1, 1, 1])).toMatchObject({ kind: 'heal', amount: CHARACTERS.mage.maxHp, critical: true, fail: false });
  });

  it('all odd or all even heal 30', () => {
    expect(evaluateHeal('mage', [2, 4, 6])).toMatchObject({ amount: 30, critical: true });
    expect(evaluateHeal('mage', [1, 3, 1])).toMatchObject({ amount: 30, critical: true });
  });

  it('anything else heals the sum', () => {
    expect(evaluateHeal('mage', [1, 2, 4])).toMatchObject({ kind: 'heal', amount: 7, critical: false });
  });
});

describe('critical and fail descriptions', () => {
  it('say what the special rule does, never the arithmetic', () => {
    const special: Outcome[] = [];
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) {
        special.push(evaluateAttack('warrior', [a, b]), evaluateHeal('warrior', [a, b]), evaluateHeal('rogue', [a, b], (a + b) % 2 === 0 ? [4] : undefined));
        special.push(evaluateAttack('rogue', [a, b], (a + b) % 2 === 0 ? [3, 4] : undefined));
        for (let c = 1; c <= 6; c++) special.push(evaluateAttack('mage', [a, b, c]), evaluateHeal('mage', [a, b, c]));
      }
    const shown = special.filter((o) => o.critical || o.fail);
    expect(shown.length).toBeGreaterThan(0);
    for (const o of shown) {
      expect(o.description).not.toMatch(/[=+()]/);
      expect(o.description).not.toMatch(/ x \d/);
    }
  });

  it('describes each special rule in words', () => {
    expect(evaluateAttack('warrior', [4, 4]).description).toBe('같은 눈금! 두 눈의 합의 4배 데미지');
    expect(evaluateAttack('rogue', [4, 2], [3, 5]).description).toBe('홀짝이 같다! 주사위를 한 번 더 굴려 4개의 합만큼 데미지');
    expect(evaluateAttack('mage', [1, 3, 1]).description).toBe('모두 홀수! 세 눈의 합의 2배 데미지');
    expect(evaluateAttack('mage', [2, 4, 6]).description).toBe('모두 짝수! 세 눈의 합의 2배 데미지');
    expect(evaluateHeal('rogue', [2, 6], [4]).description).toBe('세 개 모두 짝수! 20 회복');
  });
});

describe('outcome metadata', () => {
  it('records character and action', () => {
    expect(evaluateAttack('warrior', [1, 2])).toMatchObject({ character: 'warrior', action: 'attack' });
    expect(evaluateHeal('mage', [1, 2, 4])).toMatchObject({ character: 'mage', action: 'heal' });
  });

  it('never marks a result as both critical and fail', () => {
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++)
        for (let c = 1; c <= 6; c++) {
          const o = evaluateAttack('mage', [a, b, c]);
          expect(o.critical && o.fail).toBe(false);
        }
  });

  it('has a non-empty effect description for every special result', () => {
    expect(evaluateAttack('warrior', [3, 3]).description).not.toBe('');
    expect(evaluateAttack('mage', [1, 1, 1]).description).not.toBe('');
    expect(evaluateHeal('mage', [4, 4, 4]).description).not.toBe('');
  });
});

describe('input validation', () => {
  it('rejects the wrong number of dice', () => {
    expect(() => evaluateAttack('warrior', [1])).toThrow();
    expect(() => evaluateAttack('mage', [1, 2])).toThrow();
    expect(() => evaluateHeal('rogue', [1, 2, 3])).toThrow();
  });

  it('rejects faces outside 1..6 and non-integers', () => {
    expect(() => evaluateAttack('warrior', [0, 3])).toThrow();
    expect(() => evaluateAttack('warrior', [7, 3])).toThrow();
    expect(() => evaluateAttack('warrior', [1.5, 3])).toThrow();
  });
});

describe('resolveAttack / resolveHeal with the RNG', () => {
  it('uses the injected RNG so the same seed gives the same outcome', () => {
    const a = resolveAttack('mage', createRng(31337));
    const b = resolveAttack('mage', createRng(31337));
    expect(a).toEqual(b);
    const c = resolveHeal('warrior', createRng(5));
    const d = resolveHeal('warrior', createRng(5));
    expect(c).toEqual(d);
  });

  it('rolls the dice count of the character', () => {
    expect(resolveHeal('warrior', createRng(1)).rolls).toHaveLength(2);
    expect(resolveHeal('mage', createRng(1)).rolls).toHaveLength(3);
  });

  it('matches evaluate* for the dice that were rolled', () => {
    const rng = sequenceRng([4, 4]);
    expect(resolveAttack('warrior', rng)).toEqual(evaluateAttack('warrior', [4, 4]));
  });

  it('rogue attack draws the extra dice only when the condition is met', () => {
    expect(resolveAttack('rogue', sequenceRng([4, 3])).rolls).toEqual([4, 3]);
    expect(resolveAttack('rogue', sequenceRng([4, 2, 3, 5]))).toEqual(evaluateAttack('rogue', [4, 2], [3, 5]));
  });

  it('every attack/heal over many seeds is internally consistent', () => {
    for (let seed = 1; seed <= 500; seed++) {
      for (const id of ['warrior', 'rogue', 'mage'] as const) {
        const atk = resolveAttack(id, createRng(seed));
        const heal = resolveHeal(id, createRng(seed + 1000));
        expect(atk.rolls.every((v) => v >= 1 && v <= 6)).toBe(true);
        expect(atk.amount).toBeGreaterThanOrEqual(0);
        expect(heal.amount).toBeGreaterThan(0);
        expect(heal.kind).toBe('heal');
        expect(atk.critical && atk.fail).toBe(false);
      }
    }
  });
});

describe('splitRolls', () => {
  it('keeps a plain roll as the first throw', () => {
    expect(splitRolls(evaluateAttack('warrior', [3, 5]))).toEqual({ first: [3, 5], extra: undefined });
    expect(splitRolls(evaluateAttack('mage', [2, 5, 3]))).toEqual({ first: [2, 5, 3], extra: undefined });
  });

  it('separates the rogue extra pair', () => {
    expect(splitRolls(evaluateAttack('rogue', [4, 2], [3, 5]))).toEqual({ first: [4, 2], extra: [3, 5] });
  });
});
