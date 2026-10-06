import type { SceneManager } from '../core/scene';
import type { CharacterId } from '../game/characters';
import type { PoseName, SpriteLibrary } from '../render/sprites';

/** The data each scene needs when it is created. `void` means none. */
export type SceneParams = {
  title: void;
  help: void;
  characterSelect: void;
  game: { character: CharacterId };
  gameOver: { round: number; character: CharacterId };
  /** Development only: check sprite alignment. */
  spritePreview: { view: 'grid' | 'duel'; player: CharacterId; enemy: CharacterId; pose: PoseName };
};

/** Shared things every scene may use. */
export interface AppContext {
  sprites: SpriteLibrary;
  manager: SceneManager<SceneParams>;
  /** The page's query string; scenes read `?seed=` through it to create the game RNG. */
  search: string;
  /** Freeze (true) or resume (false) the game loop's update time. Rendering continues while frozen. */
  setPaused(paused: boolean): void;
}
