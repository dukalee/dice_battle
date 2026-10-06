import { describe, expect, it } from 'vitest';
import { GameLoop } from './loop';

function makeLoop(options: { stepMs?: number; maxFrameMs?: number } = {}) {
  const updates: number[] = [];
  const renders: number[] = [];
  const loop = new GameLoop(
    { update: (dt) => updates.push(dt), render: (alpha) => renders.push(alpha) },
    { stepMs: 10, ...options },
  );
  return { loop, updates, renders };
}

describe('GameLoop', () => {
  it('calls update once per fixed step regardless of frame length', () => {
    const { loop, updates, renders } = makeLoop();
    loop.frame(0);
    loop.frame(35);
    expect(updates).toEqual([10, 10, 10]);
    expect(renders).toHaveLength(2);
  });

  it('passes the leftover fraction of a step to render as alpha', () => {
    const { loop, renders } = makeLoop();
    loop.frame(0);
    loop.frame(35);
    expect(renders[1]).toBeCloseTo(0.5, 10);
  });

  it('carries the remainder over to the next frame', () => {
    const { loop, updates } = makeLoop();
    loop.frame(0);
    loop.frame(15); // 1 update, 5 left
    loop.frame(30); // 5 + 15 = 20 -> 2 updates
    expect(updates).toHaveLength(3);
  });

  it('calls update at a steady interval over many frames', () => {
    const { loop, updates } = makeLoop();
    for (let t = 0; t <= 1000; t += 16) loop.frame(t);
    // 992 ms elapsed -> 99 steps of 10 ms
    expect(updates).toHaveLength(99);
    expect(new Set(updates)).toEqual(new Set([10]));
  });

  it('clamps very long frames so the loop cannot spiral', () => {
    const { loop, updates } = makeLoop({ maxFrameMs: 100 });
    loop.frame(0);
    loop.frame(10_000);
    expect(updates).toHaveLength(10);
  });

  it('keeps rendering but passes dt = 0 to update while paused', () => {
    const { loop, updates, renders } = makeLoop();
    loop.frame(0);
    loop.paused = true;
    loop.frame(30);
    expect(updates).toEqual([0, 0, 0]);
    expect(renders).toHaveLength(2);
    loop.paused = false;
    loop.frame(40);
    expect(updates.at(-1)).toBe(10);
  });

  it('start and stop drive frames through the injected scheduler', () => {
    const queue: Array<(t: number) => void> = [];
    const updates: number[] = [];
    const loop = new GameLoop(
      { update: (dt) => updates.push(dt), render: () => {} },
      { stepMs: 10, requestFrame: (cb) => queue.push(cb), cancelFrame: () => queue.splice(0) },
    );
    loop.start();
    queue.shift()!(0);
    queue.shift()!(20);
    expect(updates).toHaveLength(2);
    loop.stop();
    expect(queue).toHaveLength(0);
  });
});
