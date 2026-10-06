import { CHARACTERS, type CharacterId } from './characters';
import { rollDice, type Rng } from './rng';

export type Action = 'attack' | 'heal';

/**
 * damage: hurt the opponent by `amount`.
 * heal:   restore `amount` HP to the actor (the caller clamps to max HP).
 * selfKO: the actor's own HP drops to 0 (mage 1,1,1); `amount` is 0.
 * selfDamage: the actor hurts itself by `amount` (mage 2,2,2 / 4,4,4 backfire).
 */
export type OutcomeKind = 'damage' | 'heal' | 'selfKO' | 'selfDamage';

export interface Outcome {
  character: CharacterId;
  action: Action;
  /** Every die that was shown, in order. A rogue's extra roll appends two more (4 in total). */
  rolls: number[];
  kind: OutcomeKind;
  amount: number;
  /** A special rule fired (anything other than the plain sum / highest die). Shows "Critical!" and a critical_* pose. */
  critical: boolean;
  /** The mage's self-harm rolls (1,1,1 / 2,2,2 / 4,4,4). Shows "FAIL!" and the fail pose, never together with `critical`. */
  fail: boolean;
  /** Short explanation of the rule that applied, in Korean. */
  description: string;
}

const sum = (dice: number[]): number => dice.reduce((a, b) => a + b, 0);
const allSame = (dice: number[]): boolean => dice.every((d) => d === dice[0]);
const allSameParity = (dice: number[]): boolean => dice.every((d) => d % 2 === dice[0] % 2);
const isConsecutive = (dice: number[]): boolean => {
  const s = [...dice].sort((a, b) => a - b);
  return s.every((d, i) => i === 0 || d === s[i - 1] + 1);
};
const joinPlus = (dice: number[]): string => dice.join('+');

function checkDice(character: CharacterId, dice: number[], expected: number): void {
  if (dice.length !== expected) {
    throw new Error(`${character} rolls ${expected} dice, got ${dice.length}`);
  }
  for (const d of dice) {
    if (!Number.isInteger(d) || d < 1 || d > 6) throw new Error(`invalid die face: ${d}`);
  }
}

/** Rogue: both dice even or both odd (equal dice count) earns an extra roll. */
export function needsExtraRoll(character: CharacterId, dice: number[]): boolean {
  return character === 'rogue' && dice.length === 2 && allSameParity(dice);
}

/**
 * How many extra dice a throw earns: a rogue whose first two dice have the same parity throws two more when attacking
 * and one more when healing. Everyone else, and a rogue with mixed parity, throws none.
 */
export function extraDiceCount(character: CharacterId, action: Action, dice: number[]): number {
  if (!needsExtraRoll(character, dice)) return 0;
  return action === 'attack' ? 2 : 1;
}

/** How many dice show each face, largest group first. [4] = four of a kind, [3, 1] = triple, [2, 2] = two pairs. */
export function faceGroups(dice: number[]): number[] {
  const counts = new Map<number, number>();
  for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
}

function outcome(
  character: CharacterId,
  action: Action,
  rolls: number[],
  kind: OutcomeKind,
  amount: number,
  flags: { critical?: boolean; fail?: boolean },
  description: string,
): Outcome {
  return { character, action, rolls, kind, amount, critical: !!flags.critical, fail: !!flags.fail, description };
}

/**
 * Evaluate an attack for already-rolled dice. For a rogue whose first two dice trigger the extra roll,
 * `extraDice` must hold the two additional dice.
 */
