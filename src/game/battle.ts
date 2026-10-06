import { ROUND_CLEAR_HEAL_RATIO } from '../core/constants';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from './characters';
import type { Rng } from './rng';
import { resolveAttack, resolveHeal, type Action, type Outcome } from './rules';

export type Side = 'player' | 'enemy';

/**
 * playerTurn:   waiting for playerAction()
 * enemyTurn:    waiting for enemyAction()
 * roundCleared: the enemy is down; waiting for startNextRound()
 * gameOver:     the player is down; only reset() is allowed
 */
export type BattlePhase = 'playerTurn' | 'enemyTurn' | 'roundCleared' | 'gameOver';

export interface Combatant {
  id: CharacterId;
  hp: number;
  maxHp: number;
}

export interface BattleState {
  round: number;
  phase: BattlePhase;
  player: Combatant;
  enemy: Combatant;
}

/** What happened, in order. The UI turns these into animations and log lines; this module knows nothing about timing. */
export type BattleEvent =
  | { type: 'roundStarted'; round: number; enemy: CharacterId }
  | { type: 'turn'; actor: Side; action: Action }
  | { type: 'rolled'; actor: Side; outcome: Outcome }
  | { type: 'damaged'; target: Side; amount: number; hpBefore: number; hpAfter: number }
  | { type: 'healed'; target: Side; amount: number; hpBefore: number; hpAfter: number; source: 'action' | 'roundClear' }
  | { type: 'selfKO'; actor: Side; hpBefore: number; hpAfter: number }
  | { type: 'selfDamaged'; actor: Side; amount: number; hpBefore: number; hpAfter: number }
  | { type: 'roundCleared'; round: number }
  | { type: 'gameOver'; round: number };

export function applyDamage(hp: number, amount: number): number {
  return Math.max(0, hp - amount);
}

export function applyHeal(hp: number, amount: number, maxHp: number): number {
  return Math.min(maxHp, hp + amount);
}

const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

function makeCombatant(id: CharacterId): Combatant {
  const maxHp = CHARACTERS[id].maxHp;
  return { id, hp: maxHp, maxHp };
}

/** Uniform pick among all three characters (the player's own kind is allowed). */
function pickEnemy(rng: Rng): CharacterId {
  return CHARACTER_IDS[Math.min(CHARACTER_IDS.length - 1, Math.floor(rng.next() * CHARACTER_IDS.length))];
}

/**
 * Turn, round and end-of-game rules for one run. Pure logic: all randomness comes from the injected Rng,
 * and every method returns the events it caused instead of animating anything.
 */
export class Battle {
  private round = 1;
  private phase: BattlePhase = 'playerTurn';
  private player: Combatant;
  private enemy: Combatant;

  constructor(
    playerCharacter: CharacterId,
    private readonly rng: Rng,
  ) {
    this.player = makeCombatant(playerCharacter);
    this.enemy = makeCombatant(pickEnemy(rng));
  }

  /** A copy of the current state; safe to keep. */
  get state(): BattleState {
    return {
      round: this.round,
      phase: this.phase,
      player: { ...this.player },
      enemy: { ...this.enemy },
    };
  }

  /** Start over at ROUND 1 with full HP (used for restart). The player may pick a different character. */
  reset(playerCharacter: CharacterId = this.player.id): void {
    this.round = 1;
    this.phase = 'playerTurn';
    this.player = makeCombatant(playerCharacter);
    this.enemy = makeCombatant(pickEnemy(this.rng));
  }

  /** The player chooses attack or heal; the dice are rolled and the result applied. */
  playerAction(action: Action): BattleEvent[] {
    if (this.phase !== 'playerTurn') throw new Error(`playerAction is not allowed in phase ${this.phase}`);
    const events = this.act('player', action);
    if (this.phase === 'playerTurn') this.phase = 'enemyTurn';
    return events;
  }

  /** The AI picks attack or heal at random, rolls, and the result is applied. */
  enemyAction(): BattleEvent[] {
    if (this.phase !== 'enemyTurn') throw new Error(`enemyAction is not allowed in phase ${this.phase}`);
    const action: Action = this.rng.next() < 0.5 ? 'attack' : 'heal';
    const events = this.act('enemy', action);
    if (this.phase === 'enemyTurn') this.phase = 'playerTurn';
    return events;
  }

  /** After a cleared round: ROUND + 1, the player recovers half their max HP (rounded down), and a new enemy appears. */
  startNextRound(): BattleEvent[] {
    if (this.phase !== 'roundCleared') throw new Error(`startNextRound is not allowed in phase ${this.phase}`);
    this.round += 1;
    this.enemy = makeCombatant(pickEnemy(this.rng));
    this.phase = 'playerTurn';

    const amount = Math.floor(this.player.maxHp * ROUND_CLEAR_HEAL_RATIO);
    const hpBefore = this.player.hp;
    this.player.hp = applyHeal(hpBefore, amount, this.player.maxHp);
    return [
      { type: 'roundStarted', round: this.round, enemy: this.enemy.id },
      { type: 'healed', target: 'player', amount, hpBefore, hpAfter: this.player.hp, source: 'roundClear' },
    ];
  }

  private combatant(side: Side): Combatant {
    return side === 'player' ? this.player : this.enemy;
  }

  private act(actor: Side, action: Action): BattleEvent[] {
    const self = this.combatant(actor);
    const outcome = action === 'attack' ? resolveAttack(self.id, this.rng) : resolveHeal(self.id, this.rng);
    const events: BattleEvent[] = [
      { type: 'turn', actor, action },
      { type: 'rolled', actor, outcome },
    ];

    if (outcome.kind === 'damage') {
      const target = other(actor);
      const victim = this.combatant(target);
      const hpBefore = victim.hp;
      victim.hp = applyDamage(hpBefore, outcome.amount);
      events.push({ type: 'damaged', target, amount: outcome.amount, hpBefore, hpAfter: victim.hp });
    } else if (outcome.kind === 'heal') {
      const hpBefore = self.hp;
      self.hp = applyHeal(hpBefore, outcome.amount, self.maxHp);
      events.push({ type: 'healed', target: actor, amount: outcome.amount, hpBefore, hpAfter: self.hp, source: 'action' });
    } else if (outcome.kind === 'selfDamage') {
      const hpBefore = self.hp;
      self.hp = applyDamage(hpBefore, outcome.amount);
      events.push({ type: 'selfDamaged', actor, amount: outcome.amount, hpBefore, hpAfter: self.hp });
    } else {
      const hpBefore = self.hp;
      self.hp = 0;
      events.push({ type: 'selfKO', actor, hpBefore, hpAfter: 0 });
    }

    if (this.player.hp <= 0) {
      this.phase = 'gameOver';
      events.push({ type: 'gameOver', round: this.round });
    } else if (this.enemy.hp <= 0) {
      this.phase = 'roundCleared';
      events.push({ type: 'roundCleared', round: this.round });
    }
    return events;
  }
}
