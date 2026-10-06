import { describe, expect, it } from 'vitest';
import { FONT_DISPLAY, FONT_FAMILY, FONT_LOGO } from '../core/constants';
import charset from '../assets/fonts/charset.txt?raw';

// Raw text of every non-test source file: these are the only places game text comes from.
const sources = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
// Only the file names matter here, so nothing is loaded.
const fontFiles = Object.keys(import.meta.glob('../assets/fonts/*.woff2')).map((p) => p.split('/').at(-1));

describe('bundled fonts', () => {
  it('names the game fonts first in the font stacks', () => {
    expect(FONT_FAMILY.startsWith('"Jua"')).toBe(true);
    expect(FONT_DISPLAY.startsWith('"Black Han Sans"')).toBe(true);
    expect(FONT_LOGO.startsWith('"Titan One"')).toBe(true);
  });

  it('ships both subsetted font files that fonts.css points to', () => {
    expect(fontFiles).toContain('jua.woff2');
    expect(fontFiles).toContain('blackhansans.woff2');
    expect(fontFiles).toContain('titanone.woff2');
  });

  it('covers every character the game source can draw (rerun `npm run fonts:build` if this fails)', () => {
    const have = new Set(charset);
    expect(have.size).toBeGreaterThan(200);
    const missing = new Map<string, string>();
    for (const [file, text] of Object.entries(sources)) {
      for (const ch of text) {
        if (ch >= ' ' && ch !== '\u007f' && !have.has(ch) && !missing.has(ch)) missing.set(ch, file);
      }
    }
    expect([...missing].map(([ch, file]) => `${ch} (${file})`)).toEqual([]);
  });

  it('includes every printable ASCII character and the Hangul used on the screens', () => {
    for (let c = 0x20; c <= 0x7e; c++) expect(charset).toContain(String.fromCharCode(c));
    for (const ch of '전사도적마법사선택공격회복일시정지설명서') expect(charset).toContain(ch);
  });
});
