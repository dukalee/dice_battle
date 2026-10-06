import { describe, expect, it, vi } from 'vitest';
import { SceneManager, type Scene } from '../core/scene';
import type { CharacterId } from '../game/characters';
import { GameScene } from './gameScene';
import type { AppContext, SceneParams } from './types';

// Logical coordinates of the controls (see gameScene.ts)
const PAUSE = [640, 108] as const;
const ATTACK = [510, 664] as const;
const HEAL = [770, 664] as const;
const TRAY = [640, 290] as const;
const RESUME = [640, 314] as const;
const RESTART = [640, 394] as const;
const TITLE = [640, 474] as const;

const stub = (): Scene => ({ update() {}, render() {} });

function setup(character: CharacterId, seed: number) {
  const manager = new SceneManager<SceneParams>();
  const gameOverParams: Array<SceneParams['gameOver']> = [];
  manager.register('title', stub);
  manager.register('characterSelect', stub);
  manager.register('gameOver', (p) => {
    gameOverParams.push(p);
    return stub();
  });
  const setPaused = vi.fn();
  const app: AppContext = { sprites: {} as AppContext['sprites'], manager, search: `?seed=${seed}`, setPaused };
  manager.register('game', (p) => new GameScene(app, p));
  manager.go('game', { character });
  const scene = manager.scene as GameScene;
  return { manager, scene, setPaused, gameOverParams };
}

const click = (scene: Scene, p: readonly [number, number]) => {
  scene.onPointerDown?.(p[0], p[1]);
  scene.onPointerUp?.(p[0], p[1]);
};
/** Advance the scene by `ms` of game time in 16 ms updates. */
const tick = (scene: Scene, ms: number) => {
  for (let t = 0; t < ms; t += 16) scene.update(16);
};
/** Advance until `done()`; returns the ms spent (fails the test if it never happens). */
function until(scene: Scene, done: () => boolean, maxMs = 30_000): number {
  let t = 0;
  while (!done()) {
    if (t > maxMs) throw new Error('condition not reached in time');
    scene.update(16);
    t += 16;
  }
  return t;
}
/** Choose an action, throw the dice (a tap), and return once the scene is busy. */
function playerTurn(scene: GameScene, action: readonly [number, number]) {
  click(scene, action);
  scene.onPointerDown(TRAY[0], TRAY[1]);
  scene.onPointerUp(TRAY[0], TRAY[1]);
}
const snapshot = (s: GameScene) => JSON.stringify({ view: s.view, poses: s.poses, log: s.log.all, mode: s.mode, faces: s.tray.faces });

describe('Pause menu', () => {
  it('opens from the Pause button and freezes the loop', () => {
    const { scene, setPaused } = setup('warrior', 1);
    expect(scene.paused).toBe(false);
    click(scene, PAUSE);
    expect(scene.paused).toBe(true);
    expect(setPaused).toHaveBeenLastCalledWith(true);
  });

  it('ignores attack, heal and the dice area while paused', () => {
    const { scene } = setup('warrior', 1);
    click(scene, PAUSE);
    click(scene, ATTACK);
    click(scene, HEAL);
    scene.onPointerDown(TRAY[0], TRAY[1]);
    scene.onPointerUp(TRAY[0], TRAY[1]);
    expect(scene.mode).toBe('choose');
    expect(scene.tray.state).toBe('hidden');
    expect(scene.log.all).toHaveLength(1);
  });

  it('resumes where it was with "이어하기"', () => {
    const { scene, setPaused } = setup('warrior', 1);
    click(scene, PAUSE);
    click(scene, RESUME);
    expect(scene.paused).toBe(false);
    expect(setPaused).toHaveBeenLastCalledWith(false);
    click(scene, ATTACK); // controls work again
    expect(scene.mode).toBe('throw');
  });

  it('"재시작" goes to character select and never leaves the loop frozen', () => {
    const { scene, manager, setPaused } = setup('warrior', 1);
    click(scene, PAUSE);
    click(scene, RESTART);
    expect(manager.name).toBe('characterSelect');
    expect(setPaused).toHaveBeenLastCalledWith(false);
  });

  it('"타이틀" goes to the title screen and never leaves the loop frozen', () => {
    const { scene, manager, setPaused } = setup('warrior', 1);
    click(scene, PAUSE);
    click(scene, TITLE);
    expect(manager.name).toBe('title');
    expect(setPaused).toHaveBeenLastCalledWith(false);
  });

  it('can be opened and closed repeatedly', () => {
    const { scene } = setup('warrior', 1);
    for (let i = 0; i < 3; i++) {
      click(scene, PAUSE);
      expect(scene.paused).toBe(true);
      click(scene, RESUME);
      expect(scene.paused).toBe(false);
    }
  });
});

