import { describe, expect, it, vi } from 'vitest';
import type { AudioSettings } from '../../core/bgm';
import { SoundControl, sliderTrack, volumeFromX } from './soundControl';

const RECT = { x: 100, y: 200, w: 372, h: 56 };
/** The vertical middle of the slider track (the label takes the top of the row). */
const TRACK_Y = RECT.y + 38;

function setup(channel: 'music' | 'sfx' = 'sfx') {
  const audio = { volume: vi.fn(() => 0.5), isMuted: vi.fn(() => false), setVolume: vi.fn(), toggleMute: vi.fn() } satisfies AudioSettings;
  return { audio, control: new SoundControl(RECT, audio, channel, '효과음') };
}

describe('volumeFromX', () => {
  const track = sliderTrack(RECT);

  it('maps the track ends to 0 and 1', () => {
    expect(volumeFromX(track, track.x)).toBe(0);
    expect(volumeFromX(track, track.x + track.w)).toBe(1);
    expect(volumeFromX(track, track.x + track.w / 2)).toBeCloseTo(0.5);
  });

  it('clamps pointers beyond either end', () => {
    expect(volumeFromX(track, track.x - 500)).toBe(0);
    expect(volumeFromX(track, track.x + track.w + 500)).toBe(1);
  });
});

describe('SoundControl', () => {
  it('toggles mute of its own channel when the speaker button is clicked', () => {
    const { audio, control } = setup('music');
    control.pointerDown(RECT.x + 28, RECT.y + 28);
    control.pointerUp(RECT.x + 28, RECT.y + 28);
    expect(audio.toggleMute).toHaveBeenCalledTimes(1);
    expect(audio.toggleMute).toHaveBeenCalledWith('music');
  });

  it('sets the volume of its channel on press and while dragging, even outside the control', () => {
    const { audio, control } = setup('sfx');
    const track = sliderTrack(RECT);
    expect(control.pointerDown(track.x + track.w / 4, TRACK_Y)).toBe(true);
    expect(audio.setVolume).toHaveBeenLastCalledWith('sfx', 0.25);
    control.pointerMove(track.x + track.w * 0.75, TRACK_Y + 300);
    expect(audio.setVolume).toHaveBeenLastCalledWith('sfx', 0.75);
    control.pointerMove(track.x + track.w + 400, TRACK_Y);
    expect(audio.setVolume).toHaveBeenLastCalledWith('sfx', 1);
  });

  it('stops following the pointer after release or cancel', () => {
    const { audio, control } = setup();
    const track = sliderTrack(RECT);
    control.pointerDown(track.x + 10, TRACK_Y);
    control.pointerUp(track.x + 10, TRACK_Y);
    control.pointerMove(track.x + 100, TRACK_Y);
    expect(audio.setVolume).toHaveBeenCalledTimes(1);
    control.pointerDown(track.x + 10, TRACK_Y);
    control.cancel();
    control.pointerMove(track.x + 100, TRACK_Y);
    expect(audio.setVolume).toHaveBeenCalledTimes(2);
  });

  it('ignores presses elsewhere', () => {
    const { audio, control } = setup();
    expect(control.pointerDown(RECT.x - 50, TRACK_Y)).toBe(false);
    expect(control.pointerDown(RECT.x + 200, RECT.y + RECT.h + 40)).toBe(false);
    expect(audio.setVolume).not.toHaveBeenCalled();
  });
});
