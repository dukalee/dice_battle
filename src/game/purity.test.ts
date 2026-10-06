import { describe, expect, it } from 'vitest';

// Raw source text of every non-test module in src/game (loaded through Vite, so no Node types are needed).
const sources = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Rule logic must stay free of the DOM, Canvas, timers and the rendering layers, so it can be tested with seeded dice. */
describe('src/game is pure', () => {
  it('has source files to check', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  for (const [file, raw] of Object.entries(sources)) {
    it(`${file} does not use the DOM, Canvas, timers or rendering layers`, () => {
      // ignore comments so documentation can mention these words
      const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const forbidden = [
        /\bdocument\b/,
        /\bwindow\b/,
        /\bHTML\w*Element\b/,
        /\bCanvasRenderingContext2D\b/,
        /\brequestAnimationFrame\b/,
        /\bsetTimeout\b/,
        /\bsetInterval\b/,
        /\bperformance\.now\b/,
        /\bDate\.now\b/,
        /\bMath\.random\b/,
        /from\s+['"]\.\.\/(render|scenes|core\/loop)/,
      ];
      for (const pattern of forbidden) expect(text).not.toMatch(pattern);
    });
  }
});
