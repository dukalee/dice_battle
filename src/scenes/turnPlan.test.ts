import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../game/battle';
import { evaluateAttack, evaluateHeal, type Outcome } from '../game/rules';
import { bannerFor, describeTurn, poseFor } from './turnPlan';

const attackPose = (o: Outcome) => poseFor('attack', o);
const healPose = (o: Outcome) => poseFor('heal', o);

describe('poses', () => {
  it('uses the critical pose when a special rule fired', () => {
    expect(attackPose(evaluateAttack('warrior', [4, 4]))).toBe('critical_attack');
    expect(attackPose(evaluateAttack('rogue', [4, 2], [3, 5]))).toBe('critical_attack');
    for (const dice of [[6, 6, 6], [3, 3, 3], [5, 5, 5], [1, 3, 1], [2, 4, 6], [3, 1, 2]]) {
      expect(attackPose(evaluateAttack('mage', dice))).toBe('critical_attack');
    }
    expect(healPose(evaluateHeal('warrior', [2, 2]))).toBe('critical_heal');
    expect(healPose(evaluateHeal('rogue', [2, 6], [4]))).toBe('critical_heal');
    expect(healPose(evaluateHeal('mage', [3, 3, 3]))).toBe('critical_heal');
    expect(healPose(evaluateHeal('mage', [1, 3, 5]))).toBe('critical_heal');
  });

  it('uses the plain pose for a plain sum or highest die', () => {
    expect(attackPose(evaluateAttack('warrior', [3, 5]))).toBe('attack');
    expect(attackPose(evaluateAttack('rogue', [4, 3]))).toBe('attack');
    expect(attackPose(evaluateAttack('mage', [2, 5, 3]))).toBe('attack');
    expect(healPose(evaluateHeal('warrior', [1, 2]))).toBe('heal');
    expect(healPose(evaluateHeal('rogue', [2, 5]))).toBe('heal');
    expect(healPose(evaluateHeal('mage', [1, 2, 4]))).toBe('heal');
  });

  it('uses the fail pose for the mage 1,1,1 self-KO', () => {
    expect(attackPose(evaluateAttack('mage', [1, 1, 1]))).toBe('fail');
  });
});

describe('banners', () => {
  it('says Critical! with the rule description for special results', () => {
    const o = evaluateAttack('warrior', [4, 4]);
    expect(bannerFor(o)).toEqual({ text: 'Critical!', detail: o.description, tone: 'critical' });
    expect(bannerFor(evaluateAttack('mage', [6, 6, 6]))?.text).toBe('Critical!');
    expect(bannerFor(evaluateHeal('mage', [2, 2, 2]))?.text).toBe('Critical!');
  });

  it('says only FAIL! for the mage self-KO, never Critical!', () => {
    const b = bannerFor(evaluateAttack('mage', [1, 1, 1]));
    expect(b).toMatchObject({ text: 'FAIL!', tone: 'fail' });
    expect(b?.detail.length).toBeGreaterThan(0);
  });

  it('says nothing for plain results', () => {
    expect(bannerFor(evaluateAttack('warrior', [3, 5]))).toBeNull();
    expect(bannerFor(evaluateAttack('rogue', [4, 3]))).toBeNull();
    expect(bannerFor(evaluateAttack('mage', [2, 5, 3]))).toBeNull();
    expect(bannerFor(evaluateHeal('warrior', [1, 2]))).toBeNull();
  });
});

describe('over every possible roll', () => {
  const outcomes: Outcome[] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) {
      outcomes.push(evaluateAttack('warrior', [a, b]), evaluateHeal('warrior', [a, b]), evaluateHeal('rogue', [a, b], (a + b) % 2 === 0 ? [4] : undefined));
      outcomes.push(evaluateAttack('rogue', [a, b], (a + b) % 2 === 0 ? [3, 4] : undefined));
      for (let c = 1; c <= 6; c++) outcomes.push(evaluateAttack('mage', [a, b, c]), evaluateHeal('mage', [a, b, c]));
    }

  it('shows the banner and pose that match the outcome flags, and nothing else', () => {
    for (const o of outcomes) {
      const banner = bannerFor(o);
      const pose = poseFor(o.action, o);
      if (o.fail) {
        expect(banner?.text).toBe('FAIL!');
        expect(pose).toBe('fail');
      } else if (o.critical) {
        expect(banner?.text).toBe('Critical!');
        expect(pose).toBe(o.action === 'attack' ? 'critical_attack' : 'critical_heal');
      } else {
        expect(banner).toBeNull();
        expect(pose).toBe(o.action === 'attack' ? 'attack' : 'heal');
      }
    }
  });
});

