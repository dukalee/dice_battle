import type { CharacterId } from '../game/characters';
import { body, click, crack, createBus, debris, ring, rumble, whoosh } from './impact';
import { noiseTick } from './sfx';

/**
 * The sound effects of a turn.
 * - `heal` / `criticalHeal`: the same for every character.
 * - `attack:<id>` / `criticalAttack:<id>`: each character has its own.
 * - `criticalSparkle`: the glittering run played when the dice show a Critical!.
 * - `bonus`: the rogue's "one more!" announcement.
 */
export type SoundCue = 'heal' | 'criticalHeal' | 'criticalSparkle' | 'bonus' | `attack:${CharacterId}` | `criticalAttack:${CharacterId}`;

/** A pitched tone that can glide from `from` to `to` Hz, with a fast attack and a decay to silence. */
function tone(ctx: AudioContext, when: number, type: OscillatorType, from: number, to: number, seconds: number, peak: number): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, when);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, when + seconds);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(peak, when + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
  osc.connect(env).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + seconds + 0.02);
}

/** A struck-bell tone: the pitch plus two quieter overtones that die away sooner. */
function bell(ctx: AudioContext, when: number, freq: number, seconds: number, peak: number): void {
  tone(ctx, when, 'sine', freq, freq, seconds, peak);
  tone(ctx, when, 'sine', freq * 2.01, freq * 2.01, seconds * 0.6, peak * 0.4);
  tone(ctx, when, 'sine', freq * 3.99, freq * 3.99, seconds * 0.35, peak * 0.2);
}

// C major notes used by the heal chimes, in Hz
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
// a high pentatonic scale for the sparkle run
const SPARKLE = [1568, 1760, 2093, 2349, 2637, 3136, 3520, 4186];

type Synth = (ctx: AudioContext, t: number, v: number) => void;

