import { describe, expect, it } from 'vitest';
import { applyDamage, applyHeal, Battle, type BattleEvent } from './battle';
import { CHARACTERS, CHARACTER_IDS } from './characters';
import { createRng, type Rng } from './rng';

/** Raw rng values that produce a given die face. */
const F = (...faces: number[]) => faces.map((f) => (f - 1) / 6 + 0.01);
/** Raw rng value that picks the enemy at `index` of [warrior, rogue, mage]. */
const PICK = (index: number) => [index / 3 + 0.01];
const WARRIOR = PICK(0);
const MAGE = PICK(2);
/** Raw rng values for the AI's action choice. */
const AI_ATTACK = [0.1];
const AI_HEAL = [0.9];

/** An Rng that returns the scripted values in order, and throws if the battle asks for more. */
function scripted(...parts: number[][]): Rng {
  const values = parts.flat();
  let i = 0;
  return {
    next: () => {
      if (i >= values.length) throw new Error(`script exhausted after ${values.length} values`);
      return values[i++];
    },
  };
}

const types = (events: BattleEvent[]) => events.map((e) => e.type);

describe('applyDamage / applyHeal', () => {
  it('never lets HP go below 0', () => {
    expect(applyDamage(30, 1000)).toBe(0);
    expect(applyDamage(30, 10)).toBe(20);
  });

  it('never lets HP go above max', () => {
    expect(applyHeal(90, 50, 100)).toBe(100);
    expect(applyHeal(100, 50, 100)).toBe(100);
    expect(applyHeal(10, 20, 100)).toBe(30);
  });
});

describe('starting a battle', () => {
  it('starts at ROUND 1 with both sides at max HP and the player to act', () => {
    const b = new Battle('warrior', scripted(MAGE));
    expect(b.state).toEqual({
      round: 1,
      phase: 'playerTurn',
      player: { id: 'warrior', hp: 100, maxHp: 100 },
      enemy: { id: 'mage', hp: 50, maxHp: 50 },
    });
  });

  it('can face the same character as the player', () => {
    const b = new Battle('mage', scripted(MAGE));
    expect(b.state.enemy.id).toBe('mage');
  });

  it('picks all three enemies roughly equally over many rounds', () => {
    const counts = { warrior: 0, rogue: 0, mage: 0 };
    const rng = createRng(2025);
    const n = 9000;
    for (let i = 0; i < n; i++) counts[new Battle('warrior', rng).state.enemy.id]++;
    for (const id of CHARACTER_IDS) {
      expect(counts[id] / n).toBeGreaterThan(1 / 3 - 0.03);
      expect(counts[id] / n).toBeLessThan(1 / 3 + 0.03);
    }
  });
});