describe('describeTurn', () => {
  const turn = (actor: 'player' | 'enemy', action: 'attack' | 'heal'): BattleEvent => ({ type: 'turn', actor, action });
  const rolled = (actor: 'player' | 'enemy', outcome: Outcome): BattleEvent => ({ type: 'rolled', actor, outcome });

  it('marks the victim of a damaging attack and shows no ending for a normal hit', () => {
    const o = evaluateAttack('warrior', [3, 5]);
    const plan = describeTurn([turn('player', 'attack'), rolled('player', o), { type: 'damaged', target: 'enemy', amount: 8, hpBefore: 100, hpAfter: 92 }]);
    expect(plan).toMatchObject({ actor: 'player', action: 'attack', actorPose: 'attack', victim: 'enemy', banner: null, defeated: null, ending: 'none' });
  });

  it('has no victim for a heal', () => {
    const o = evaluateHeal('mage', [2, 2, 2]);
    const plan = describeTurn([turn('enemy', 'heal'), rolled('enemy', o), { type: 'healed', target: 'enemy', amount: 50, hpBefore: 20, hpAfter: 50, source: 'action' }]);
    expect(plan).toMatchObject({ actor: 'enemy', victim: null, actorPose: 'critical_heal', defeated: null });
    expect(plan.banner?.text).toBe('Critical!');
  });

  it('reports a defeated enemy and the round clear', () => {
    const o = evaluateAttack('mage', [6, 6, 6]);
    const plan = describeTurn([
      turn('player', 'attack'),
      rolled('player', o),
      { type: 'damaged', target: 'enemy', amount: 100, hpBefore: 40, hpAfter: 0 },
      { type: 'roundCleared', round: 1 },
    ]);
    expect(plan).toMatchObject({ victim: 'enemy', defeated: 'enemy', ending: 'roundCleared' });
  });

  it('reports a defeated player and game over', () => {
    const o = evaluateAttack('mage', [6, 6, 6]);
    const plan = describeTurn([
      turn('enemy', 'attack'),
      rolled('enemy', o),
      { type: 'damaged', target: 'player', amount: 100, hpBefore: 40, hpAfter: 0 },
      { type: 'gameOver', round: 3 },
    ]);
    expect(plan).toMatchObject({ victim: 'player', defeated: 'player', ending: 'gameOver' });
  });

  it('treats the mage self-KO as the actor being defeated, with no victim', () => {
    const o = evaluateAttack('mage', [1, 1, 1]);
    const plan = describeTurn([
      turn('enemy', 'attack'),
      rolled('enemy', o),
      { type: 'selfKO', actor: 'enemy', hpBefore: 30, hpAfter: 0 },
      { type: 'roundCleared', round: 2 },
    ]);
    expect(plan).toMatchObject({ actor: 'enemy', actorPose: 'fail', victim: null, defeated: 'enemy', ending: 'roundCleared' });
    expect(plan.banner).toMatchObject({ text: 'FAIL!' });
  });

  it('treats a mage backfire as FAIL with the fail pose and no victim', () => {
    const o = evaluateAttack('mage', [2, 2, 2]);
    const plan = describeTurn([
      turn('player', 'attack'),
      rolled('player', o),
      { type: 'selfDamaged', actor: 'player', amount: 25, hpBefore: 50, hpAfter: 25 },
    ]);
    expect(plan).toMatchObject({ actorPose: 'fail', victim: null, defeated: null, ending: 'none' });
    expect(plan.banner).toMatchObject({ text: 'FAIL!', tone: 'fail' });
  });

  it('a backfire that brings HP to 0 defeats the actor', () => {
    const o = evaluateAttack('mage', [4, 4, 4]);
    const plan = describeTurn([
      turn('enemy', 'attack'),
      rolled('enemy', o),
      { type: 'selfDamaged', actor: 'enemy', amount: 25, hpBefore: 20, hpAfter: 0 },
      { type: 'roundCleared', round: 1 },
    ]);
    expect(plan).toMatchObject({ actorPose: 'fail', defeated: 'enemy', ending: 'roundCleared' });
  });

  it('rejects events that are not a turn', () => {
    expect(() => describeTurn([{ type: 'roundCleared', round: 1 }])).toThrow();
  });
});
