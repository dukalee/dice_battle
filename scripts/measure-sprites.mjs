// Dev helper: prints the opaque bounding box of each original sprite as fractions of the image (0..1).
// Used to pick a starting size/foot position for src/data/sprites.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = 'assets/characters';
const threshold = Number(process.argv[2] ?? 160);
for (const folder of fs.readdirSync(root)) {
  for (const file of fs.readdirSync(path.join(root, folder)).filter((f) => f.endsWith('.png')).sort()) {
    const { data, info } = await sharp(path.join(root, folder, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] >= threshold) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const f = (v, n) => +(v / n).toFixed(3);
    console.log(file.padEnd(28), 'L', f(minX, info.width), 'R', f(maxX + 1, info.width), 'T', f(minY, info.height), 'B', f(maxY + 1, info.height));
  }
}