/** Throw once and record the first moment (ms) each thing happens, until the AI's turn begins. */
function timeline(character: CharacterId, seed: number, action: readonly [number, number]) {
  const { scene } = setup(character, seed);
  playerTurn(scene, action);
  const at: Record<string, number> = {};
  const note = (k: string, v: boolean, t: number) => {
    if (v && at[k] === undefined) at[k] = t;
  };
  const hp0 = JSON.stringify([scene.view.player.hp, scene.view.enemy.hp]);
  const log0 = scene.log.all.length;
  let highlightedWhileExplaining = false;
  let bannerWhileExplaining = false;
  let playerPlan = scene.lastPlan;
  let t = 0;
  while (t < 20_000 && scene.mode !== 'choose') {
    scene.update(16);
    t += 16;
    playerPlan ??= scene.lastPlan; // the player's own result, before the AI's turn replaces it
    note('settled', scene.tray.state === 'settled', t);
    note('explain', scene.explain !== null, t);
    if (scene.explain) {
      highlightedWhileExplaining ||= scene.tray.isHighlighting;
      bannerWhileExplaining ||= scene.banner !== null;
    }
    note('pose', scene.poses.player !== 'idle' || scene.poses.enemy !== 'idle', t);
    note('banner', scene.banner !== null, t);
    note('hp', JSON.stringify([scene.view.player.hp, scene.view.enemy.hp]) !== hp0, t);
    note('log', scene.log.all.length > log0, t);
    if (at.log !== undefined && t > at.log + 1500) break;
  }
  return { at, scene, plan: playerPlan, highlightedWhileExplaining, bannerWhileExplaining };
}

describe('special results are explained before the move happens', () => {
  it('critical attack: dice settle, then pop and the effect is explained, and only then the pose, banner and damage', () => {
    const r = timeline('warrior', 2, ATTACK); // the warrior rolls a double
    const { at } = r;
    expect(at.explain).toBeGreaterThan(at.settled - 1);
    expect(at.pose).toBeGreaterThan(at.explain + 1500); // the explanation is shown before anything moves
    expect(at.banner).toBeGreaterThanOrEqual(at.pose);
    expect(at.hp).toBeGreaterThan(at.pose);
    expect(at.log).toBeGreaterThanOrEqual(at.hp);
    expect(r.highlightedWhileExplaining).toBe(true);
    expect(r.bannerWhileExplaining).toBe(false); // the big word waits for the move
    expect(r.plan?.actorPose).toBe('critical_attack');
  });

  it('shows the explanation text, and clears it before the move', () => {
    const { scene } = setup('warrior', 2);
    playerTurn(scene, ATTACK);
    until(scene, () => scene.explain !== null);
    expect(scene.explain?.detail).toBe('같은 눈금! 두 눈의 합의 4배 데미지');
    expect(scene.explain?.tone).toBe('critical');
    until(scene, () => scene.banner !== null);
    expect(scene.explain).toBeNull();
    expect(scene.tray.isHighlighting).toBe(false);
  });

  it('critical heal is explained first too', () => {
    const r = timeline('warrior', 2, HEAL);
    expect(r.plan?.actorPose).toBe('critical_heal');
    expect(r.plan?.action).toBe('heal');
    expect(r.at.explain).toBeDefined();
    expect(r.at.pose).toBeGreaterThan(r.at.explain + 1500);
    expect(r.at.banner).toBeGreaterThanOrEqual(r.at.pose);
    expect(r.highlightedWhileExplaining).toBe(true);
  });

  it('FAIL! is explained first as well', () => {
    const r = timeline('mage', 507, ATTACK); // 1, 1, 1
    expect(r.plan?.actorPose).toBe('fail');
    expect(r.at.explain).toBeDefined();
    expect(r.at.pose).toBeGreaterThan(r.at.explain + 1500);
    expect(r.at.hp).toBeGreaterThan(r.at.pose);
    expect(r.highlightedWhileExplaining).toBe(true);
  });

  it('a plain result has no highlight and no explanation: the move follows the dice right away', () => {
    const r = timeline('warrior', 1, ATTACK);
    expect(r.plan?.banner).toBeNull();
    expect(r.at.explain).toBeUndefined();
    expect(r.at.pose - r.at.settled).toBeLessThan(100);
  });

  it('Pause freezes the highlight and the explanation, and resuming continues them', () => {
    const { scene } = setup('warrior', 2);
    playerTurn(scene, ATTACK);
    until(scene, () => scene.explain !== null);
    tick(scene, 400);
    click(scene, PAUSE);
    const before = JSON.stringify([scene.explain?.age, scene.tray.frames(), scene.poses]);
    for (let i = 0; i < 300; i++) scene.update(16);
    expect(JSON.stringify([scene.explain?.age, scene.tray.frames(), scene.poses])).toBe(before);
    expect(scene.explain).not.toBeNull();
    click(scene, RESUME);
    until(scene, () => scene.banner !== null);
    expect(scene.poses.player).toBe('critical_attack');
  });
});