describe('a turn', () => {
  it('player action reports the choice, the roll and the HP change, then hands the turn to the AI', () => {
    const b = new Battle('warrior', scripted(WARRIOR, F(4, 4)));
    const events = b.playerAction('attack');
    expect(types(events)).toEqual(['turn', 'rolled', 'damaged']);
    expect(events[0]).toEqual({ type: 'turn', actor: 'player', action: 'attack' });
    expect(events[1]).toMatchObject({ type: 'rolled', actor: 'player', outcome: { amount: 32, critical: true } });
    expect(events[2]).toEqual({ type: 'damaged', target: 'enemy', amount: 32, hpBefore: 100, hpAfter: 68 });
    expect(b.state.phase).toBe('enemyTurn');
    expect(b.state.enemy.hp).toBe(68);
  });

  it('the AI picks attack or heal at random and then acts', () => {
    const b = new Battle('warrior', scripted(WARRIOR, F(3, 5), AI_HEAL, F(1, 2)));
    b.playerAction('attack'); // 8 damage -> enemy 92
    const heal = b.enemyAction();
    expect(heal[0]).toEqual({ type: 'turn', actor: 'enemy', action: 'heal' });
    expect(b.state.enemy.hp).toBe(95); // 92 + 3 healed
    expect(b.state.phase).toBe('playerTurn');
  });

  it('the AI attacks when its random choice says so', () => {
    const b = new Battle('warrior', scripted(WARRIOR, F(1, 2), AI_ATTACK, F(2, 6)));
    b.playerAction('attack');
    const events = b.enemyAction();
    expect(events[0]).toEqual({ type: 'turn', actor: 'enemy', action: 'attack' });
    expect(events[2]).toMatchObject({ type: 'damaged', target: 'player', amount: 8, hpAfter: 92 });
  });

  it('turns alternate player, AI, player and the player always goes first', () => {
    const b = new Battle('warrior', scripted(WARRIOR, F(1, 2), AI_ATTACK, F(2, 3), F(5, 6)));
    expect(b.state.phase).toBe('playerTurn');
    b.playerAction('attack');
    expect(b.state.phase).toBe('enemyTurn');
    b.enemyAction();
    expect(b.state.phase).toBe('playerTurn');
    b.playerAction('attack');
    expect(b.state.phase).toBe('enemyTurn');
  });

  it('healing at full HP changes nothing and still passes the turn', () => {
    const b = new Battle('warrior', scripted(WARRIOR, F(2, 2)));
    const events = b.playerAction('heal');
    expect(events[2]).toEqual({ type: 'healed', target: 'player', amount: 50, hpBefore: 100, hpAfter: 100, source: 'action' });
    expect(b.state.player.hp).toBe(100);
    expect(b.state.phase).toBe('enemyTurn');
  });

  it('heal never pushes HP over max', () => {
    // enemy warrior hits for 8, then the player heals 50: 92 + 50 -> 100
    const b = new Battle('warrior', scripted(WARRIOR, F(1, 2), AI_ATTACK, F(3, 5), F(4, 4)));
    b.playerAction('attack');
    b.enemyAction();
    expect(b.state.player.hp).toBe(92);
    const events = b.playerAction('heal');
    expect(events[2]).toMatchObject({ type: 'healed', hpBefore: 92, hpAfter: 100 });
  });

  it('damage never takes HP below 0', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(6, 6, 6)));
    const events = b.playerAction('attack');
    expect(events[2]).toMatchObject({ type: 'damaged', amount: 100, hpBefore: 100, hpAfter: 0 });
    expect(b.state.enemy.hp).toBe(0);
  });

  it('a mage 6,6,6 defeats every character in one hit, even at full HP', () => {
    for (const [enemy, pick] of [['warrior', 0], ['rogue', 1], ['mage', 2]] as const) {
      const b = new Battle('mage', scripted(PICK(pick), F(6, 6, 6)));
      const events = b.playerAction('attack');
      expect(b.state.enemy.id).toBe(enemy);
      expect(b.state.enemy.hp).toBe(0);
      expect(events.at(-1)).toEqual({ type: 'roundCleared', round: 1 });
    }
  });

  it('rejects actions at the wrong time', () => {
    const b = new Battle('warrior', scripted(WARRIOR, F(1, 2)));
    expect(() => b.enemyAction()).toThrow();
    b.playerAction('attack');
    expect(() => b.playerAction('attack')).toThrow();
    expect(() => b.startNextRound()).toThrow();
  });
});

describe('ending a round or the game', () => {
  it('player HP 0 ends the game with the round reached', () => {
    const b = new Battle('warrior', scripted(MAGE, F(3, 4), AI_ATTACK, F(6, 6, 6)));
    b.playerAction('heal');
    const events = b.enemyAction();
    expect(types(events)).toEqual(['turn', 'rolled', 'damaged', 'gameOver']);
    expect(events.at(-1)).toEqual({ type: 'gameOver', round: 1 });
    expect(b.state.phase).toBe('gameOver');
    expect(b.state.player.hp).toBe(0);
    expect(() => b.playerAction('attack')).toThrow();
    expect(() => b.enemyAction()).toThrow();
  });

  it('enemy HP 0 clears the round', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(6, 6, 6)));
    const events = b.playerAction('attack');
    expect(types(events)).toEqual(['turn', 'rolled', 'damaged', 'roundCleared']);
    expect(events.at(-1)).toEqual({ type: 'roundCleared', round: 1 });
    expect(b.state.phase).toBe('roundCleared');
  });

  it('an AI mage rolling 1,1,1 knocks itself out and the player clears the round', () => {
    const b = new Battle('warrior', scripted(MAGE, F(3, 4), AI_ATTACK, F(1, 1, 1)));
    b.playerAction('attack');
    const events = b.enemyAction();
    expect(types(events)).toEqual(['turn', 'rolled', 'selfKO', 'roundCleared']);
    expect(events[2]).toEqual({ type: 'selfKO', actor: 'enemy', hpBefore: 43, hpAfter: 0 });
    expect(b.state.enemy.hp).toBe(0);
    expect(b.state.player.hp).toBe(100);
    expect(b.state.phase).toBe('roundCleared');
  });

  it('a player mage rolling 1,1,1 knocks itself out and the game is over', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(1, 1, 1)));
    const events = b.playerAction('attack');
    expect(types(events)).toEqual(['turn', 'rolled', 'selfKO', 'gameOver']);
    expect(events.at(-1)).toEqual({ type: 'gameOver', round: 1 });
    expect(b.state.player.hp).toBe(0);
    expect(b.state.enemy.hp).toBe(100);
  });
});

