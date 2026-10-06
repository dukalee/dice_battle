import { describe, expect, it, vi } from 'vitest';
import { Battle } from '../game/battle';
import { createRng } from '../game/rng';
import {
  DiceTray,
  dieFrameAt,
  dieSizeFor,
  highlightFrame,
  BONUS_ANNOUNCE_MS,
  BONUS_BEAT_MS,
  BONUS_SLIDE_AT_MS,
  BONUS_SLIDE_MS,
  HIGHLIGHT_POP_MS,
  HIGHLIGHT_STAGGER_MS,
  holdToPower,
  layoutSlots,
  type DiceResult,
} from './diceTray';

const RECT = { x: 460, y: 190, w: 360, h: 270 };

function makeTray(onRelease: (power: number) => DiceResult | null = () => ({ first: [3, 4] })) {
  const onSettled = vi.fn();
  const release = vi.fn(onRelease);
  const tray = new DiceTray(RECT, createRng(99), { onRelease: release, onSettled });
  return { tray, onSettled, release };
}

/** Advance in 16 ms frames until `done` or `maxMs` passes; returns the ms spent. */
function run(tray: DiceTray, maxMs: number, done: () => boolean = () => !tray.isRolling): number {
  let t = 0;
  while (t < maxMs && !done()) {
    tray.update(16);
    t += 16;
  }
  return t;
}

describe('holdToPower', () => {
  it('gives a small but positive power for a tap', () => {
    expect(holdToPower(0)).toBeGreaterThan(0);
    expect(holdToPower(0)).toBeLessThan(0.2);
  });

  it('grows with the hold time and tops out at 1', () => {
    expect(holdToPower(300)).toBeGreaterThan(holdToPower(100));
    expect(holdToPower(800)).toBeGreaterThan(holdToPower(300));
    expect(holdToPower(5000)).toBe(1);
  });
});

describe('layoutSlots', () => {
  it('lays out 2, 3 and 4 dice inside the tray without overlapping', () => {
    for (const n of [2, 3, 4]) {
      const slots = layoutSlots(RECT, n);
      const size = dieSizeFor(n);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.x - size / 2).toBeGreaterThanOrEqual(RECT.x);
        expect(s.x + size / 2).toBeLessThanOrEqual(RECT.x + RECT.w);
        expect(s.y - size / 2).toBeGreaterThanOrEqual(RECT.y);
        expect(s.y + size / 2).toBeLessThanOrEqual(RECT.y + RECT.h);
      }
      for (let i = 1; i < n; i++) expect(slots[i].x - slots[i - 1].x).toBeGreaterThanOrEqual(size);
    }
  });

  it('is centered on the tray', () => {
    for (const n of [2, 3, 4]) {
      const slots = layoutSlots(RECT, n);
      expect((slots[0].x + slots[n - 1].x) / 2).toBeCloseTo(RECT.x + RECT.w / 2, 6);
    }
  });
});

