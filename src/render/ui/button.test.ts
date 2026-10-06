import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

const rect = { x: 100, y: 100, w: 200, h: 80 };

describe('Button', () => {
  it('clicks when pressed and released inside', () => {
    const onClick = vi.fn();
    const b = new Button(rect, 'OK', onClick);
    expect(b.pointerDown(150, 120)).toBe(true);
    expect(b.pressed).toBe(true);
    b.pointerUp(160, 130);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(b.pressed).toBe(false);
  });

  it('does not click when pressed outside', () => {
    const onClick = vi.fn();
    const b = new Button(rect, 'OK', onClick);
    expect(b.pointerDown(10, 10)).toBe(false);
    b.pointerUp(150, 120);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not click when released outside after a press inside', () => {
    const onClick = vi.fn();
    const b = new Button(rect, 'OK', onClick);
    b.pointerDown(150, 120);
    b.pointerUp(500, 500);
    expect(onClick).not.toHaveBeenCalled();
    expect(b.pressed).toBe(false);
  });

  it('ignores everything while disabled', () => {
    const onClick = vi.fn();
    const b = new Button(rect, 'OK', onClick);
    b.enabled = false;
    expect(b.pointerDown(150, 120)).toBe(false);
    b.pointerMove(150, 120);
    expect(b.hover).toBe(false);
    b.pointerUp(150, 120);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('tracks hover from pointer moves, including the edges', () => {
    const b = new Button(rect, 'OK', () => {});
    b.pointerMove(150, 120);
    expect(b.hover).toBe(true);
    b.pointerMove(100, 100);
    expect(b.hover).toBe(true);
    b.pointerMove(99, 100);
    expect(b.hover).toBe(false);
  });

  it('cancel clears the pressed state without clicking', () => {
    const onClick = vi.fn();
    const b = new Button(rect, 'OK', onClick);
    b.pointerDown(150, 120);
    b.cancel();
    b.pointerUp(150, 120);
    expect(onClick).not.toHaveBeenCalled();
  });
});
