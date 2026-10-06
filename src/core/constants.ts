// Values shared across the whole game. Character stats and rule numbers live with the rule engine.

/** Logical resolution. All drawing and hit-testing use these coordinates. */
export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

/** Fixed update rate for the game loop. */
export const UPDATE_HZ = 60;
export const UPDATE_STEP_MS = 1000 / UPDATE_HZ;

/** A frame longer than this (tab was hidden, debugger paused, ...) is clamped so the loop does not spiral. */
export const MAX_FRAME_MS = 250;

/** Entering the next round, the player heals floor(maxHp * ratio). */
export const ROUND_CLEAR_HEAL_RATIO = 0.5;

/** Body and UI text: Jua, a rounded game-style Korean font (bundled, SIL OFL). It has one weight, so there is no bold. */
export const FONT_FAMILY = '"Jua", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
/** Titles, banners and big numbers: Black Han Sans, a heavy display font (bundled, SIL OFL). */
/** The "Dice Battle" logo only (Latin letters): Titan One, a very thick rounded arcade font (bundled, SIL OFL). */
export const FONT_LOGO = '"Titan One", "Black Han Sans", "Jua", sans-serif';
export const FONT_DISPLAY = '"Black Han Sans", "Jua", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

export const COLORS = {
  letterbox: '#05060a',
  background: '#141a2e',
  text: '#f4f1ea',
} as const;