describe('dice area position', () => {
  it('sits exactly midway between the Pause button and the log (equal space above and below)', () => {
    const { scene } = setup('warrior', 1);
    const tray = scene.tray.rect;
    const pauseBottom = 86 + 44;
    const logTop = 520;
    expect(tray.y - pauseBottom).toBe(logTop - (tray.y + tray.h));
    expect(tray.y - pauseBottom).toBeGreaterThan(40);
  });

  it('is smaller than before (it was 400 x 300)', () => {
    const { scene } = setup('warrior', 1);
    expect(scene.tray.rect.w).toBeLessThan(400);
    expect(scene.tray.rect.h).toBeLessThan(300);
  });

  it('is centered on the screen and still holds four dice', () => {
    const { scene } = setup('rogue', 1);
    const r = scene.tray.rect;
    expect(r.x + r.w / 2).toBe(640);
    scene.tray.rollAuto({ first: [2, 2], extra: [4, 4] });
    until(scene, () => !scene.tray.isRolling);
    for (const f of scene.tray.frames()) {
      expect(f.x - 31).toBeGreaterThanOrEqual(r.x);
      expect(f.x + 31).toBeLessThanOrEqual(r.x + r.w);
    }
  });
});

describe('Escape key', () => {
  it('opens the pause menu and closes it again', () => {
    const { scene, setPaused } = setup('warrior', 1);
    scene.onKeyDown?.('Escape');
    expect(scene.paused).toBe(true);
    expect(setPaused).toHaveBeenLastCalledWith(true);
    scene.onKeyDown?.('Escape');
    expect(scene.paused).toBe(false);
    expect(setPaused).toHaveBeenLastCalledWith(false);
  });

  it('works through the scene manager', () => {
    const { scene, manager } = setup('warrior', 1);
    manager.keyDown('Escape');
    expect(scene.paused).toBe(true);
    manager.keyDown('Escape');
    expect(scene.paused).toBe(false);
  });

  it('ignores other keys', () => {
    const { scene } = setup('warrior', 1);
    for (const k of ['Enter', ' ', 'p', 'Esc', 'ArrowLeft']) scene.onKeyDown?.(k);
    expect(scene.paused).toBe(false);
  });

  it('pauses mid-roll and freezes everything, like the Pause button', () => {
    const { scene } = setup('warrior', 11);
    playerTurn(scene, ATTACK);
    tick(scene, 300);
    scene.onKeyDown?.('Escape');
    const before = snapshot(scene);
    const frames = JSON.stringify(scene.tray.frames());
    for (let i = 0; i < 200; i++) scene.update(16);
    expect(snapshot(scene)).toBe(before);
    expect(JSON.stringify(scene.tray.frames())).toBe(frames);
    expect(scene.tray.state).toBe('rolling');
    scene.onKeyDown?.('Escape');
    until(scene, () => scene.mode === 'choose');
  });

  it('while paused, controls stay blocked and the menu still works', () => {
    const { scene, manager } = setup('warrior', 1);
    scene.onKeyDown?.('Escape');
    click(scene, ATTACK);
    expect(scene.mode).toBe('choose');
    click(scene, RESTART);
    expect(manager.name).toBe('characterSelect');
  });

  it('cancels a dice hold that is in progress instead of throwing', () => {
    const { scene } = setup('warrior', 1);
    click(scene, ATTACK);
    scene.onPointerDown(TRAY[0], TRAY[1]);
    expect(scene.tray.state).toBe('charging');
    scene.onKeyDown?.('Escape');
    expect(scene.tray.state).toBe('ready');
    expect(scene.battle.state.phase).toBe('playerTurn'); // nothing was thrown
    scene.onKeyDown?.('Escape');
    scene.onPointerUp(TRAY[0], TRAY[1]); // the old press ending later must not throw either
    expect(scene.battle.state.phase).toBe('playerTurn');
  });

  it('does nothing on the other screens', () => {
    const manager = new SceneManager<SceneParams>();
    const seen: string[] = [];
    manager.register('title', () => ({ update() {}, render() {}, onKeyDown: (k: string) => seen.push(k) }));
    manager.go('title');
    manager.keyDown('Escape');
    expect(seen).toEqual(['Escape']);
    const bare = new SceneManager<SceneParams>();
    bare.register('title', stub);
    bare.go('title');
    expect(() => bare.keyDown('Escape')).not.toThrow();
  });
});

