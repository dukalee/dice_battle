import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../game/characters';
import spriteData from '../data/sprites.json';
import { BASE_DISPLAY_SIZE, getPoseConfig, placement, posesOf, spriteUrl, type PoseName } from './sprites';

const REQUIRED: PoseName[] = ['idle', 'attack', 'critical_attack', 'heal', 'critical_heal', 'hit'];

// Only the keys (file paths) are used, so no image is actually loaded.
const originals = Object.keys(import.meta.glob('../../assets/characters/*/*.png'));
const webps = Object.keys(import.meta.glob('../../public/sprites/*.webp'));

describe('sprite configuration', () => {
  it('lists the required poses for every character, and fail only for the mage', () => {
    for (const id of CHARACTER_IDS) {
      const poses = posesOf(id);
      for (const pose of REQUIRED) expect(poses).toContain(pose);
      expect(poses.includes('fail')).toBe(id === 'mage');
      expect(poses).toHaveLength(id === 'mage' ? 7 : 6);
    }
  });

  it('uses valid values for every pose', () => {
    for (const id of CHARACTER_IDS) {
      for (const pose of posesOf(id)) {
        const cfg = getPoseConfig(id, pose);
        expect(cfg.scale).toBeGreaterThan(0.5);
        expect(cfg.scale).toBeLessThan(2.5);
        expect(cfg.anchor[0]).toBeGreaterThan(0);
        expect(cfg.anchor[0]).toBeLessThan(1);
        expect(cfg.anchor[1]).toBeGreaterThan(0);
        expect(cfg.anchor[1]).toBeLessThan(1);
        expect(['left', 'right']).toContain(cfg.facing);
      }
    }
  });

  it('records that all sprites face left except mage_attack', () => {
    for (const id of CHARACTER_IDS) {
      for (const pose of posesOf(id)) {
        const expected = id === 'mage' && pose === 'attack' ? 'right' : 'left';
        expect(getPoseConfig(id, pose).facing).toBe(expected);
      }
    }
  });
});

describe('sprite files', () => {
  it('has an original PNG for every configured pose (19 in total)', () => {
    let count = 0;
    for (const id of CHARACTER_IDS) {
      const folder = (spriteData.characters as Record<string, { folder: string }>)[id].folder;
      for (const pose of posesOf(id)) {
        expect(originals).toContain(`../../assets/characters/${folder}/${id}_${pose}.png`);
        count++;
      }
    }
    expect(count).toBe(19);
  });

  it('has a converted WebP for every configured pose', () => {
    for (const id of CHARACTER_IDS) {
      for (const pose of posesOf(id)) expect(webps).toContain(`../../public/sprites/${id}_${pose}.webp`);
    }
  });

  it('builds URLs under the public sprites folder', () => {
    expect(spriteUrl('/', 'mage', 'fail')).toBe('/sprites/mage_fail.webp');
  });
});

describe('placement', () => {
  const left = getPoseConfig('warrior', 'idle'); // faces left in the original

  it('does not flip a sprite that already faces the wanted direction', () => {
    expect(placement(left, 'left').flip).toBe(false);
  });

  it('flips a left-facing sprite to face right (the player side)', () => {
    expect(placement(left, 'right').flip).toBe(true);
  });

  it('treats mage_attack, which faces right, the other way around', () => {
    const cfg = getPoseConfig('mage', 'attack');
    expect(placement(cfg, 'right').flip).toBe(false);
    expect(placement(cfg, 'left').flip).toBe(true);
  });

  it('puts the anchor at the origin: flipping keeps the body in place', () => {
    const a = placement(left, 'left');
    const b = placement(left, 'right');
    expect(a.size).toBe(b.size);
    expect(a.dx).toBeCloseTo(-left.anchor[0] * a.size, 10);
    expect(a.dy).toBeCloseTo(-left.anchor[1] * a.size, 10);
    expect(b.dx).toBe(a.dx);
    expect(b.dy).toBe(a.dy);
  });

  it('scales with the pose scale and an extra multiplier', () => {
    const cfg = getPoseConfig('warrior', 'critical_attack');
    expect(placement(cfg, 'left').size).toBeCloseTo(BASE_DISPLAY_SIZE * cfg.scale, 10);
    expect(placement(cfg, 'left', 0.5).size).toBeCloseTo(BASE_DISPLAY_SIZE * cfg.scale * 0.5, 10);
  });

  it('throws for a pose a character does not have', () => {
    expect(() => getPoseConfig('warrior', 'fail')).toThrow();
  });
});
