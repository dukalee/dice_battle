import { describe, expect, it, vi } from 'vitest';
import { CUE_SAMPLES, playCueSound, playSampleCue, type SoundCue } from './cues';

/** Just enough of an AudioContext to see which nodes a cue creates and that nothing it needs is missing. */
function fakeContext() {
  const created: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = (kind: string) => {
    created.push(kind);
    const n: Record<string, unknown> = {
      connect: (dest: unknown) => dest,
      start: vi.fn(),
      stop: vi.fn(),
      frequency: param(),
      gain: param(),
      Q: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    };
    return n;
  };
  const ctx = {
    currentTime: 1,
    sampleRate: 8000,
    destination: {},
    createOscillator: () => node('oscillator'),
    createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('noise'),
    createWaveShaper: () => node('shaper'),
    createDynamicsCompressor: () => node('compressor'),
    createConvolver: () => node('convolver'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { ctx: ctx as unknown as AudioContext, created };
}

const CUES: SoundCue[] = [
  'heal',
  'criticalHeal',
  'criticalSparkle',
  'bonus',
  'attack:warrior',
  'attack:rogue',
  'attack:mage',
  'criticalAttack:warrior',
  'criticalAttack:rogue',
  'criticalAttack:mage',
];

describe('playCueSound', () => {
  it.each(CUES)('plays %s without errors and makes some sound', (cue) => {
    const { ctx, created } = fakeContext();
    expect(() => playCueSound(ctx, 0.5, cue)).not.toThrow();
    expect(created.length).toBeGreaterThan(2);
  });

  it('builds a different sound for each character attack, but one sound for heals', () => {
    const shape = (cue: SoundCue) => {
      const { ctx, created } = fakeContext();
      playCueSound(ctx, 0.5, cue);
      return created.join(',');
    };
    const attacks = ['attack:warrior', 'attack:rogue', 'attack:mage'].map((c) => shape(c as SoundCue));
    expect(new Set(attacks).size).toBe(3);
    const crits = ['criticalAttack:warrior', 'criticalAttack:rogue', 'criticalAttack:mage'].map((c) => shape(c as SoundCue));
    expect(new Set(crits).size).toBe(3);
    expect(shape('heal')).toBe(shape('heal'));
  });
});

/** The audio files that exist under public/ (only the names are needed, so nothing is loaded). */
const PUBLIC_AUDIO = Object.keys(import.meta.glob('../../public/audio/**/*', { query: '?url' }));

describe('recorded sound effects', () => {
  it('every recorded cue points at a file that exists under public/', () => {
    const entries = Object.entries(CUE_SAMPLES);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, path] of entries) expect(PUBLIC_AUDIO, path).toContain(`../../public/${path}`);
  });

  it('the heals and every character attack are recordings; only the sparkle and the bonus chime are still synthesized', () => {
    expect(CUE_SAMPLES['attack:warrior']).toBe('audio/sfx/warrior-attack.mp3');
    expect(CUE_SAMPLES['criticalAttack:warrior']).toBe('audio/sfx/warrior-critical-attack.mp3');
    expect(CUE_SAMPLES.heal).toBe('audio/sfx/heal.mp3');
    expect(CUE_SAMPLES.criticalHeal).toBe('audio/sfx/critical-heal.mp3');
    expect(CUE_SAMPLES['attack:rogue']).toBe('audio/sfx/rogue-attack.mp3');
    expect(CUE_SAMPLES['criticalAttack:rogue']).toBe('audio/sfx/rogue-critical-attack.mp3');
    expect(CUE_SAMPLES['attack:mage']).toBe('audio/sfx/mage-attack.mp3');
    expect(CUE_SAMPLES['criticalAttack:mage']).toBe('audio/sfx/mage-critical-attack.mp3');
    for (const cue of ['criticalSparkle', 'bonus'] as const) {
      expect(CUE_SAMPLES[cue], cue).toBeUndefined();
    }
  });

  it('plays the recording once through a gain scaled by the volume, never above full scale', () => {
    const connected: unknown[] = [];
    const started: number[] = [];
    const gain = { gain: { value: 0 }, connect: (d: unknown) => d };
    const src = {
      buffer: null as unknown,
      connect: (n: unknown) => {
        connected.push(n);
        return n;
      },
      start: (when: number) => started.push(when),
    };
    const ctx = { currentTime: 2, destination: {}, createBufferSource: () => src, createGain: () => gain } as unknown as AudioContext;
    const buffer = {} as AudioBuffer;
    playSampleCue(ctx, 1, 'attack:rogue', buffer);
    expect(src.buffer).toBe(buffer);
    expect(connected).toEqual([gain]);
    expect(started).toEqual([2]);
    expect(gain.gain.value).toBeGreaterThan(0);
    expect(gain.gain.value).toBeLessThan(1);
    playSampleCue(ctx, 0.5, 'attack:rogue', buffer);
    expect(gain.gain.value).toBeCloseTo(0.5 * 0.7);
  });

  it('holds the sword clash, the crashes and the critical spell back so their loudest moments land with the hit on screen, but starts the others at once', () => {
    const started: number[] = [];
    const gain = { gain: { value: 0 }, connect: (d: unknown) => d };
    const src = { buffer: null as unknown, connect: (n: unknown) => n, start: (when: number) => started.push(when) };
    const ctx = { currentTime: 5, destination: {}, createBufferSource: () => src, createGain: () => gain } as unknown as AudioContext;
    playSampleCue(ctx, 1, 'criticalAttack:rogue', {} as AudioBuffer);
    playSampleCue(ctx, 1, 'heal', {} as AudioBuffer);
    playSampleCue(ctx, 1, 'attack:mage', {} as AudioBuffer);
    playSampleCue(ctx, 1, 'criticalAttack:mage', {} as AudioBuffer);
    playSampleCue(ctx, 1, 'attack:warrior', {} as AudioBuffer);
    expect(started[0]).toBeGreaterThan(5.2);
    expect(started[0]).toBeLessThan(5.35);
    expect(started[1]).toBe(5);
    expect(started[2]).toBe(5); // the spell cast builds up to the blow by itself, so it starts at once
    expect(started[3]).toBeGreaterThan(5.25); // the critical spell hits at once, so it waits longer
    expect(started[3]).toBeLessThan(5.4);
    expect(started[4]).toBeGreaterThan(5.25); // the car crash is loudest right away too
    expect(started[4]).toBeLessThan(5.35);
    playSampleCue(ctx, 1, 'criticalAttack:warrior', {} as AudioBuffer);
    expect(started[5]).toBeGreaterThan(5.25); // and so is the critical crash
    expect(started[5]).toBeLessThan(5.35);
  });
});