describe('mage backfire (2,2,2 and 4,4,4)', () => {
  it('costs the mage 25 HP, not the enemy, and the turn passes', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(2, 2, 2)));
    const events = b.playerAction('attack');
    expect(types(events)).toEqual(['turn', 'rolled', 'selfDamaged']);
    expect(events[2]).toEqual({ type: 'selfDamaged', actor: 'player', amount: 25, hpBefore: 50, hpAfter: 25 });
    expect(b.state.player.hp).toBe(25);
    expect(b.state.enemy.hp).toBe(100);
    expect(b.state.phase).toBe('enemyTurn');
  });

  it('can kill the mage: a second backfire at 25 HP ends the game', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(4, 4, 4), AI_HEAL, F(1, 2), F(4, 4, 4)));
    b.playerAction('attack');
    b.enemyAction();
    expect(b.state.player.hp).toBe(25);
    const events = b.playerAction('attack');
    expect(types(events)).toEqual(['turn', 'rolled', 'selfDamaged', 'gameOver']);
    expect(b.state.player.hp).toBe(0);
    expect(b.state.phase).toBe('gameOver');
  });

  it('never takes HP below 0', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(2, 2, 2), AI_HEAL, F(1, 2), F(2, 2, 2)));
    b.playerAction('attack');
    b.enemyAction();
    const events = b.playerAction('attack');
    expect(events[2]).toMatchObject({ type: 'selfDamaged', hpBefore: 25, hpAfter: 0 });
  });

  it('an AI mage that backfires to 0 HP clears the round for the player', () => {
    const b = new Battle('warrior', scripted(MAGE, F(1, 2), AI_ATTACK, F(2, 2, 2), F(3, 4), AI_ATTACK, F(4, 4, 4)));
    b.playerAction('attack');
    b.enemyAction(); // mage 50 - 3 (hit) - 25 = 22
    expect(b.state.enemy.hp).toBe(22);
    b.playerAction('attack'); // 7 -> 15
    const events = b.enemyAction(); // backfire 25 > 15
    expect(types(events)).toEqual(['turn', 'rolled', 'selfDamaged', 'roundCleared']);
    expect(b.state.enemy.hp).toBe(0);
    expect(b.state.player.hp).toBeGreaterThan(0);
  });
});

