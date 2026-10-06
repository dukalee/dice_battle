import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants';
import { computeViewport, screenToLogical } from './viewport';

describe('computeViewport', () => {
  it('uses the whole window when it is already 16:9', () => {
    expect(computeViewport(1920, 1080)).toEqual({ scale: 1.5, offsetX: 0, offsetY: 0, width: 1920, height: 1080 });
  });

  it('letterboxes left and right in a wide window', () => {
    const vp = computeViewport(2000, 720);
    expect(vp.scale).toBe(1);
    expect(vp.offsetX).toBe(360);
    expect(vp.offsetY).toBe(0);
  });

  it('letterboxes top and bottom in a tall window', () => {
    const vp = computeViewport(1280, 1000);
    expect(vp.scale).toBe(1);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(140);
  });

  it('always keeps a 16:9 canvas that fits inside the window', () => {
    const sizes: Array<[number, number]> = [[800, 600], [1024, 768], [2560, 1080], [500, 1400], [1366, 768], [333, 777]];
    for (const [w, h] of sizes) {
      const vp = computeViewport(w, h);
      expect(vp.width / vp.height).toBeCloseTo(LOGICAL_WIDTH / LOGICAL_HEIGHT, 10);
      expect(vp.width).toBeLessThanOrEqual(w + 1e-9);
      expect(vp.height).toBeLessThanOrEqual(h + 1e-9);
      expect(vp.offsetX).toBeGreaterThanOrEqual(0);
      expect(vp.offsetY).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not produce negative sizes for an empty window', () => {
    const vp = computeViewport(0, 0);
    expect(vp.scale).toBe(0);
    expect(vp.width).toBe(0);
    expect(vp.height).toBe(0);
  });
});

describe('screenToLogical', () => {
  it('maps the canvas center to the logical center, accounting for letterbox and scale', () => {
    const vp = computeViewport(2000, 720);
    expect(screenToLogical(360 + 640, 360, vp)).toEqual({ x: 640, y: 360 });
  });

  it('maps the canvas corners to logical corners when scaled', () => {
    const vp = computeViewport(1920, 1200); // scale 1.5, offsetY 60
    expect(screenToLogical(0, 60, vp)).toEqual({ x: 0, y: 0 });
    expect(screenToLogical(1920, 60 + 1080, vp)).toEqual({ x: LOGICAL_WIDTH, y: LOGICAL_HEIGHT });
  });

  it('reports points in the letterbox as outside the logical screen', () => {
    const vp = computeViewport(2000, 720);
    expect(screenToLogical(10, 100, vp).x).toBeLessThan(0);
  });

  it('is safe for a zero-sized window', () => {
    expect(screenToLogical(5, 5, computeViewport(0, 0))).toEqual({ x: 0, y: 0 });
  });
});