const SYNTHS: Record<SoundCue, Synth> = {
  // a soft three-note chime
  heal: (ctx, t, v) => {
    [C5, E5, G5].forEach((f, i) => bell(ctx, t + i * 0.09, f, 0.55, v * 0.24));
  },
  // a fuller, longer rising run of bells over a warm chord
  criticalHeal: (ctx, t, v) => {
    [C5, E5, G5, C6, E6, G6].forEach((f, i) => bell(ctx, t + i * 0.07, f, 0.8, v * 0.24));
    for (const f of [C5, E5, G5]) tone(ctx, t, 'triangle', f, f, 0.9, v * 0.07);
  },
  // "sha-ra-rang": a quick glittering run up the scale, then a faint shimmer
  criticalSparkle: (ctx, t, v) => {
    for (let i = 0; i < 12; i++) {
      const f = SPARKLE[Math.min(SPARKLE.length - 1, Math.floor((i / 12) * SPARKLE.length + (i % 2)))];
      bell(ctx, t + i * 0.045, f, 0.4, v * (0.17 - i * 0.005));
    }
    noiseTick(ctx, t + 0.1, 0.5, 7500, 0.8, v * 0.06);
  },
  // a "pop" as the dice jump up, then three bright bell notes climbing: the rogue gets one more throw
  bonus: (ctx, t, v) => {
    tone(ctx, t, 'sine', 420, 1100, 0.12, v * 0.3);
    [659.25, 880, 1318.5].forEach((f, i) => bell(ctx, t + 0.1 + i * 0.09, f, 0.5, v * 0.22));
    noiseTick(ctx, t + 0.1, 0.25, 6000, 0.8, v * 0.05);
  },
  // warrior: the hammer swings, then lands: a sharp snap, a punch that drops in pitch, sub-bass and a dull slap
  'attack:warrior': (ctx, t, v) => {
    const out = createBus(ctx, { reverbSeconds: 0.45, wet: 0.22, drive: 2.2 });
    whoosh(ctx, out, t, { seconds: 0.17, from: 700, to: 220, q: 0.7, peak: v * 0.3, peakAt: 0.85 });
    const hit = t + 0.17;
    click(ctx, out, hit, v * 0.5);
    body(ctx, out, hit, { from: 260, to: 90, tau: 0.04, seconds: 0.3, peak: v * 0.9 });
    body(ctx, out, hit, { from: 110, to: 55, tau: 0.1, seconds: 0.5, peak: v * 0.6 });
    body(ctx, out, hit, { from: 62, to: 36, tau: 0.12, seconds: 0.55, peak: v * 0.3 });
    crack(ctx, out, hit, { freq: 1100, q: 0.7, seconds: 0.1, peak: v * 0.55 });
    crack(ctx, out, hit, { freq: 200, q: 0.8, seconds: 0.14, peak: v * 0.5 });
    ring(ctx, out, hit, 420, 0.3, v * 0.04);
  },
  // rogue: a dagger cut in two strokes, a soft rising slice and a sharp falling one, with the sheen of steel
  'attack:rogue': (ctx, t, v) => {
    const out = createBus(ctx, { reverbSeconds: 0.18, wet: 0.08, drive: 1.2 });
    whoosh(ctx, out, t, { seconds: 0.1, from: 2600, to: 6500, q: 1.1, peak: v * 0.4, peakAt: 0.5 });
    whoosh(ctx, out, t, { seconds: 0.1, from: 900, to: 1800, q: 0.5, peak: v * 0.12, peakAt: 0.5 });
    const cut = t + 0.12;
    whoosh(ctx, out, cut, { seconds: 0.075, from: 8500, to: 3200, q: 1.4, peak: v * 0.6, peakAt: 0.35 });
    crack(ctx, out, cut + 0.03, { freq: 3000, q: 0.8, seconds: 0.035, peak: v * 0.25 });
    ring(ctx, out, cut, 3400, 0.14, v * 0.05);
  },
  // mage: a sucking flash, then a blast: crack, punch, sub-boom, a roaring tail and embers falling
  'attack:mage': (ctx, t, v) => {
    const out = createBus(ctx, { reverbSeconds: 0.9, wet: 0.38, drive: 2.4 });
    whoosh(ctx, out, t, { seconds: 0.1, from: 600, to: 3000, q: 0.8, peak: v * 0.18, peakAt: 0.9 });
    const blast = t + 0.1;
    click(ctx, out, blast, v * 0.6);
    body(ctx, out, blast, { from: 150, to: 55, tau: 0.09, seconds: 0.7, peak: v * 1 });
    body(ctx, out, blast, { from: 80, to: 40, tau: 0.2, seconds: 1, peak: v * 0.5 });
    rumble(ctx, out, blast, { seconds: 0.9, from: 4500, to: 250, peak: v * 0.8 });
    crack(ctx, out, blast, { freq: 1600, q: 0.5, seconds: 0.12, peak: v * 0.55 });
    debris(ctx, out, blast + 0.1, { count: 14, span: 0.6, peak: v * 0.14, freq: 3500 });
  },
  // warrior critical: a huge overhead smash, a ringing anvil and a smaller aftershock
  'criticalAttack:warrior': (ctx, t, v) => {
    const out = createBus(ctx, { reverbSeconds: 0.8, wet: 0.32, drive: 2.6 });
    whoosh(ctx, out, t, { seconds: 0.24, from: 900, to: 150, q: 0.7, peak: v * 0.4, peakAt: 0.88 });
    const hit = t + 0.24;
    click(ctx, out, hit, v * 0.7);
    body(ctx, out, hit, { from: 220, to: 70, tau: 0.06, seconds: 0.55, peak: v * 1 });
    body(ctx, out, hit, { from: 100, to: 45, tau: 0.15, seconds: 0.9, peak: v * 0.7 });
    body(ctx, out, hit, { from: 52, to: 28, tau: 0.15, seconds: 0.9, peak: v * 0.3 });
    crack(ctx, out, hit, { freq: 900, q: 0.6, seconds: 0.14, peak: v * 0.7 });
    crack(ctx, out, hit, { freq: 180, q: 0.8, seconds: 0.2, peak: v * 0.6 });
    rumble(ctx, out, hit, { seconds: 0.5, from: 1200, to: 120, peak: v * 0.5 });
    ring(ctx, out, hit, 300, 0.9, v * 0.09);
    debris(ctx, out, hit + 0.05, { count: 6, span: 0.35, peak: v * 0.15, freq: 4000 });
    const after = hit + 0.17;
    click(ctx, out, after, v * 0.25);
    body(ctx, out, after, { from: 170, to: 70, tau: 0.05, seconds: 0.3, peak: v * 0.45 });
    crack(ctx, out, after, { freq: 700, q: 0.7, seconds: 0.1, peak: v * 0.3 });
  },
  // rogue critical: three fast double-cuts, then a deep stab with a long ring of steel
  'criticalAttack:rogue': (ctx, t, v) => {
    const out = createBus(ctx, { reverbSeconds: 0.3, wet: 0.14, drive: 1.4 });
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.14;
      whoosh(ctx, out, at, { seconds: 0.06, from: 2800, to: 7000, q: 1.1, peak: v * (0.42 + i * 0.05), peakAt: 0.5 });
      whoosh(ctx, out, at + 0.065, { seconds: 0.05, from: 8500, to: 3500, q: 1.4, peak: v * (0.62 + i * 0.05), peakAt: 0.35 });
      ring(ctx, out, at + 0.065, 3200 + i * 300, 0.1, v * 0.04);
    }
    const stab = t + 0.46;
    click(ctx, out, stab, v * 0.5);
    crack(ctx, out, stab, { freq: 2200, q: 0.8, seconds: 0.05, peak: v * 0.5 });
    body(ctx, out, stab, { from: 220, to: 110, tau: 0.03, seconds: 0.18, peak: v * 0.3 });
    ring(ctx, out, stab, 4200, 0.6, v * 0.09);
  },
  // mage critical: a tearing rise, then a massive double blast with a long roar, rubble and a faint magic shimmer
  'criticalAttack:mage': (ctx, t, v) => {
    const out = createBus(ctx, { reverbSeconds: 1.5, wet: 0.45, drive: 2.6 });
    whoosh(ctx, out, t, { seconds: 0.38, from: 250, to: 5500, q: 0.8, peak: v * 0.35, peakAt: 0.95 });
    const blast = t + 0.38;
    click(ctx, out, blast, v * 0.9);
    body(ctx, out, blast, { from: 130, to: 50, tau: 0.1, seconds: 1, peak: v * 1 });
    body(ctx, out, blast, { from: 70, to: 34, tau: 0.25, seconds: 1.4, peak: v * 0.6 });
    rumble(ctx, out, blast, { seconds: 1.3, from: 5500, to: 200, peak: v * 0.95 });
    crack(ctx, out, blast, { freq: 1400, q: 0.5, seconds: 0.16, peak: v * 0.7 });
    const second = blast + 0.12;
    body(ctx, out, second, { from: 120, to: 50, tau: 0.08, seconds: 0.6, peak: v * 0.55 });
    rumble(ctx, out, second, { seconds: 0.6, from: 3500, to: 220, peak: v * 0.5 });
    debris(ctx, out, blast + 0.1, { count: 24, span: 1, peak: v * 0.15, freq: 3500 });
    ring(ctx, out, blast + 0.1, 2400, 0.7, v * 0.03);
  },
};

