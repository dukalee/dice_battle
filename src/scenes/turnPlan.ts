import type { BattleEvent, Side } from '../game/battle';
import type { Action, Outcome } from '../game/rules';
import type { PoseName } from '../render/sprites';

export interface Banner {
  /** The big word. "FAIL!" and "Critical!" never appear together. */
  text: 'Critical!' | 'FAIL!';
  /** The rule that fired, in Korean (from the rule engine). */
  detail: string;
  tone: 'critical' | 'fail';
}

/** What a presented turn needs to show, worked out from the events one action produced. */
export interface TurnPlan {
  actor: Side;
  action: Action;
  outcome: Outcome;
  events: BattleEvent[];
  /** Pose of the acting character while the result plays. */
  actorPose: PoseName;
  /** The character that gets hurt (shows the `hit` pose), if the action was a damaging attack. */
  victim: Side | null;
  /** Big "Critical!" / "FAIL!" word, or null for an ordinary result. */
  banner: Banner | null;
  /** The character that dropped to 0 HP in this turn, if any. */
  defeated: Side | null;
  ending: 'none' | 'roundCleared' | 'gameOver';
}

export function poseFor(action: Action, outcome: Outcome): PoseName {
  if (outcome.fail) return 'fail';
  if (action === 'attack') return outcome.critical ? 'critical_attack' : 'attack';
  return outcome.critical ? 'critical_heal' : 'heal';
}

export function bannerFor(outcome: Outcome): Banner | null {
  if (outcome.fail) return { text: 'FAIL!', detail: outcome.description, tone: 'fail' };
  if (outcome.critical) return { text: 'Critical!', detail: outcome.description, tone: 'critical' };
  return null;
}

/** Turn the events of one `playerAction()` / `enemyAction()` call into a presentation plan. */
export function describeTurn(events: BattleEvent[]): TurnPlan {
  const turn = events.find((e) => e.type === 'turn');
  const rolled = events.find((e) => e.type === 'rolled');
  if (turn?.type !== 'turn' || rolled?.type !== 'rolled') throw new Error('not a turn: missing turn/rolled events');

  let victim: Side | null = null;
  let defeated: Side | null = null;
  let ending: TurnPlan['ending'] = 'none';
  for (const e of events) {
    if (e.type === 'damaged') {
      victim = e.target;
      if (e.hpAfter === 0) defeated = e.target;
    } else if (e.type === 'selfKO') {
      defeated = e.actor;
    } else if (e.type === 'selfDamaged') {
      if (e.hpAfter === 0) defeated = e.actor;
    } else if (e.type === 'roundCleared') {
      ending = 'roundCleared';
    } else if (e.type === 'gameOver') {
      ending = 'gameOver';
    }
  }

  return {
    actor: turn.actor,
    action: turn.action,
    outcome: rolled.outcome,
    events,
    actorPose: poseFor(turn.action, rolled.outcome),
    victim,
    banner: bannerFor(rolled.outcome),
    defeated,
    ending,
  };
}
