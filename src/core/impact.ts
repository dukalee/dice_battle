import { noiseBuffer } from './sfx';

/**
 * Building blocks for realistic hits, slashes and explosions. A single oscillator sounds like a toy; a real impact is
 * several layers at once: a sharp transient, a body that drops in pitch, a sub-bass, a mid "crack", a metallic ring,
 * all pushed through saturation, a compressor and a little room reverb. Every helper takes `out`, the node to play into.
 */

// ---- the effects bus

export interface BusOptions {
  /** Length of the room tail in seconds. */
  reverbSeconds: number;
  /** How much of the tail is mixed in, 0..1. */
  wet: number;
  /** Saturation amount; 1 is nearly clean, 3 or more is heavily crunched. */
  drive: number;
}

const impulses = new WeakMap<AudioContext, Map<number, AudioBuffer>>();
const curves = new Map<number, Float32Array>();

/** A decaying noise burst: the sound of a small room. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  let byLength = impulses.get(ctx);
  if (!byLength) {
    byLength = new Map();
    impulses.set(ctx, byLength);
  }
  let buffer = byLength.get(seconds);
  if (!buffer) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.5);
    }
    byLength.set(seconds, buffer);
  }
  return buffer;
}

/** A soft-clipping curve: loud peaks flatten and gain harmonics, which makes a hit feel heavier. */
function saturationCurve(drive: number): Float32Array {
  let curve = curves.get(drive);
  if (!curve) {
    const size = 1024;
    curve = new Float32Array(size);
    const norm = Math.tanh(drive);
    for (let i = 0; i < size; i++) curve[i] = Math.tanh(drive * ((i / (size - 1)) * 2 - 1)) / norm;
    curves.set(drive, curve);
  }
  return curve;
}

/** The input of a chain: saturation, a compressor to glue the layers together, and a room tail, into the speakers. */
export function createBus(ctx: AudioContext, options: BusOptions): AudioNode {
  const input = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = saturationCurve(options.drive) as Float32Array<ArrayBuffer>;
  shaper.oversample = '2x';
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 5;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, options.reverbSeconds);
  const wet = ctx.createGain();
  wet.gain.value = options.wet;

  input.connect(shaper);
  shaper.connect(comp);
  input.connect(room);
  room.connect(wet);
  wet.connect(comp);
  comp.connect(ctx.destination);
  return input;
}

// ---- layers

function noiseSource(ctx: AudioContext, when: number, seconds: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(when, Math.random() * 0.2);
  src.stop(when + seconds + 0.05);
  return src;
}

/** A gain that jumps to `peak` after `attack` seconds and then dies away exponentially until `seconds`. */
function envelope(ctx: AudioContext, when: number, attack: number, peak: number, seconds: number): GainNode {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
  return env;
}

function filtered(ctx: AudioContext, type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  return filter;
}

/** The sharp snap at the instant of contact. */
export function click(ctx: AudioContext, out: AudioNode, when: number, peak: number): void {
  noiseSource(ctx, when, 0.02).connect(filtered(ctx, 'highpass', 1500, 0.7)).connect(envelope(ctx, when, 0.0005, peak, 0.014)).connect(out);
}

export interface BodyOptions {
  from: number;
  to: number;
  /** Time constant (s) of the pitch drop: small = a sharp "punch", large = a slow boom. */
  tau: number;
  seconds: number;
  peak: number;
}

/** The weight of a hit: a sine whose pitch falls quickly from `from` towards `to`. */
export function body(ctx: AudioContext, out: AudioNode, when: number, o: BodyOptions): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(o.from, when);
  osc.frequency.setTargetAtTime(o.to, when, o.tau);
  osc.connect(envelope(ctx, when, 0.002, o.peak, o.seconds)).connect(out);
  osc.start(when);
  osc.stop(when + o.seconds + 0.02);
}

export interface CrackOptions {
  freq: number;
  q: number;
  seconds: number;
  peak: number;
}

/** The mid-range "crack" or slap of a hit: band-passed noise that dies quickly. */
export function crack(ctx: AudioContext, out: AudioNode, when: number, o: CrackOptions): void {
  noiseSource(ctx, when, o.seconds).connect(filtered(ctx, 'bandpass', o.freq, o.q)).connect(envelope(ctx, when, 0.001, o.peak, o.seconds)).connect(out);
}

export interface WhooshOptions {
  seconds: number;
  from: number;
  to: number;
  q: number;
  peak: number;
  /** Where in the swing the air is loudest, 0..1 (a late peak = the blow is about to land). */
  peakAt: number;
}

/** Air rushing past a swung weapon: noise through a band-pass whose center glides, loudest near the end of the swing. */
export function whoosh(ctx: AudioContext, out: AudioNode, when: number, o: WhooshOptions): void {
  const filter = filtered(ctx, 'bandpass', o.from, o.q);
  filter.frequency.setValueAtTime(o.from, when);
  filter.frequency.exponentialRampToValueAtTime(o.to, when + o.seconds);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.peak), when + o.seconds * o.peakAt);
  env.gain.exponentialRampToValueAtTime(0.0001, when + o.seconds);
  noiseSource(ctx, when, o.seconds).connect(filter).connect(env).connect(out);
}

export interface RumbleOptions {
  seconds: number;
  from: number;
  to: number;
  peak: number;
}

/** The roar of a blast: low-passed noise whose cutoff closes from `from` to `to` as it fades. */
export function rumble(ctx: AudioContext, out: AudioNode, when: number, o: RumbleOptions): void {
  const filter = filtered(ctx, 'lowpass', o.from, 0.7);
  filter.frequency.setValueAtTime(o.from, when);
  filter.frequency.exponentialRampToValueAtTime(o.to, when + o.seconds);
  noiseSource(ctx, when, o.seconds).connect(filter).connect(envelope(ctx, when, 0.004, o.peak, o.seconds)).connect(out);
}

/** Inharmonic partials of a struck metal bar: ratio to the pitch, loudness, and how long each one rings. */
const METAL: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],
  [2.76, 0.6, 0.7],
  [5.4, 0.45, 0.5],
  [8.93, 0.3, 0.35],
  [13.34, 0.2, 0.25],
];

/** A metallic ring (a blade, an anvil, a hammer head) made of several decaying inharmonic partials. */
export function ring(ctx: AudioContext, out: AudioNode, when: number, freq: number, seconds: number, peak: number): void {
  for (const [ratio, amp, decay] of METAL) {
    const f = freq * ratio;
    if (f > ctx.sampleRate * 0.45) continue;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.connect(envelope(ctx, when, 0.001, peak * amp, seconds * decay)).connect(out);
    osc.start(when);
    osc.stop(when + seconds * decay + 0.02);
  }
}

export interface DebrisOptions {
  count: number;
  span: number;
  peak: number;
  freq: number;
}

/** Scattered tiny ticks, thinning out and fading: rubble and embers raining down after a big hit. */
export function debris(ctx: AudioContext, out: AudioNode, when: number, o: DebrisOptions): void {
  let seed = 7919;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < o.count; i++) {
    const age = Math.sqrt(next()); // later ticks are rarer
    const at = when + age * o.span;
    const fade = 1 - age * 0.7;
    const tick = noiseSource(ctx, at, 0.02);
    tick.connect(filtered(ctx, 'bandpass', o.freq * (0.7 + next() * 0.8), 1.2)).connect(envelope(ctx, at, 0.0008, o.peak * fade * (0.5 + next() * 0.5), 0.015 + next() * 0.015)).connect(out);
  }
}