/**
 * Loudness trim per cue so the characters sit at a similar level, and no cue passes a peak of 1 even with the effects
 * slider at 100% (volume 1). Thin high cuts need a lift; the compressor in each cue already holds the big booms down.
 */
const TRIM: Partial<Record<SoundCue, number>> = {
  'attack:rogue': 1.5,
  'criticalAttack:rogue': 1.3,
  'criticalAttack:mage': 0.9,
};

/**
 * Cues that use a recorded sound instead of the synthesized one, as files under `public/` (relative to the site root).
 * The synthesized version is still played until the file has loaded, or if it fails to load.
 */
export const CUE_SAMPLES: Partial<Record<SoundCue, string>> = {
  'attack:warrior': 'audio/sfx/warrior-attack.mp3',
  'criticalAttack:warrior': 'audio/sfx/warrior-critical-attack.mp3',
  heal: 'audio/sfx/heal.mp3',
  criticalHeal: 'audio/sfx/critical-heal.mp3',
  'attack:rogue': 'audio/sfx/rogue-attack.mp3',
  'criticalAttack:rogue': 'audio/sfx/rogue-critical-attack.mp3',
  'attack:mage': 'audio/sfx/mage-attack.mp3',
  'criticalAttack:mage': 'audio/sfx/mage-critical-attack.mp3',
};

/**
 * Loudness of each recorded sound. The rogue's slash, the warrior's crashes and the mage's two spells are mastered hot
 * (they peak near full scale), the heal chime is a bit quiet, and the critical heal swell is very quiet (it peaks at
 * 0.28), so each needs its own trim.
 */
const SAMPLE_TRIM: Partial<Record<SoundCue, number>> = {
  'attack:warrior': 0.8,
  'criticalAttack:warrior': 0.85,
  heal: 1.1,
  criticalHeal: 3,
  'attack:rogue': 0.7,
  'criticalAttack:rogue': 1.4,
  'attack:mage': 0.85,
  'criticalAttack:mage': 0.85,
};

/**
 * Seconds to wait before a recording starts. The cues are triggered when the attacker strikes its pose, and the blow
 * lands 350 ms later (ACTOR_POSE_MS in gameScene.ts). A recording whose loudest moment is the impact itself (the sword
 * clash peaks 74 ms in, the warrior's crashes 57 ms and 50 ms, the mage's critical spell is at full strength 50 ms in) is
 * held back so that moment lines up with the hit on screen. Recordings that build up to the blow (the mage's spell cast peaks 331 ms in) need
 * no delay.
 */
const SAMPLE_DELAY: Partial<Record<SoundCue, number>> = {
  'attack:warrior': 0.29,
  'criticalAttack:warrior': 0.29,
  'criticalAttack:rogue': 0.27,
  'criticalAttack:mage': 0.3,
};

/** Play a decoded recording of `cue` now at `volume` (0..1). */
export function playSampleCue(ctx: AudioContext, volume: number, cue: SoundCue, buffer: AudioBuffer): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume * (SAMPLE_TRIM[cue] ?? 1);
  src.connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime + (SAMPLE_DELAY[cue] ?? 0));
}

/** Play `cue` now at `volume` (0..1). */
export function playCueSound(ctx: AudioContext, volume: number, cue: SoundCue): void {
  SYNTHS[cue](ctx, ctx.currentTime, volume * (TRIM[cue] ?? 1));
}
