// Builds the small WOFF2 fonts the game loads (src/assets/fonts/*.woff2) from the full OFL font files in assets/fonts.
// Only the characters that appear in the game's source (plus printable ASCII) are kept, which turns ~3 MB of Hangul
// glyphs into a few tens of KB. Run it again whenever new text is added to src/ (a test fails if a character is missing).
import fs from 'node:fs';
import path from 'node:path';
import subsetFont from 'subset-font';

const FONTS = [
  { source: 'assets/fonts/Jua-Regular.ttf', out: 'src/assets/fonts/jua.woff2' },
  { source: 'assets/fonts/BlackHanSans-Regular.ttf', out: 'src/assets/fonts/blackhansans.woff2' },
  { source: 'assets/fonts/TitanOne-Regular.ttf', out: 'src/assets/fonts/titanone.woff2' },
];
const CHARSET_FILE = 'src/assets/fonts/charset.txt';

function sourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(p));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(p);
  }
  return files;
}

const chars = new Set();
for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
for (const file of sourceFiles('src')) {
  for (const ch of fs.readFileSync(file, 'utf8')) if (ch >= ' ' && ch !== '\u007f') chars.add(ch);
}
const text = [...chars].sort().join('');

fs.mkdirSync(path.dirname(CHARSET_FILE), { recursive: true });
fs.writeFileSync(CHARSET_FILE, text);
for (const { source, out } of FONTS) {
  const subset = await subsetFont(fs.readFileSync(source), text, { targetFormat: 'woff2' });
  fs.writeFileSync(out, subset);
  console.log(`${path.basename(out)}: ${(fs.statSync(source).size / 1024).toFixed(0)} KB -> ${(subset.length / 1024).toFixed(1)} KB`);
}
console.log(`${chars.size} distinct characters.`);