describe('next round', () => {
  /** Rogue player (70 HP) vs a mage that hits for 24 twice, then knocks itself out with 1,1,1. */
  function rogueDamagedTwice(): Battle {
    return new Battle(
      'rogue',
      scripted(
        MAGE,
        F(4, 3), AI_ATTACK, F(2, 4, 6), // player 4 dmg, rogue takes 24 -> 46
        F(4, 3), AI_ATTACK, F(2, 4, 6), // -> 27
        F(4, 3), AI_ATTACK, F(1, 1, 1), // mage knocks itself out
        WARRIOR, // next round's enemy
      ),
    );
  }

  it('heals the player by half of max HP, rounded down, when entering the next round', () => {
    const b = rogueDamagedTwice();
    b.playerAction('attack');
    b.enemyAction();
    b.playerAction('attack');
    b.enemyAction();
    b.playerAction('attack');
    b.enemyAction();
    expect(b.state.phase).toBe('roundCleared');
    expect(b.state.player.hp).toBe(22);

    const events = b.startNextRound();
    expect(events).toContainEqual({ type: 'healed', target: 'player', amount: 35, hpBefore: 22, hpAfter: 57, source: 'roundClear' });
    expect(b.state.round).toBe(2);
    expect(b.state.player.hp).toBe(57);
  });

  it('caps the round-clear heal at max HP (a rogue with 65 HP ends at 70, not 100)', () => {
    const b = new Battle(
      'rogue',
      scripted(MAGE, F(4, 3), AI_ATTACK, F(2, 5, 3), F(4, 3), AI_ATTACK, F(1, 1, 1), WARRIOR), // mage hits for 5 -> rogue 65
    );
    b.playerAction('attack');
    b.enemyAction();
    b.playerAction('attack');
    b.enemyAction();
    expect(b.state.player.hp).toBe(65);
    const events = b.startNextRound();
    expect(events).toContainEqual({ type: 'healed', target: 'player', amount: 35, hpBefore: 65, hpAfter: 70, source: 'roundClear' });
    expect(b.state.player.hp).toBe(70);
  });

  it('starts the new round with a fresh enemy at max HP and the player to act', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(6, 6, 6), PICK(1)));
    b.playerAction('attack');
    const events = b.startNextRound();
    expect(events[0]).toEqual({ type: 'roundStarted', round: 2, enemy: 'rogue' });
    expect(b.state).toMatchObject({
      round: 2,
      phase: 'playerTurn',
      enemy: { id: 'rogue', hp: CHARACTERS.rogue.maxHp, maxHp: CHARACTERS.rogue.maxHp },
    });
  });
});

describe('restarting', () => {
  it('reset starts a fresh game at ROUND 1', () => {
    const b = new Battle('mage', scripted(WARRIOR, F(1, 1, 1), PICK(1)));
    b.playerAction('attack');
    expect(b.state.phase).toBe('gameOver');
    b.reset('warrior');
    expect(b.state).toEqual({
      round: 1,
      phase: 'playerTurn',
      player: { id: 'warrior', hp: 100, maxHp: 100 },
      enemy: { id: 'rogue', hp: 70, maxHp: 70 },
    });
  });
});

/** Play a whole game with an auto-player; returns every event. */
function playGame(seed: number): { events: BattleEvent[]; battle: Battle } {
  const rng = createRng(seed);
  const choice = createRng(seed ^ 0x9e3779b9);
  const player = CHARACTER_IDS[seed % 3];
  const battle = new Battle(player, rng);
  const events: BattleEvent[] = [];
  let guard = 0;
  while (battle.state.phase !== 'gameOver' && guard++ < 5000) {
    if (battle.state.phase === 'playerTurn') events.push(...battle.playerAction(choice.next() < 0.7 ? 'attack' : 'heal'));
    else if (battle.state.phase === 'enemyTurn') events.push(...battle.enemyAction());
    else events.push(...battle.startNextRound());
  }
  return { events, battle };
}

describe('whole games', () => {
  it('give identical events for the same seed', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      expect(playGame(seed).events).toEqual(playGame(seed).events);
    }
  });

  it('always end, keep HP within 0..max, and report the round reached', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { events, battle } = playGame(seed);
      expect(battle.state.phase).toBe('gameOver');
      for (const e of events) {
        if (e.type === 'damaged' || e.type === 'healed' || e.type === 'selfKO') {
          expect(e.hpAfter).toBeGreaterThanOrEqual(0);
          expect(e.hpBefore).toBeGreaterThanOrEqual(0);
        }
      }
      expect(battle.state.player.hp).toBeGreaterThanOrEqual(0);
      expect(battle.state.player.hp).toBeLessThanOrEqual(battle.state.player.maxHp);
      expect(battle.state.enemy.hp).toBeGreaterThanOrEqual(0);
      expect(battle.state.enemy.hp).toBeLessThanOrEqual(battle.state.enemy.maxHp);
      const last = events.at(-1);
      expect(last).toEqual({ type: 'gameOver', round: battle.state.round });
    }
  });
});
