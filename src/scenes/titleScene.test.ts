import { describe, expect, it, vi } from 'vitest';
import { SceneManager } from '../core/scene';
import { TitleScene } from './titleScene';
import type { AppContext, SceneParams } from './types';

const MENU = [1228, 48] as const;
const MUSIC_MUTE = [888, 178] as const;
const SFX_MUTE = [888, 244] as const;
const CLOSE = [1046, 316] as const;
const START = [457, 658] as const;
const NOWHERE = [100, 300] as const;

function setup() {
  const manager = new SceneManager<SceneParams>();
  const started = vi.fn();
  manager.register('characterSelect', () => {
    started();
    return { update() {}, render() {} };
  });
  const audio = { volume: () => 0.5, isMuted: () => false, setVolume: vi.fn(), toggleMute: vi.fn() };
  const sfx = { playDiceThrow: vi.fn(), playDiceBounce: vi.fn(), startDiceCharge: vi.fn(), setDiceChargePower: vi.fn(), stopDiceCharge: vi.fn(), playCue: vi.fn() };
  const app: AppContext = { sprites: {} as AppContext['sprites'], manager, search: '', audio, sfx, setPaused: vi.fn() };
  return { scene: new TitleScene(app), audio, started };
}

const click = (scene: TitleScene, p: readonly [number, number]) => {
  scene.onPointerDown(p[0], p[1]);
  scene.onPointerUp(p[0], p[1]);
};

describe('title menu', () => {
  it('starts closed and opens and closes with the gear button', () => {
    const { scene } = setup();
    expect(scene.menuOpen).toBe(false);
    click(scene, MENU);
    expect(scene.menuOpen).toBe(true);
    click(scene, MENU);
    expect(scene.menuOpen).toBe(false);
  });

  it('closes with the close button and when pressing outside the panel', () => {
    const { scene } = setup();
    click(scene, MENU);
    click(scene, CLOSE);
    expect(scene.menuOpen).toBe(false);
    click(scene, MENU);
    click(scene, NOWHERE);
    expect(scene.menuOpen).toBe(false);
  });

  it('mutes the music and the sound effects separately, from inside the menu only', () => {
    const { scene, audio } = setup();
    click(scene, MUSIC_MUTE);
    expect(audio.toggleMute).not.toHaveBeenCalled();
    click(scene, MENU);
    click(scene, MUSIC_MUTE);
    expect(audio.toggleMute).toHaveBeenLastCalledWith('music');
    click(scene, SFX_MUTE);
    expect(audio.toggleMute).toHaveBeenLastCalledWith('sfx');
    expect(audio.toggleMute).toHaveBeenCalledTimes(2);
    expect(scene.menuOpen).toBe(true);
  });

  it('the click that dismisses the menu does not also press a button behind it', () => {
    const { scene, started } = setup();
    click(scene, MENU);
    click(scene, START);
    expect(scene.menuOpen).toBe(false);
    expect(started).not.toHaveBeenCalled();
    click(scene, START);
    expect(started).toHaveBeenCalledTimes(1);
  });
});