export function evaluateAttack(character: CharacterId, dice: number[], extraDice?: number[]): Outcome {
  const def = CHARACTERS[character];
  checkDice(character, dice, def.diceCount);
  const dmg = (rolls: number[], amount: number, critical: boolean, description: string) =>
    outcome(character, 'attack', rolls, 'damage', amount, { critical }, description);

  switch (character) {
    case 'warrior': {
      const total = sum(dice);
      if (allSame(dice)) return dmg(dice, total * 4, true, '같은 눈금! 두 눈의 합의 4배 데미지');
      return dmg(dice, total, false, `두 주사위의 합 ${joinPlus(dice)} = ${total}`);
    }
    case 'rogue': {
      if (needsExtraRoll(character, dice)) {
        if (!extraDice) throw new Error('rogue extra roll needs two extra dice');
        checkDice(character, extraDice, 2);
        const all = [...dice, ...extraDice];
        // Look at how the four dice group, wherever each one landed: four of a kind, a triple, two pairs, else the sum.
        const groups = faceGroups(all);
        if (groups[0] === 4) return dmg(all, 75, true, '일격필살! 네 주사위가 모두 같다! 75 데미지');
        if (groups[0] === 3) return dmg(all, 30, true, '트리플! 같은 눈이 세 개! 30 데미지');
        if (groups[0] === 2 && groups[1] === 2) return dmg(all, 50, true, '두 쌍이 생겼다! 50 데미지');
        return dmg(all, sum(all), true, '홀짝이 같다! 주사위를 한 번 더 굴려 4개의 합만큼 데미지');
      }
      if (extraDice) throw new Error('rogue extra dice were given but not needed');
      const high = Math.max(...dice);
      return dmg(dice, high, false, `더 큰 눈금 ${high}`);
    }
    case 'mage': {
      const total = sum(dice);
      // three of a kind is a gamble: 6 is a one-hit kill, 1 is suicide, 2 and 4 backfire, 3 and 5 hit for 25
      if (allSame(dice)) {
        switch (dice[0]) {
          case 6:
            return dmg(dice, 100, true, '6, 6, 6! 100 데미지, 누구든 한 방에!');
          case 1:
            return outcome(character, 'attack', dice, 'selfKO', 0, { fail: true }, '1, 1, 1... 마법이 폭주해 자신의 HP가 0이 된다');
          case 2:
          case 4:
            return outcome(character, 'attack', dice, 'selfDamage', 25, { fail: true }, `${dice[0]}, ${dice[0]}, ${dice[0]}... 마법이 역류해 자신이 25 데미지를 입는다`);
          default:
            return dmg(dice, 25, true, `${dice[0]}, ${dice[0]}, ${dice[0]}! 25 데미지`);
        }
      }
      if (allSameParity(dice)) return dmg(dice, total * 2, true, `모두 ${dice[0] % 2 ? '홀수' : '짝수'}! 세 눈의 합의 2배 데미지`);
      if (isConsecutive(dice)) return dmg(dice, 45, true, '연속된 숫자! 45 데미지');
      const high = Math.max(...dice);
      return dmg(dice, high, false, `가장 높은 눈금 ${high}`);
    }
  }
}

/**
 * Evaluate a heal for already-rolled dice. A rogue whose first two dice have the same parity throws one extra die,
 * which must be given as `extraDice`.
 */
export function evaluateHeal(character: CharacterId, dice: number[], extraDice?: number[]): Outcome {
  const def = CHARACTERS[character];
  checkDice(character, dice, def.diceCount);
  const heal = (amount: number, critical: boolean, description: string, rolls: number[] = dice) =>
    outcome(character, 'heal', rolls, 'heal', amount, { critical }, description);
  const total = sum(dice);
  const wanted = extraDiceCount(character, 'heal', dice);
  if (extraDice && extraDice.length !== wanted) throw new Error(`${character} heal takes ${wanted} extra dice, got ${extraDice.length}`);

  switch (character) {
    case 'warrior':
      if (allSame(dice)) return heal(50, true, '같은 눈금! 50 회복');
      return heal(total, false, `두 주사위의 합 ${joinPlus(dice)} = ${total}`);
    case 'rogue': {
      if (wanted === 0) return heal(total, false, `두 주사위의 합 ${joinPlus(dice)} = ${total}`);
      if (!extraDice) throw new Error('rogue heal with the same parity needs one extra die');
      checkDice(character, extraDice, 1);
      const all = [...dice, ...extraDice];
      if (allSameParity(all)) return heal(20, true, `세 개 모두 ${all[0] % 2 ? '홀수' : '짝수'}! 20 회복`, all);
      return heal(sum(all), false, `세 주사위의 합 ${joinPlus(all)} = ${sum(all)}`, all);
    }
    case 'mage':
      if (allSame(dice)) return heal(def.maxHp, true, '세 주사위가 같다! HP를 모두 회복');
      if (allSameParity(dice)) return heal(30, true, `모두 ${dice[0] % 2 ? '홀수' : '짝수'}! 30 회복`);
      return heal(total, false, `세 주사위의 합 ${joinPlus(dice)} = ${total}`);
  }
}

/** Roll the character's dice with `rng` and evaluate an attack, including a rogue's extra roll. */
export function resolveAttack(character: CharacterId, rng: Rng): Outcome {
  const dice = rollDice(rng, CHARACTERS[character].diceCount);
  const extra = extraDiceCount(character, 'attack', dice) > 0 ? rollDice(rng, 2) : undefined;
  return evaluateAttack(character, dice, extra);
}

/** Roll the character's dice with `rng` and evaluate a heal. */
export function resolveHeal(character: CharacterId, rng: Rng): Outcome {
  const dice = rollDice(rng, CHARACTERS[character].diceCount);
  const extra = extraDiceCount(character, 'heal', dice);
  return evaluateHeal(character, dice, extra > 0 ? rollDice(rng, extra) : undefined);
}

/** Split an outcome's dice into the first throw and the rogue's extra pair (if any), the way the dice tray shows them. */
export function splitRolls(outcome: Outcome): { first: number[]; extra?: number[] } {
  const base = CHARACTERS[outcome.character].diceCount;
  return {
    first: outcome.rolls.slice(0, base),
    extra: outcome.rolls.length > base ? outcome.rolls.slice(base) : undefined,
  };
}