describe('Pause freezes everything and changes nothing', () => {
  /** Plays one full round trip (player turn + AI turn); pauses at the given moments if asked. */
  function play(pauseWhen: Array<(s: GameScene) => boolean>) {
    const { scene } = setup('warrior', 11);
    playerTurn(scene, ATTACK);
    const frozen: boolean[] = [];
    const pending = [...pauseWhen];
    let guard = 0;
    while (!(scene.mode === 'choose' && scene.log.all.length > 3) && guard++ < 4000) {
      scene.update(16);
      if (pending.length && pending[0](scene)) {
        pending.shift();
        click(scene, PAUSE);
        const before = snapshot(scene);
        const framesBefore = JSON.stringify(scene.tray.frames());
        // even if the loop were to keep calling update with real time, the scene must not move
        for (let i = 0; i < 200; i++) scene.update(16);
        for (const p of [ATTACK, HEAL, TRAY]) click(scene, p);
        frozen.push(snapshot(scene) === before && JSON.stringify(scene.tray.frames()) === framesBefore);
        click(scene, RESUME);
      }
    }
    return { final: snapshot(scene), frozen, scene };
  }

  const diceRolling = (s: GameScene) => s.tray.state === 'rolling';
  const aiAnnouncing = (s: GameScene) => s.log.all.some((l) => l.includes('선택했다'));
  const aiDiceRolling = (s: GameScene) => aiAnnouncing(s) && s.tray.state === 'rolling';
  const impactShown = (s: GameScene) => s.poses.enemy === 'hit';

  it('plays out the same turn with or without pauses, so the dice never change', () => {
    const reference = play([]);
    expect(reference.final).toContain('ROUND 1');
    const paused = play([diceRolling, impactShown, aiAnnouncing, aiDiceRolling]);
    expect(paused.frozen).toEqual([true, true, true, true]);
    expect(paused.final).toBe(reference.final);
  });

  it('keeps the AI turn paused mid-roll and finishes it after resuming', () => {
    const { scene, setPaused } = setup('warrior', 11);
    playerTurn(scene, ATTACK);
    until(scene, () => aiDiceRolling(scene));
    const facesBefore = [...scene.tray.faces];
    click(scene, PAUSE);
    expect(setPaused).toHaveBeenLastCalledWith(true);
    const rolling = JSON.stringify(scene.tray.frames());
    for (let i = 0; i < 300; i++) scene.update(16);
    expect(JSON.stringify(scene.tray.frames())).toBe(rolling);
    expect(scene.tray.state).toBe('rolling');
    click(scene, RESUME);
    until(scene, () => scene.mode === 'choose');
    expect(scene.tray.faces.length === 0 || scene.tray.faces.join() === facesBefore.join()).toBe(true);
  });
});

describe('GAME OVER', () => {
  it('goes to the GAME OVER screen with the round reached when the player falls', () => {
    const { scene, manager, gameOverParams } = setup('mage', 507); // this seed rolls 1,1,1 on the first attack
    playerTurn(scene, ATTACK);
    until(scene, () => manager.name === 'gameOver');
    expect(gameOverParams).toEqual([{ round: 1, character: 'mage' }]);
  });

  it('a new game after GAME OVER starts clean: ROUND 1, full HP, no old log, nothing frozen', () => {
    const { scene, manager, setPaused } = setup('mage', 507);
    playerTurn(scene, ATTACK);
    until(scene, () => manager.name === 'gameOver');
    manager.go('characterSelect');
    manager.go('game', { character: 'warrior' });
    const fresh = manager.scene as GameScene;
    expect(fresh).not.toBe(scene);
    expect(fresh.view.round).toBe(1);
    expect(fresh.view.player).toMatchObject({ id: 'warrior', hp: 100, maxHp: 100 });
    expect(fresh.view.enemy.hp).toBe(fresh.view.enemy.maxHp);
    expect(fresh.log.all).toHaveLength(1);
    expect(fresh.mode).toBe('choose');
    expect(fresh.paused).toBe(false);
    expect(fresh.poses).toEqual({ player: 'idle', enemy: 'idle' });
    expect(setPaused).not.toHaveBeenCalledWith(true);
  });

  it('restarting from the pause menu mid-turn also starts clean', () => {
    const { scene, manager } = setup('warrior', 11);
    playerTurn(scene, ATTACK);
    tick(scene, 900);
    click(scene, PAUSE);
    click(scene, RESTART);
    expect(manager.name).toBe('characterSelect');
    manager.go('game', { character: 'warrior' });
    const fresh = manager.scene as GameScene;
    expect(fresh.view.round).toBe(1);
    expect(fresh.view.enemy.hp).toBe(fresh.view.enemy.maxHp);
    expect(fresh.log.all).toHaveLength(1);
    expect(fresh.tray.state).toBe('hidden');
    expect(fresh.mode).toBe('choose');
  });
});
