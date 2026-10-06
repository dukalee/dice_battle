import { CHARACTERS } from './characters';
import type { BattleEvent } from './battle';

/**
 * What a log line is about, which decides its color: damage is red, healing green, the mage's own mishaps purple,
 * round clears gold, and everything else (round start, the AI's choice) a calm blue.
 */
export type LogKind = 'damage' | 'heal' | 'fail' | 'clear' | 'info';

export interface LogLine {
  text: string;
  kind: LogKind;
}

/** The log kind of an event, or null when it has no line. */
export function logKindOf(event: BattleEvent): LogKind | null {
  switch (event.type) {
    case 'damaged':
      return 'damage';
    case 'healed':
      if (event.source === 'roundClear') return 'clear';
      return event.hpAfter - event.hpBefore === 0 ? 'info' : 'heal';
    case 'selfKO':
    case 'selfDamaged':
    case 'gameOver':
      return 'fail';
    case 'roundCleared':
      return 'clear';
    case 'roundStarted':
      return 'info';
    case 'turn':
    case 'rolled':
      return null;
  }
}

/** The log line (text and color kind) for an event, or null when it needs none. */
export function formatEventLine(event: BattleEvent): LogLine | null {
  const text = formatEvent(event);
  const kind = logKindOf(event);
  return text !== null && kind !== null ? { text, kind } : null;
}

/**
 * Korean log line for a battle event, or null when the event needs no line of its own.
 * "유저" is the player and "상대" the AI.
 */
export function formatEvent(event: BattleEvent): string | null {
  switch (event.type) {
    case 'roundStarted':
      return `ROUND ${event.round} 시작! 상대는 ${CHARACTERS[event.enemy].name}`;
    case 'damaged':
      return event.target === 'enemy'
        ? `유저가 상대에게 ${event.amount} 데미지를 주었다!`
        : `상대가 유저에게 ${event.amount} 데미지를 주었다!`;
    case 'healed': {
      const who = event.target === 'player' ? '유저' : '상대';
      const gained = event.hpAfter - event.hpBefore;
      if (event.source === 'roundClear') {
        return gained === 0 ? 'ROUND 클리어! HP가 이미 가득 차 있어 회복하지 않았다' : `ROUND 클리어 보너스! ${who}의 HP가 ${gained} 회복되었다`;
      }
      if (gained === 0) return `${who}의 HP가 가득 차 있어 회복되지 않았다`;
      return `${who}가 HP를 ${gained} 회복했다!`;
    }
    case 'selfKO':
      return `${event.actor === 'player' ? '유저' : '상대'}의 마법이 폭주해 자신의 HP가 0이 되었다!`;
    case 'selfDamaged':
      return `${event.actor === 'player' ? '유저' : '상대'}의 마법이 역류해 자신이 ${event.amount} 데미지를 입었다!`;
    case 'roundCleared':
      return `ROUND ${event.round} 클리어!`;
    case 'gameOver':
      return 'GAME OVER';
    case 'turn':
    case 'rolled':
      return null;
  }
}
