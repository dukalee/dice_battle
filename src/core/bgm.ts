import { CUE_SAMPLES, playCueSound, playSampleCue, type SoundCue } from './cues';
import { playDiceBounce, playDiceThrow, startDiceCharge as synthDiceCharge, type ChargeSound } from './sfx';

/** The music and the sound effects have their own volume and mute. */
export type AudioChannel = 'music' | 'sfx';

const DEFAULT_VOLUME: Record<AudioChannel, number> = { music: 0.25, sfx: 0.5 };
/** While the game is paused the music drops to this share of the chosen volume. */
const PAUSED_FACTOR = 0.4;
const STORAGE_KEY = 'dicebattle.audio.v2';

/** What the volume controls on screen need to read and change. */
export interface AudioSettings {
  /** 0..1, the level the player chose for this channel (unchanged by mute). */
  volume(channel: AudioChannel): number;
  isMuted(channel: AudioChannel): boolean;
  setVolume(channel: AudioChannel, volume: number): void;
  toggleMute(channel: AudioChannel): void;
}

/** Sound effects the game scenes can trigger. */
export interface SoundEffects {
  /** The dice leave the hand. `power` is 0..1. */
  playDiceThrow(power: number): void;
  /** One die hits the floor. `strength` is 0..1. */
  playDiceBounce(strength: number): void;
  /** The player starts holding the dice: a vibrating sound that goes on until `stopDiceCharge`. */
  startDiceCharge(): void;
  /** How long the dice have been held, 0..1; the vibration gets stronger. */
  setDiceChargePower(power: number): void;
  stopDiceCharge(): void;
  /** A turn sound: heal, attack (per character), critical, and so on. */
  playCue(cue: SoundCue): void;
}

/**
 * Looping background music through Web Audio (gapless, unlike an <audio loop>) plus all the sound effects.
 * Browsers block audio until the user interacts, so `armOnFirstGesture` waits for the first
 * click/tap/key press before creating the AudioContext and loading the file.
 * Each channel's volume and mute are remembered in localStorage when it is available.
 */
export class Bgm implements AudioSettings, SoundEffects {
  private readonly levels: Record<AudioChannel, number> = { ...DEFAULT_VOLUME };
  private readonly mutes: Record<AudioChannel, boolean> = { music: false, sfx: false };
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private ducked = false;
  private charge: ChargeSound | null = null;
  /** Recorded sound effects, once decoded (see `CUE_SAMPLES`). */
  private readonly samples = new Map<SoundCue, AudioBuffer>();

  /** `url` is the music file; `siteRoot` is where the recorded sound effects are served from (`import.meta.env.BASE_URL`). */
  constructor(
    private readonly url: string,
    private readonly siteRoot = '/',
  ) {
    this.load();
  }

