import './fonts.css';
import { COLORS, FONT_FAMILY, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './core/constants';
import { attachPointerInput } from './core/input';
import { GameLoop } from './core/loop';
import { SceneManager } from './core/scene';
import { CHARACTER_IDS, type CharacterId } from './game/characters';
import { setupCanvas } from './render/canvas';
import { loadFonts } from './render/fonts';
import { warmUpEffects } from './render/warmup';
import { loadSprites, type PoseName } from './render/sprites';
import { CharacterSelectScene } from './scenes/characterSelectScene';
import { GameOverScene } from './scenes/gameOverScene';
import { GameScene } from './scenes/gameScene';
import { HelpScene } from './scenes/helpScene';
import { SpritePreviewScene } from './scenes/spritePreviewScene';
import { TitleScene } from './scenes/titleScene';
import type { AppContext, SceneParams } from './scenes/types';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas not found');

const game = setupCanvas(canvas);
const manager = new SceneManager<SceneParams>();
const search = window.location.search;

const loop = new GameLoop({
  update: (dt) => manager.update(dt),
  render: (alpha) => {
    if (manager.scene) manager.render(game.ctx, alpha);
  },
});

function showMessage(text: string): void {
  game.ctx.fillStyle = COLORS.background;
  game.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  game.ctx.fillStyle = COLORS.text;
  game.ctx.font = `36px ${FONT_FAMILY}`;
  game.ctx.textAlign = 'center';
  game.ctx.textBaseline = 'middle';
  game.ctx.fillText(text, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
}

const asCharacter = (value: string | null, fallback: CharacterId): CharacterId =>
  CHARACTER_IDS.includes(value as CharacterId) ? (value as CharacterId) : fallback;

async function start(): Promise<void> {
  showMessage('불러오는 중...');
  // Canvas text falls back to another font if a web font is not ready yet, so wait for both fonts and the sprites.
  const [sprites] = await Promise.all([loadSprites(import.meta.env.BASE_URL), loadFonts()]);
  warmUpEffects(); // pay the first-use cost of big effect text now, not in the middle of a throw
  const app: AppContext = {
    sprites,
    manager,
    search,
    setPaused: (paused) => {
      loop.paused = paused;
    },
  };

  manager.register('title', () => new TitleScene(app));
  manager.register('help', () => new HelpScene(app));
  manager.register('characterSelect', () => new CharacterSelectScene(app));
  manager.register('game', (params) => new GameScene(app, params));
  manager.register('gameOver', (params) => new GameOverScene(app, params));
  manager.register('spritePreview', (params) => new SpritePreviewScene(app, params));

  attachPointerInput(canvas as HTMLCanvasElement, () => game.viewport, {
    pointerDown: (x, y) => manager.pointerDown(x, y),
    pointerMove: (x, y) => manager.pointerMove(x, y),
    pointerUp: (x, y) => manager.pointerUp(x, y),
    pointerCancel: () => manager.pointerCancel(),
  });

  // Keyboard: held keys do not repeat, and Escape never reaches the browser's own handling.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape') e.preventDefault();
    manager.keyDown(e.key);
  });

  // Development shortcuts: ?scene=sprites / ?scene=game&p=mage jump straight to a screen.
  const query = new URLSearchParams(search);
  const jump = import.meta.env.DEV ? query.get('scene') : null;
  if (jump === 'sprites') {
    manager.go('spritePreview', {
      view: query.get('view') === 'duel' ? 'duel' : 'grid',
      player: asCharacter(query.get('p'), 'warrior'),
      enemy: asCharacter(query.get('e'), 'mage'),
      pose: (query.get('pose') as PoseName | null) ?? 'idle',
    });
  } else if (jump === 'game') {
    manager.go('game', { character: asCharacter(query.get('p'), 'warrior') });
  } else {
    manager.go('title');
  }
  loop.start();

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__dicebattle = { loop, manager, canvas, app };
  }
}

start().catch((err) => {
  console.error(err);
  showMessage('불러오기에 실패했습니다');
});
