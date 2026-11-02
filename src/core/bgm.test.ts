import { describe, expect, it } from 'vitest';
import { Bgm } from './bgm';

describe('Bgm settings', () => {
  it('starts with the music quieter than the effects, and nothing muted', () => {
    const bgm = new Bgm('x.wav');
    expect(bgm.volume('music')).toBe(0.25);
    expect(bgm.volume('sfx')).toBe(0.5);
    expect(bgm.isMuted('music')).toBe(false);
    expect(bgm.isMuted('sfx')).toBe(false);
  });

  it('clamps the volume to 0..1', () => {
    const bgm = new Bgm('x.wav');
    bgm.setVolume('sfx', 3);
    expect(bgm.volume('sfx')).toBe(1);
    bgm.setVolume('sfx', -1);
    expect(bgm.volume('sfx')).toBe(0);
  });

  it('keeps the music and the sound effects independent', () => {
    const bgm = new Bgm('x.wav');
    bgm.setVolume('music', 0.8);
    expect(bgm.volume('music')).toBe(0.8);
    expect(bgm.volume('sfx')).toBe(0.5);
    bgm.toggleMute('sfx');
    expect(bgm.isMuted('sfx')).toBe(true);
    expect(bgm.isMuted('music')).toBe(false);
  });

  it('toggles mute without losing the chosen volume', () => {
    const bgm = new Bgm('x.wav');
    bgm.setVolume('music', 0.8);
    bgm.toggleMute('music');
    expect(bgm.isMuted('music')).toBe(true);
    expect(bgm.volume('music')).toBe(0.8);
    bgm.toggleMute('music');
    expect(bgm.isMuted('music')).toBe(false);
  });

  it('turns a channel back on when its volume is raised while muted', () => {
    const bgm = new Bgm('x.wav');
    bgm.toggleMute('sfx');
    bgm.setVolume('sfx', 0.3);
    expect(bgm.isMuted('sfx')).toBe(false);
  });

  it('the M key mutes both channels, and unmutes both when nothing is audible', () => {
    const bgm = new Bgm('x.wav');
    bgm.toggleMuteAll();
    expect(bgm.isMuted('music')).toBe(true);
    expect(bgm.isMuted('sfx')).toBe(true);
    bgm.toggleMuteAll();
    expect(bgm.isMuted('music')).toBe(false);
    expect(bgm.isMuted('sfx')).toBe(false);
  });

  it('the M key silences everything even when only one channel is already muted', () => {
    const bgm = new Bgm('x.wav');
    bgm.toggleMute('music');
    bgm.toggleMuteAll();
    expect(bgm.isMuted('music')).toBe(true);
    expect(bgm.isMuted('sfx')).toBe(true);
  });
});