describe('DiceTray input', () => {
  it('is inactive until enabled: pressing does nothing', () => {
    const { tray, release } = makeTray();
    expect(tray.state).toBe('hidden');
    expect(tray.pointerDown(600, 300)).toBe(false);
    tray.pointerUp();
    expect(release).not.toHaveBeenCalled();
    expect(tray.state).toBe('hidden');
  });

  it('becomes ready after enable and shows the right number of dice', () => {
    for (const n of [2, 3]) {
      const { tray } = makeTray();
      tray.enable(n);
      expect(tray.state).toBe('ready');
      expect(tray.frames()).toHaveLength(n);
    }
  });

  it('ignores a press outside the tray', () => {
    const { tray } = makeTray();
    tray.enable(2);
    expect(tray.pointerDown(10, 10)).toBe(false);
    expect(tray.state).toBe('ready');
  });

  it('shakes while held, and harder the longer it is held', () => {
    const { tray } = makeTray();
    tray.enable(2);
    const rest = tray.frames().map((f) => ({ x: f.x, y: f.y }));
    tray.pointerDown(600, 300);
    expect(tray.state).toBe('charging');
    const deviation = () => {
      let worst = 0;
      for (let k = 0; k < 40; k++) {
        tray.update(7);
        tray.frames().forEach((f, i) => {
          worst = Math.max(worst, Math.hypot(f.x - rest[i].x, f.y - rest[i].y));
        });
      }
      return worst;
    };
    const early = deviation();
    expect(early).toBeGreaterThan(0);
    tray.update(1000);
    const late = deviation();
    expect(late).toBeGreaterThan(early);
  });

  it('throws on release even when the pointer is outside the tray', () => {
    const { tray, release } = makeTray();
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.update(500);
    tray.pointerUp(); // no position is needed: the release can happen anywhere
    expect(release).toHaveBeenCalledTimes(1);
    expect(tray.state).toBe('rolling');
  });

  it('throws after a tap too, but with a weaker power than a long hold', () => {
    const tap = makeTray();
    tap.tray.enable(2);
    tap.tray.pointerDown(600, 300);
    tap.tray.pointerUp();
    const hold = makeTray();
    hold.tray.enable(2);
    hold.tray.pointerDown(600, 300);
    hold.tray.update(1200);
    hold.tray.pointerUp();
    const tapPower = tap.release.mock.calls[0][0];
    const holdPower = hold.release.mock.calls[0][0];
    expect(tap.tray.state).toBe('rolling');
    expect(tapPower).toBeGreaterThan(0);
    expect(holdPower).toBeGreaterThan(tapPower);
  });

  it('a longer hold makes a longer, higher throw', () => {
    const time = (holdMs: number) => {
      const { tray } = makeTray();
      tray.enable(2);
      tray.pointerDown(600, 300);
      tray.update(holdMs);
      tray.pointerUp();
      return run(tray, 10_000);
    };
    expect(time(1200)).toBeGreaterThan(time(0));
  });

  it('cancel while holding returns to ready without throwing', () => {
    const { tray, release } = makeTray();
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.pointerCancel();
    expect(tray.state).toBe('ready');
    tray.pointerUp();
    expect(release).not.toHaveBeenCalled();
  });

  it('stays ready when onRelease declines the throw', () => {
    const { tray } = makeTray(() => null);
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.pointerUp();
    expect(tray.state).toBe('ready');
  });

  it('a release with no press is ignored', () => {
    const { tray, release } = makeTray();
    tray.enable(2);
    tray.pointerUp();
    expect(release).not.toHaveBeenCalled();
  });
});

