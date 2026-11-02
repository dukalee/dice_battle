/** Sound effects made from filtered noise and short tones, so no audio files are needed. */

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A short burst of band-passed noise: one "tick" of dice knocking together or hitting the floor. */
export function noiseTick(ctx: AudioContext, when: number, seconds: number, freq: number, q: number, peak: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(peak, when);
  env.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
  src.connect(filter).connect(env).connect(ctx.destination);
  src.start(when, Math.random() * 0.3, seconds + 0.02);
}

/** A dull falling "thump" that gives the knock some weight. */
export function thump(ctx: AudioContext, when: number, from: number, peak: number, length = 0.09): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(from * 0.45, when + length * 0.8);
  env.gain.setValueAtTime(peak, when);
  env.gain.exponentialRampToValueAtTime(0.0001, when + length);
  osc.connect(env).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + length + 0.01);
}

/** The dice rattling as they are thrown. A stronger throw rattles longer and louder. `power` is 0..1. */
export function playDiceThrow(ctx: AudioContext, volume: number, power: number): void {
  const t0 = ctx.currentTime;
  const ticks = 6 + Math.round(8 * power);
  const span = 0.16 + 0.24 * power;
  for (let i = 0; i < ticks; i++) {
    const when = t0 + (i / ticks) * span + Math.random() * 0.012;
    const freq = 1600 + Math.random() * 1800;
    noiseTick(ctx, when, 0.014 + Math.random() * 0.01, freq, 1.4, volume * (0.22 + Math.random() * 0.2) * (0.6 + 0.4 * power));
  }
}

/** One die hitting the floor. `strength` (0..1) is how hard; later bounces are softer. */
export function playDiceBounce(ctx: AudioContext, volume: number, strength: number): void {
  const t0 = ctx.currentTime;
  const detune = 0.9 + Math.random() * 0.2;
  noiseTick(ctx, t0, 0.04, 1900 * detune, 0.9, volume * 0.55 * strength);
  thump(ctx, t0, 230 * detune, volume * 0.4 * strength);
}

/** A sound that keeps going until stopped; `setPower` (0..1) follows how long the dice have been held. */
export interface ChargeSound {
  setPower(power: number): void;
  stop(): void;
}

/**
 * The dice buzzing in a closed hand while the player holds the tray: a low saw wave and a noise rattle,
 * both chopped by a fast tremolo. The longer the hold, the higher, faster and louder it gets.
 */
export function startDiceCharge(ctx: AudioContext, volume: number): ChargeSound {
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.setTargetAtTime(volume * 0.14, t, 0.03);
  out.connect(ctx.destination);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 20;

  const body = ctx.createOscillator();
  body.type = 'sawtooth';
  body.frequency.value = 70;
  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.value = 420;
  const bodyChop = ctx.createGain();
  bodyChop.gain.value = 0.5; // the tremolo swings this between 0 and 1
  const bodyDepth = ctx.createGain();
  bodyDepth.gain.value = 0.5;
  lfo.connect(bodyDepth).connect(bodyChop.gain);
  body.connect(bodyFilter).connect(bodyChop).connect(out);

  const rattle = ctx.createBufferSource();
  rattle.buffer = noiseBuffer(ctx);
  rattle.loop = true;
  const rattleFilter = ctx.createBiquadFilter();
  rattleFilter.type = 'bandpass';
  rattleFilter.frequency.value = 2200;
  rattleFilter.Q.value = 1.2;
  const rattleChop = ctx.createGain();
  rattleChop.gain.value = 0.2;
  const rattleDepth = ctx.createGain();
  rattleDepth.gain.value = 0.2;
  lfo.connect(rattleDepth).connect(rattleChop.gain);
  rattle.connect(rattleFilter).connect(rattleChop).connect(out);

  lfo.start(t);
  body.start(t);
  rattle.start(t);

  return {
    setPower(power) {
      const now = ctx.currentTime;
      body.frequency.setTargetAtTime(70 + 55 * power, now, 0.05);
      lfo.frequency.setTargetAtTime(20 + 22 * power, now, 0.05);
      out.gain.setTargetAtTime(volume * (0.12 + 0.16 * power), now, 0.05);
    },
    stop() {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(0, now, 0.02);
      for (const node of [lfo, body, rattle]) node.stop(now + 0.15);
    },
  };
}
