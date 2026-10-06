import { describe, expect, it } from 'vitest';
import { wrapLines } from './text';

// every character is 10 px wide
const measure = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('keeps short text on one line', () => {
    expect(wrapLines(measure, 'hello world', 200)).toEqual(['hello world']);
  });

  it('breaks at spaces', () => {
    expect(wrapLines(measure, 'aaa bbb ccc', 70)).toEqual(['aaa bbb', 'ccc']);
  });

  it('breaks a word that is too long on its own between characters', () => {
    expect(wrapLines(measure, 'abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('honors explicit newlines', () => {
    expect(wrapLines(measure, 'ab\ncd', 100)).toEqual(['ab', 'cd']);
  });

  it('never produces a line wider than the limit', () => {
    const lines = wrapLines(measure, '같은 눈이 나오면 치명타입니다 그 외에는 합만큼 데미지를 줍니다', 120);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(120);
    expect(lines.join(' ').replace(/\s+/g, '')).toBe('같은눈이나오면치명타입니다그외에는합만큼데미지를줍니다');
  });
});