describe('DiceTray rolling', () => {
  it('rolls, then stops on exactly the decided faces and reports once', () => {
    const { tray, onSettled } = makeTray(() => ({ first: [6, 1] }));
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.pointerUp();
    expect(tray.isRolling).toBe(true);
    expect(onSettled).not.toHaveBeenCalled();
    run(tray, 10_000);
    expect(tray.state).toBe('settled');
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(tray.faces).toEqual([6, 1]);
    const frames = tray.frames();
    expect(frames.map((f) => f.face)).toEqual([6, 1]);
    expect(frames.every((f) => f.settled && f.visible)).toBe(true);
    // keeps showing the result and does not report again
    run(tray, 2000, () => false);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(tray.frames().map((f) => f.face)).toEqual([6, 1]);
  });

  it('settles every die exactly on its slot', () => {
    const { tray } = makeTray(() => ({ first: [2, 5, 3] }));
    tray.enable(3);
    tray.pointerDown(600, 300);
    tray.pointerUp();
    run(tray, 10_000);
    const slots = layoutSlots(RECT, 3);
    tray.frames().forEach((f, i) => {
      expect(f.x).toBeCloseTo(slots[i].x, 6);
      expect(f.y).toBeCloseTo(slots[i].y, 6);
      expect(f.lift).toBe(0);
    });
  });

  it('tumbles through other faces while in the air, then locks onto the real one before stopping', () => {
    const { tray } = makeTray(() => ({ first: [6, 6] }));
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.pointerUp();
    const seen = new Set<number>();
    let t = 0;
    while (tray.isRolling && t < 10_000) {
      tray.update(16);
      t += 16;
      if (t < 400) tray.frames().forEach((f) => seen.add(f.face));
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(tray.frames().every((f) => f.face === 6)).toBe(true);
  });

  it('does not move at all while the loop is paused (dt = 0)', () => {
    const { tray, onSettled } = makeTray(() => ({ first: [3, 3] }));
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.pointerUp();
    tray.update(300);
    const before = JSON.stringify(tray.frames());
    for (let i = 0; i < 500; i++) tray.update(0);
    expect(JSON.stringify(tray.frames())).toBe(before);
    expect(tray.isRolling).toBe(true);
    expect(onSettled).not.toHaveBeenCalled();
    run(tray, 10_000);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('shows four dice for a rogue: the extra pair is thrown by itself after the first pair stops', () => {
    const { tray, onSettled } = makeTray(() => ({ first: [4, 2], extra: [3, 5] }));
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.pointerUp();
    expect(tray.faces).toEqual([4, 2, 3, 5]);
    // right after the throw only the first pair is visible
    expect(tray.frames().map((f) => f.visible)).toEqual([true, true, false, false]);
    run(tray, 10_000, () => tray.frames()[0].settled && tray.frames()[1].settled);
    expect(tray.isRolling).toBe(true); // still waiting for the extra pair, no input needed
    expect(tray.frames()[2].visible).toBe(false);
    run(tray, 10_000, () => tray.frames()[2].visible);
    expect(tray.isRolling).toBe(true); // the second extra die follows a moment later
    run(tray, 10_000, () => tray.frames().every((f) => f.visible));
    expect(tray.frames().map((f) => f.visible)).toEqual([true, true, true, true]);
    run(tray, 10_000);
    expect(tray.state).toBe('settled');
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(tray.frames().map((f) => f.face)).toEqual([4, 2, 3, 5]);
    expect(tray.frames()).toHaveLength(4);
  });

  it('rollAuto rolls without any input (the AI turn)', () => {
    const { tray, onSettled, release } = makeTray();
    tray.rollAuto({ first: [1, 6, 2] });
    expect(tray.isRolling).toBe(true);
    run(tray, 10_000);
    expect(release).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(tray.frames().map((f) => f.face)).toEqual([1, 6, 2]);
  });

  it('rollAuto can also include the rogue extra dice', () => {
    const { tray } = makeTray();
    tray.rollAuto({ first: [2, 2], extra: [6, 1] });
    run(tray, 10_000);
    expect(tray.frames().map((f) => f.face)).toEqual([2, 2, 6, 1]);
  });

  it('clear hides the tray', () => {
    const { tray } = makeTray();
    tray.rollAuto({ first: [1, 2] });
    tray.clear();
    expect(tray.state).toBe('hidden');
    expect(tray.frames()).toEqual([]);
  });
});

describe('the hold time never changes the faces', () => {
  /** Plays the player's first attack of a seeded battle with the given hold time and returns the faces the tray ended on. */
  function throwWith(seed: number, holdMs: number): { shown: number[]; battleRolls: number[]; enemyRolls: number[] } {
    const battle = new Battle('rogue', createRng(seed));
    let outcomeRolls: number[] = [];
    const tray = new DiceTray(RECT, createRng(holdMs + 1), {
      onRelease: () => {
        const events = battle.playerAction('attack');
        const rolled = events.find((e) => e.type === 'rolled');
        if (rolled?.type !== 'rolled') return null;
        outcomeRolls = rolled.outcome.rolls;
        return { first: outcomeRolls.slice(0, 2), extra: outcomeRolls.length > 2 ? outcomeRolls.slice(2) : undefined };
      },
      onSettled: () => {},
    });
    tray.enable(2);
    tray.pointerDown(600, 300);
    tray.update(holdMs);
    tray.pointerUp();
    run(tray, 20_000);
    // the AI's turn afterwards must also be unaffected
    const enemyEvents = battle.enemyAction();
    const enemyRolled = enemyEvents.find((e) => e.type === 'rolled');
    return {
      shown: tray.frames().map((f) => f.face),
      battleRolls: outcomeRolls,
      enemyRolls: enemyRolled?.type === 'rolled' ? enemyRolled.outcome.rolls : [],
    };
  }

  it('gives the same dice for a tap, a medium hold and a long hold with the same seed', () => {
    for (const seed of [1, 7, 42, 2024, 31337]) {
      const tap = throwWith(seed, 0);
      const mid = throwWith(seed, 400);
      const long = throwWith(seed, 3000);
      expect(mid).toEqual(tap);
      expect(long).toEqual(tap);
      expect(tap.shown).toEqual(tap.battleRolls);
    }
  });
});

describe('dieFrameAt', () => {
  const anim = {
    face: 4,
    startAt: 100,
    duration: 1000,
    from: { x: 0, y: 100 },
    to: { x: 200, y: 50 },
    arcHeight: 80,
    spin: 10,
    tilt: 0.1,
    hiddenUntilStart: true,
  };

  it('is hidden before an extra die is thrown, and rests on its slot afterwards', () => {
    expect(dieFrameAt(anim, 0, () => 1).visible).toBe(false);
    const end = dieFrameAt(anim, 5000, () => 1);
    expect(end).toMatchObject({ visible: true, x: 200, y: 50, face: 4, settled: true, lift: 0 });
  });

  it('shows the true face near the end and never lifts below the table', () => {
    for (let t = 100; t <= 1100; t += 25) {
      const f = dieFrameAt(anim, t, () => 2);
      expect(f.lift).toBeGreaterThanOrEqual(0);
      if (t >= 100 + 1000 * 0.82) expect(f.face).toBe(4);
    }
  });
});

describe('dice highlight (pop, pop, pop)', () => {
  function settledTray(first: number[], extra?: number[]) {
    const { tray } = makeTray();
    tray.rollAuto({ first, extra });
    run(tray, 20_000);
    expect(tray.state).toBe('settled');
    return tray;
  }

  it('only starts once the dice have settled, and changes nothing before that', () => {
    const { tray } = makeTray();
    tray.rollAuto({ first: [3, 3] });
    tray.startHighlight();
    expect(tray.isHighlighting).toBe(false);
    run(tray, 20_000);
    expect(tray.frames().every((f) => f.glow === 0 && f.scale === 1)).toBe(true);
  });

  it('pops the dice one after another: each swells and rises, then keeps a soft glow', () => {
    const tray = settledTray([2, 2, 2]);
    const rest = tray.frames();
    tray.startHighlight();
    expect(tray.isHighlighting).toBe(true);
    // when the second die peaks, the first has already settled back and the third is still on its way up
    tray.update(HIGHLIGHT_STAGGER_MS + HIGHLIGHT_POP_MS / 2);
    const f = tray.frames();
    expect(f[1].scale).toBeCloseTo(1.5, 5);
    expect(f[1].y).toBeLessThan(rest[1].y - 25);
    expect(f[1].glow).toBeCloseTo(1, 5);
    expect(f[0].scale).toBeGreaterThan(1.08); // the first die is still settling back
    expect(f[0].scale).toBeLessThan(f[1].scale);
    expect(f[2].scale).toBeGreaterThan(1);
    expect(f[2].scale).toBeLessThan(1.5);
    tray.update(2000);
    for (const d of tray.frames()) {
      expect(d.scale).toBeCloseTo(1.08, 5);
      expect(d.glow).toBeCloseTo(0.5, 5);
    }
  });

  it('stopHighlight returns the dice to normal and keeps the faces', () => {
    const tray = settledTray([4, 4]);
    tray.startHighlight();
    tray.update(600);
    tray.stopHighlight();
    expect(tray.isHighlighting).toBe(false);
    for (const d of tray.frames()) {
      expect(d.scale).toBe(1);
      expect(d.glow).toBe(0);
    }
    expect(tray.frames().map((d) => d.face)).toEqual([4, 4]);
  });

  it('highlights all four dice of a rogue', () => {
    const tray = settledTray([6, 6], [3, 3]);
    tray.startHighlight();
    tray.update(3 * HIGHLIGHT_STAGGER_MS + HIGHLIGHT_POP_MS + 10);
    expect(tray.frames()).toHaveLength(4);
    expect(tray.frames().every((d) => d.glow > 0.4)).toBe(true);
  });

  it('freezes while the loop is paused (dt = 0)', () => {
    const tray = settledTray([5, 5]);
    tray.startHighlight();
    tray.update(200);
    const before = JSON.stringify(tray.frames());
    for (let i = 0; i < 300; i++) tray.update(0);
    expect(JSON.stringify(tray.frames())).toBe(before);
  });

  it('clear stops it too', () => {
    const tray = settledTray([5, 5]);
    tray.startHighlight();
    tray.clear();
    expect(tray.isHighlighting).toBe(false);
  });

  it('highlightFrame stays inside sensible ranges', () => {
    for (let ms = 0; ms < 3000; ms += 13) {
      for (let i = 0; i < 4; i++) {
        const h = highlightFrame(ms, i);
        expect(h.scale).toBeGreaterThanOrEqual(1);
        expect(h.scale).toBeLessThanOrEqual(1.5 + 1e-9);
        expect(h.lift).toBeGreaterThanOrEqual(0);
        expect(h.glow).toBeGreaterThanOrEqual(0);
        expect(h.glow).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe("the rogue's bonus stage (one more throw)", () => {
  const FIRST = [4, 2];
  const EXTRA = [3, 5];

  /** Start a rogue roll and advance in 8 ms steps until `done`; returns the tray. */
  function rogue() {
    const { tray, onSettled } = makeTray();
    tray.rollAuto({ first: FIRST, extra: EXTRA });
    return { tray, onSettled };
  }
  const advance = (tray: DiceTray, until: () => boolean, max = 20_000) => {
    let t = 0;
    while (!until() && t < max) {
      tray.update(8);
      t += 8;
    }
    return t;
  };
  const firstSettled = (tray: DiceTray) => tray.frames()[0].settled && tray.frames()[1].settled;

  it('lets the first pair land in the ordinary two-dice layout, so nothing hints that more dice are coming', () => {
    const { tray } = rogue();
    advance(tray, () => firstSettled(tray));
    const two = layoutSlots(RECT, 2);
    const f = tray.frames();
    expect(f[0].x).toBeCloseTo(two[0].x, 3);
    expect(f[1].x).toBeCloseTo(two[1].x, 3);
    expect(f[0].scale).toBe(1);
    // the same landing spots as a plain two-dice throw
    const plain = makeTray();
    plain.tray.rollAuto({ first: FIRST });
    advance(plain.tray, () => !plain.tray.isRolling);
    expect(plain.tray.frames().map((d) => [Math.round(d.x), Math.round(d.y)])).toEqual(f.slice(0, 2).map((d) => [Math.round(d.x), Math.round(d.y)]));
  });

  it('has no bonus phase before the first pair stops, none for a throw without extra dice, and none afterwards', () => {
    const { tray } = rogue();
    expect(tray.bonusPhase).toBe('none');
    advance(tray, () => firstSettled(tray));
    expect(tray.bonusPhase).toBe('none'); // a short beat first
    const plain = makeTray();
    plain.tray.rollAuto({ first: [3, 4] });
    for (let i = 0; i < 400; i++) {
      plain.tray.update(16);
      expect(plain.tray.bonusPhase).toBe('none');
    }
    advance(tray, () => !tray.isRolling);
    expect(tray.bonusPhase).toBe('none');
  });

  it('announces the extra throw for a good while before it happens', () => {
    const { tray } = rogue();
    const start = advance(tray, () => tray.bonusPhase === 'announce');
    expect(start).toBeGreaterThan(0);
    expect(BONUS_ANNOUNCE_MS).toBeGreaterThanOrEqual(1000);
    // 100 ms before the end the extra dice have still not been thrown
    tray.update(BONUS_ANNOUNCE_MS - 100);
    expect(tray.bonusPhase).toBe('announce');
    expect(tray.frames()[2].visible).toBe(false);
    expect(tray.frames()[3].visible).toBe(false);
    const rest = advance(tray, () => tray.bonusPhase !== 'announce');
    expect(rest).toBeLessThanOrEqual(120);
    // and the throw begins right when the announcement ends
    expect(tray.frames()[2].visible).toBe(true);
  });

  it('pops and glows the first pair, then slides it aside into the four-dice layout', () => {
    const { tray } = rogue();
    advance(tray, () => tray.bonusPhase === 'announce');
    const four = layoutSlots(RECT, 4);
    const two = layoutSlots(RECT, 2);
    tray.update(180);
    const popping = tray.frames();
    expect(popping[0].glow).toBeGreaterThan(0.3);
    expect(popping[0].scale).toBeGreaterThan(1);
    expect(popping[0].x).toBeCloseTo(two[0].x, 1); // not moving yet
    advance(tray, () => tray.bonusPhase !== 'announce');
    const f = tray.frames();
    expect(f[0].x).toBeCloseTo(four[0].x, 1);
    expect(f[1].x).toBeCloseTo(four[1].x, 1);
    expect(f[0].x).toBeLessThan(two[0].x);
    expect(f[0].scale).toBeCloseTo(dieSizeFor(4) / dieSizeFor(2), 3);
    expect(f[0].glow).toBeCloseTo(0, 3);
  });

  it('shows two empty "?" slots at the extra positions after the slide begins, and only until the dice are thrown', () => {
    const { tray } = rogue();
    advance(tray, () => tray.bonusPhase === 'announce');
    tray.update(BONUS_SLIDE_AT_MS - 40);
    expect(tray.frames().slice(2).every((d) => !d.placeholder)).toBe(true);
    tray.update(80);
    const four = layoutSlots(RECT, 4);
    const holes = tray.frames().slice(2);
    expect(holes.every((d) => d.placeholder && !d.visible)).toBe(true);
    expect(holes[0].x).toBeCloseTo(four[2].x, 1);
    expect(holes[1].x).toBeCloseTo(four[3].x, 1);
    // while the placeholders show, the first pair is already (or almost) in place
    advance(tray, () => tray.frames()[2].visible);
    expect(tray.frames().slice(2).some((d) => d.placeholder && d.visible)).toBe(false);
    expect(tray.frames()[2].placeholder).toBeFalsy();
  });

  it('throws the extra pair only after the announcement, with the right faces, and settles on the four-dice layout', () => {
    const { tray, onSettled } = rogue();
    advance(tray, () => tray.bonusPhase === 'announce');
    advance(tray, () => tray.frames()[2].visible);
    expect(tray.bonusPhase).toBe('none');
    advance(tray, () => !tray.isRolling);
    expect(onSettled).toHaveBeenCalledTimes(1);
    const f = tray.frames();
    expect(f.map((d) => d.face)).toEqual([...FIRST, ...EXTRA]);
    const four = layoutSlots(RECT, 4);
    f.forEach((d, i) => {
      expect(d.x).toBeCloseTo(four[i].x, 1);
      expect(d.y).toBeCloseTo(four[i].y, 1);
      expect(d.scale).toBeCloseTo(dieSizeFor(4) / dieSizeFor(2), 3);
    });
  });

  it('does not report "settled" until the bonus throw is over (the result waits for it)', () => {
    const { tray, onSettled } = rogue();
    advance(tray, () => tray.bonusPhase === 'announce');
    expect(onSettled).not.toHaveBeenCalled();
    expect(tray.isRolling).toBe(true);
    advance(tray, () => !tray.isRolling);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('freezes in the middle of the announcement while the loop is paused (dt = 0)', () => {
    const { tray } = rogue();
    advance(tray, () => tray.bonusPhase === 'announce');
    tray.update(300);
    const before = JSON.stringify(tray.frames());
    for (let i = 0; i < 400; i++) tray.update(0);
    expect(JSON.stringify(tray.frames())).toBe(before);
    expect(tray.bonusPhase).toBe('announce');
  });

  it('keeps the timing constants consistent: the slide finishes before the throw', () => {
    expect(BONUS_BEAT_MS).toBeGreaterThan(0);
    expect(BONUS_SLIDE_AT_MS + BONUS_SLIDE_MS).toBeLessThan(BONUS_ANNOUNCE_MS - 200);
  });

  it('highlighting the finished result still works with all four shrunken dice', () => {
    const { tray } = rogue();
    advance(tray, () => !tray.isRolling);
    tray.startHighlight();
    tray.update(3 * HIGHLIGHT_STAGGER_MS + HIGHLIGHT_POP_MS + 20);
    const f = tray.frames();
    expect(f).toHaveLength(4);
    expect(f.every((d) => d.glow > 0.4)).toBe(true);
    expect(f.every((d) => d.scale > dieSizeFor(4) / dieSizeFor(2))).toBe(true);
  });
});