  armOnFirstGesture(): void {
    const unlock = (): void => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.start().catch((err) => console.error('BGM failed to start', err));
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  // ---- settings

  volume(channel: AudioChannel): number {
    return this.levels[channel];
  }

  isMuted(channel: AudioChannel): boolean {
    return this.mutes[channel];
  }

  /** Raising the volume while muted turns that channel back on. */
  setVolume(channel: AudioChannel, volume: number): void {
    this.levels[channel] = Math.min(1, Math.max(0, volume));
    if (this.levels[channel] > 0) this.mutes[channel] = false;
    this.changed();
  }

  toggleMute(channel: AudioChannel): void {
    this.mutes[channel] = !this.mutes[channel];
    this.changed();
  }

  /** The M key: silence everything, or bring both channels back when nothing is audible. */
  toggleMuteAll(): void {
    const anyAudible = !this.mutes.music || !this.mutes.sfx;
    this.mutes.music = anyAudible;
    this.mutes.sfx = anyAudible;
    this.changed();
  }

  /** Quieter music while the game is paused. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyMusicVolume();
  }

  // ---- sound effects

  playDiceThrow(power: number): void {
    const ctx = this.audibleContext();
    if (ctx) playDiceThrow(ctx, this.levels.sfx, power);
  }

  playDiceBounce(strength: number): void {
    const ctx = this.audibleContext();
    if (ctx) playDiceBounce(ctx, this.levels.sfx, strength);
  }

  playCue(cue: SoundCue): void {
    const ctx = this.audibleContext();
    if (!ctx) return;
    const sample = this.samples.get(cue);
    if (sample) playSampleCue(ctx, this.levels.sfx, cue, sample);
    else playCueSound(ctx, this.levels.sfx, cue);
  }

  startDiceCharge(): void {
    this.stopDiceCharge();
    const ctx = this.audibleContext();
    if (ctx) this.charge = synthDiceCharge(ctx, this.levels.sfx);
  }

  setDiceChargePower(power: number): void {
    this.charge?.setPower(power);
  }

  stopDiceCharge(): void {
    this.charge?.stop();
    this.charge = null;
  }

  /** A quick two-note chirp (low note, then a jump up) for button clicks. Silent when muted or before the first user gesture. */
  playClick(): void {
    const ctx = this.audibleContext();
    if (!ctx) return;
    const peak = 0.2 * this.levels.sfx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square';
    // a low note, then a jump to a higher one
    osc.frequency.setValueAtTime(1175, t);
    osc.frequency.setValueAtTime(1760, t + 0.05);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    env.gain.setValueAtTime(peak, t + 0.045);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.054);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(env).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** The AudioContext when sound effects should play: after the first gesture, and not muted. */
  private audibleContext(): AudioContext | null {
    return this.ctx && !this.mutes.sfx && this.levels.sfx > 0 ? this.ctx : null;
  }

  // ---- music

  private async start(): Promise<void> {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
    this.applyMusicVolume(true);
    void this.loadSamples(ctx);
    const data = await (await fetch(this.url)).arrayBuffer();
    const source = ctx.createBufferSource();
    source.buffer = await ctx.decodeAudioData(data);
    source.loop = true;
    source.connect(this.gain);
    source.start();
    await ctx.resume();
  }

  /** Fetch and decode the recorded effects. One that fails just stays synthesized. */
  private async loadSamples(ctx: AudioContext): Promise<void> {
    await Promise.all(
      (Object.entries(CUE_SAMPLES) as Array<[SoundCue, string]>).map(async ([cue, path]) => {
        try {
          const response = await fetch(this.siteRoot + path);
          if (!response.ok) throw new Error(`${response.status} ${path}`);
          this.samples.set(cue, await ctx.decodeAudioData(await response.arrayBuffer()));
        } catch (err) {
          console.warn(`Sound effect ${cue} could not be loaded; using the synthesized one`, err);
        }
      }),
    );
  }

  private applyMusicVolume(immediate = false): void {
    if (!this.ctx || !this.gain) return;
    const target = this.mutes.music ? 0 : this.levels.music * (this.ducked ? PAUSED_FACTOR : 1);
    if (immediate) this.gain.gain.value = target;
    else this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private changed(): void {
    this.applyMusicVolume();
    if (this.mutes.sfx || this.levels.sfx === 0) this.stopDiceCharge();
    this.save();
  }

  // ---- persistence

  private load(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Record<AudioChannel, { volume?: unknown; muted?: unknown }>> | null;
      for (const channel of ['music', 'sfx'] as const) {
        const entry = saved?.[channel];
        if (typeof entry?.volume === 'number') this.levels[channel] = Math.min(1, Math.max(0, entry.volume));
        if (typeof entry?.muted === 'boolean') this.mutes[channel] = entry.muted;
      }
    } catch {
      // storage unavailable or corrupt: keep the defaults
    }
  }

  private save(): void {
    try {
      const state = (c: AudioChannel) => ({ volume: this.levels[c], muted: this.mutes[c] });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ music: state('music'), sfx: state('sfx') }));
    } catch {
      // private mode etc.: the setting just won't persist
    }
  }
}
