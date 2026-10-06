import { FONT_DISPLAY, FONT_FAMILY, FONT_LOGO } from '../core/constants';

/** Wait until both game fonts are ready, so the first frame of canvas text already uses them. */
export async function loadFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load(`32px ${FONT_FAMILY}`, '가Aa1'),
    document.fonts.load(`32px ${FONT_DISPLAY}`, '가Aa1'),
    document.fonts.load(`32px ${FONT_LOGO}`, 'Dice Battle'),
  ]);
  await document.fonts.ready;
}
