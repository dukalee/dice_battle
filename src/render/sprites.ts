import type { CharacterId } from '../game/characters';
import spriteData from '../data/sprites.json';

export type PoseName = 'idle' | 'attack' | 'critical_attack' | 'heal' | 'critical_heal' | 'hit' | 'fail';
export type Facing = 'left' | 'right';

export interface PoseConfig {
  /** Display size relative to `baseDisplaySize`. Chosen so the character's head is about the same size in every pose. */
  scale: number;
  /** Torso centre as fractions (0..1) of the image. This point is drawn at the position the caller gives. */
  anchor: [number, number];
  /** Direction the character faces in the original image. */
  facing: Facing;
}

interface SpriteData {
  webpSize: number;
  baseDisplaySize: number;
  characters: Record<CharacterId, { folder: string; poses: Partial<Record<PoseName, PoseConfig>> }>;
}

const data = spriteData as unknown as SpriteData;

export const BASE_DISPLAY_SIZE = data.baseDisplaySize;

export function getPoseConfig(character: CharacterId, pose: PoseName): PoseConfig {
  const cfg = data.characters[character].poses[pose];
  if (!cfg) throw new Error(`${character} has no pose "${pose}"`);
  return cfg;
}

export function posesOf(character: CharacterId): PoseName[] {
  return Object.keys(data.characters[character].poses) as PoseName[];
}

export interface Placement {
  /** Drawn width and height in logical px. */
  size: number;
  /** Where to draw the image's top-left corner relative to the anchor point (before any flip). */
  dx: number;
  dy: number;
  /** Mirror horizontally around the anchor point. */
  flip: boolean;
}

/**
 * Where and how big to draw a pose so its anchor lands on the given point, facing `facing`.
 * The flip happens around the anchor, so flipped and unflipped sprites keep the same body position.
 */
export function placement(config: PoseConfig, facing: Facing, scaleMul = 1): Placement {
  const size = BASE_DISPLAY_SIZE * config.scale * scaleMul;
  return {
    size,
    dx: -config.anchor[0] * size,
    dy: -config.anchor[1] * size,
    flip: config.facing !== facing,
  };
}

export interface SpriteLibrary {
  image(character: CharacterId, pose: PoseName): HTMLImageElement;
}

export function spriteUrl(baseUrl: string, character: CharacterId, pose: PoseName): string {
  return `${baseUrl}sprites/${character}_${pose}.webp`;
}

/** Load every pose of every character. Resolves when all images are decoded. */
export async function loadSprites(baseUrl: string): Promise<SpriteLibrary> {
  const images = new Map<string, HTMLImageElement>();
  const jobs: Promise<void>[] = [];
  for (const character of Object.keys(data.characters) as CharacterId[]) {
    for (const pose of posesOf(character)) {
      const img = new Image();
      img.src = spriteUrl(baseUrl, character, pose);
      images.set(`${character}/${pose}`, img);
      jobs.push(img.decode().catch(() => Promise.reject(new Error(`Failed to load ${img.src}`))));
    }
  }
  await Promise.all(jobs);
  return {
    image(character, pose) {
      const img = images.get(`${character}/${pose}`);
      if (!img) throw new Error(`Sprite not loaded: ${character}/${pose}`);
      return img;
    },
  };
}

/** Draw a character pose with its torso centre at (x, y), facing `facing`. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteLibrary,
  character: CharacterId,
  pose: PoseName,
  x: number,
  y: number,
  facing: Facing,
  scaleMul = 1,
): void {
  const p = placement(getPoseConfig(character, pose), facing, scaleMul);
  ctx.save();
  ctx.translate(x, y);
  if (p.flip) ctx.scale(-1, 1);
  ctx.drawImage(sprites.image(character, pose), p.dx, p.dy, p.size, p.size);
  ctx.restore();
}
