import { describe, expect, it } from 'vitest';
import { LOG_COLORS, LogBuffer, splitNumbers } from './logWindow';

describe('LogBuffer', () => {
  it('keeps messages in order and returns the most recent ones', () => {
    const log = new LogBuffer(10);
    ['a', 'b', 'c', 'd'].forEach((m) => log.push(m));
    expect(log.recent(3)).toEqual(['b', 'c', 'd']);
    expect(log.recent(10)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops the oldest lines once the limit is exceeded', () => {
    const log = new LogBuffer(3);
    ['a', 'b', 'c', 'd', 'e'].forEach((m) => log.push(m));
    expect(log.all).toEqual(['c', 'd', 'e']);
  });

  it('can be cleared', () => {
    const log = new LogBuffer();
    log.push('a');
    log.clear();
    expect(log.all).toEqual([]);
  });
});

describe('LogBuffer kinds', () => {
  it('remembers the kind of each line (info by default) while recent and all still return plain text', () => {
    const log = new LogBuffer();
    log.push('hit', 'damage');
    log.push('heal', 'heal');
    log.push('plain');
    expect(log.recent(3)).toEqual(['hit', 'heal', 'plain']);
    expect(log.all).toEqual(['hit', 'heal', 'plain']);
    expect(log.recentEntries(3).map((e) => e.kind)).toEqual(['damage', 'heal', 'info']);
    expect(log.recentEntries(2).map((e) => e.text)).toEqual(['heal', 'plain']);
  });

  it('drops the kind together with the line', () => {
    const log = new LogBuffer(2);
    log.push('a', 'damage');
    log.push('b', 'heal');
    log.push('c', 'fail');
    expect(log.recentEntries(5).map((e) => e.kind)).toEqual(['heal', 'fail']);
  });
});

describe('log colors', () => {
  it('gives damage a red accent and healing a green accent', () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [dr, dg, db] = rgb(LOG_COLORS.damage.accent);
    const [hr, hg, hb] = rgb(LOG_COLORS.heal.accent);
    expect(dr).toBeGreaterThan(dg + 80);
    expect(dr).toBeGreaterThan(db + 80);
    expect(hg).toBeGreaterThan(hr + 80);
    expect(hg).toBeGreaterThan(hb + 40);
  });

  it('has a distinct accent for every kind', () => {
    const accents = Object.values(LOG_COLORS).map((c) => c.accent);
    expect(new Set(accents).size).toBe(accents.length);
  });
});

describe('splitNumbers', () => {
  it('picks out each run of digits', () => {
    expect(splitNumbers('유저가 상대에게 16 데미지를 주었다!')).toEqual([
      { text: '유저가 상대에게 ', number: false },
      { text: '16', number: true },
      { text: ' 데미지를 주었다!', number: false },
    ]);
  });

  it('handles several numbers, none, and numbers at the ends', () => {
    expect(splitNumbers('ROUND 2 시작! 상대는 도적').filter((p) => p.number).map((p) => p.text)).toEqual(['2']);
    expect(splitNumbers('GAME OVER')).toEqual([{ text: 'GAME OVER', number: false }]);
    expect(splitNumbers('12 and 7').map((p) => p.text)).toEqual(['12', ' and ', '7']);
    expect(splitNumbers('')).toEqual([]);
  });

  it('keeps every character: joining the parts gives the original line', () => {
    for (const t of ['ROUND 클리어 보너스! 유저의 HP가 13 회복되었다', '상대가 HP를 5 회복했다!', '1, 1, 1... 0이 된다']) {
      expect(splitNumbers(t).map((p) => p.text).join('')).toBe(t);
    }
  });
});
