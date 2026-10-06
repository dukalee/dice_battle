// Converts the original sprite PNGs (assets/characters/<Folder>/<character>_<pose>.png) into the smaller WebP
// copies the game loads (public/sprites/<character>_<pose>.webp). Originals are never modified.
//   node scripts/build-sprites.mjs          convert everything
//   node scripts/build-sprites.mjs --check  only verify that every expected original exists
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const config = JSON.parse(fs.readFileSync('src/data/sprites.json', 'utf8'));
const checkOnly = process.argv.includes('--check');
const outDir = 'public/sprites';

const jobs = [];
const missing = [];
for (const [character, def] of Object.entries(config.characters)) {
  for (const pose of Object.keys(def.poses)) {
    const src = path.join('assets/characters', def.folder, `${character}_${pose}.png`);
    const dest = path.join(outDir, `${character}_${pose}.webp`);
    if (fs.existsSync(src)) jobs.push({ src, dest });
    else missing.push(src);
  }
}
if (missing.length > 0) {
  console.error(`Missing ${missing.length} sprite(s):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`All ${jobs.length} original sprites found.`);
if (checkOnly) process.exit(0);

fs.mkdirSync(outDir, { recursive: true });
let totalIn = 0;
let totalOut = 0;
for (const { src, dest } of jobs) {
  await sharp(src)
    .resize(config.webpSize, config.webpSize, { fit: 'inside' })
    .webp({ quality: 85, alphaQuality: 90, effort: 5 })
    .toFile(dest);
  totalIn += fs.statSync(src).size;
  totalOut += fs.statSync(dest).size;
}
const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.log(`Converted ${jobs.length} sprites: ${mb(totalIn)} MB -> ${mb(totalOut)} MB (${config.webpSize}px WebP).`);
