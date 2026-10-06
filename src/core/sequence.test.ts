import { describe, expect, it } from 'vitest';
import { Sequencer } from './sequence';

describe('Sequencer', () => {
  it('runs steps in order, each for its own duration', () => {
    const log: string[] = [];
    const seq = new Sequencer();
    seq.run([
      { ms: 100, start: () => log.push('a:start'), end: () => log.push('a:end') },
      { ms: 200, start: () => log.push('b:start'), end: () => log.push('b:end') },
    ]);
    expect(seq.busy).toBe(true);
    seq.update(50);
    expect(log).toEqual(['a:start']);
    seq.update(50);
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
    seq.update(199);
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
    seq.update(1);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    expect(seq.busy).toBe(false);
  });

  it('carries leftover time into the next step', () => {
    const log: string[] = [];
    const seq = new Sequencer();
    seq.run([
      { ms: 100, end: () => log.push('a') },
      { ms: 100, end: () => log.push('b') },
      { ms: 100, end: () => log.push('c') },
    ]);
    seq.update(250);
    expect(log).toEqual(['a', 'b']);
    seq.update(50);
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('runs zero-length steps right away, in order', () => {
    const log: string[] = [];
    const seq = new Sequencer();
    seq.run([{ ms: 0, end: () => log.push('x') }, { ms: 0, end: () => log.push('y') }]);
    seq.update(1);
    expect(log).toEqual(['x', 'y']);
    expect(seq.busy).toBe(false);
  });

  it('does nothing while paused (dt = 0), even for zero-length steps', () => {
    const log: string[] = [];
    const seq = new Sequencer();
    seq.run([{ ms: 100, start: () => log.push('start'), end: () => log.push('end') }]);
    seq.update(40);
    for (let i = 0; i < 100; i++) seq.update(0);
    expect(log).toEqual(['start']);
    expect(seq.busy).toBe(true);
    seq.update(60);
    expect(log).toEqual(['start', 'end']);
  });

  it('lets a callback add more steps', () => {
    const log: string[] = [];
    const seq = new Sequencer();
    seq.run([
      {
        ms: 10,
        end: () => {
          log.push('first');
          seq.run([{ ms: 10, end: () => log.push('added') }]);
        },
      },
    ]);
    seq.update(10);
    expect(log).toEqual(['first']);
    expect(seq.busy).toBe(true);
    seq.update(10);
    expect(log).toEqual(['first', 'added']);
  });

  it('clear drops everything that is left', () => {
    const log: string[] = [];
    const seq = new Sequencer();
    seq.run([{ ms: 100, end: () => log.push('a') }, { ms: 100, end: () => log.push('b') }]);
    seq.update(50);
    seq.clear();
    seq.update(500);
    expect(log).toEqual([]);
    expect(seq.busy).toBe(false);
  });
});
