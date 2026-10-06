import { describe, expect, it } from 'vitest';
import { formatEvent, formatEventLine, logKindOf } from './messages';

describe('formatEvent', () => {
  it('reports damage from the player and from the AI', () => {
    expect(formatEvent({ type: 'damaged', target: 'enemy', amount: 16, hpBefore: 100, hpAfter: 84 })).toBe('유저가 상대에게 16 데미지를 주었다!');
    expect(formatEvent({ type: 'damaged', target: 'player', amount: 8, hpBefore: 100, hpAfter: 92 })).toBe('상대가 유저에게 8 데미지를 주었다!');
  });

  it('shows the raw damage even when it overkills', () => {
    expect(formatEvent({ type: 'damaged', target: 'enemy', amount: 100, hpBefore: 50, hpAfter: 0 })).toContain('100');
  });

  it('reports the HP actually gained, and a full-HP heal', () => {
    expect(formatEvent({ type: 'healed', target: 'player', amount: 50, hpBefore: 92, hpAfter: 100, source: 'action' })).toBe('유저가 HP를 8 회복했다!');
    expect(formatEvent({ type: 'healed', target: 'enemy', amount: 50, hpBefore: 100, hpAfter: 100, source: 'action' })).toBe('상대의 HP가 가득 차 있어 회복되지 않았다');
  });

  it('reports the round-clear bonus', () => {
    expect(formatEvent({ type: 'healed', target: 'player', amount: 37, hpBefore: 70, hpAfter: 75, source: 'roundClear' })).toBe('ROUND 클리어 보너스! 유저의 HP가 5 회복되었다');
    expect(formatEvent({ type: 'healed', target: 'player', amount: 37, hpBefore: 75, hpAfter: 75, source: 'roundClear' })).toBe('ROUND 클리어! HP가 이미 가득 차 있어 회복하지 않았다');
  });

  it('reports round and game events', () => {
    expect(formatEvent({ type: 'roundStarted', round: 2, enemy: 'mage' })).toBe('ROUND 2 시작! 상대는 마법사');
    expect(formatEvent({ type: 'roundCleared', round: 1 })).toBe('ROUND 1 클리어!');
    expect(formatEvent({ type: 'gameOver', round: 3 })).toBe('GAME OVER');
    expect(formatEvent({ type: 'selfKO', actor: 'enemy', hpBefore: 40, hpAfter: 0 })).toContain('상대');
  });

  it('reports a mage backfire', () => {
    expect(formatEvent({ type: 'selfDamaged', actor: 'player', amount: 25, hpBefore: 50, hpAfter: 25 })).toBe('유저의 마법이 역류해 자신이 25 데미지를 입었다!');
    expect(formatEvent({ type: 'selfDamaged', actor: 'enemy', amount: 25, hpBefore: 40, hpAfter: 15 })).toContain('상대');
  });

  it('has no line for turn and roll events', () => {
    expect(formatEvent({ type: 'turn', actor: 'player', action: 'attack' })).toBeNull();
  });
});

describe('log colors', () => {
  it('colors damage red, healing green, own mishaps purple, clears gold, the rest blue', () => {
    expect(logKindOf({ type: 'damaged', target: 'enemy', amount: 5, hpBefore: 10, hpAfter: 5 })).toBe('damage');
    expect(logKindOf({ type: 'damaged', target: 'player', amount: 5, hpBefore: 10, hpAfter: 5 })).toBe('damage');
    expect(logKindOf({ type: 'healed', target: 'player', amount: 8, hpBefore: 50, hpAfter: 58, source: 'action' })).toBe('heal');
    expect(logKindOf({ type: 'healed', target: 'enemy', amount: 8, hpBefore: 50, hpAfter: 58, source: 'action' })).toBe('heal');
    expect(logKindOf({ type: 'selfKO', actor: 'player', hpBefore: 10, hpAfter: 0 })).toBe('fail');
    expect(logKindOf({ type: 'selfDamaged', actor: 'enemy', amount: 25, hpBefore: 40, hpAfter: 15 })).toBe('fail');
    expect(logKindOf({ type: 'gameOver', round: 2 })).toBe('fail');
    expect(logKindOf({ type: 'roundCleared', round: 1 })).toBe('clear');
    expect(logKindOf({ type: 'healed', target: 'player', amount: 37, hpBefore: 27, hpAfter: 64, source: 'roundClear' })).toBe('clear');
    expect(logKindOf({ type: 'roundStarted', round: 2, enemy: 'mage' })).toBe('info');
  });

  it('a heal that changed nothing is plain info, not green', () => {
    expect(logKindOf({ type: 'healed', target: 'player', amount: 50, hpBefore: 100, hpAfter: 100, source: 'action' })).toBe('info');
  });

  it('has no kind for turn and roll events, and pairs text with kind otherwise', () => {
    expect(logKindOf({ type: 'turn', actor: 'player', action: 'attack' })).toBeNull();
    expect(formatEventLine({ type: 'turn', actor: 'player', action: 'attack' })).toBeNull();
    expect(formatEventLine({ type: 'damaged', target: 'enemy', amount: 16, hpBefore: 100, hpAfter: 84 })).toEqual({
      text: '유저가 상대에게 16 데미지를 주었다!',
      kind: 'damage',
    });
  });
});
