import { LOGICAL_WIDTH, ROUND_CLEAR_HEAL_RATIO } from '../core/constants';
import { approach } from '../core/math';
import { createGameRng } from '../core/random';
import type { Scene } from '../core/scene';
import { Sequencer } from '../core/sequence';
import { Battle, type BattleEvent, type Combatant, type Side } from '../game/battle';
import { CHARACTERS } from '../game/characters';
import { formatEventLine } from '../game/messages';
import { createRng } from '../game/rng';
import { splitRolls, type Action } from '../game/rules';
import { drawBackground, drawFloor, drawPlatform, STAGE_Y } from '../render/background';
import { drawBanner, drawExplanation, type ActiveBanner, type BannerTone } from '../render/banner';
import { DiceTray, type DiceResult } from '../render/diceTray';
import { drawSprite, type PoseName } from '../render/sprites';
import { drawText, roundRectPath } from '../render/text';
import { drawPanel, ACCENT } from '../render/ui/theme';
import { Button, BUTTON_STYLES } from '../render/ui/button';
import { ButtonGroup } from '../render/ui/buttonGroup';
import { drawHud, drawRoundBadge } from '../render/ui/hud';
import { drawLogWindow, LogBuffer } from '../render/ui/logWindow';
import { describeTurn, type TurnPlan } from './turnPlan';
import type { AppContext, SceneParams } from './types';

const PLAYER_X = 330;
const ENEMY_X = 950;
const BODY_Y = 350; // where each character's torso centre is drawn
const HP_BAR_SPEED = 90; // HP per second the bars move

// Presentation timing, all in game time (so Pause freezes it).
const EXPLAIN_MS = 1700; // special result: the dice pop one by one and the effect is explained, before anything happens
const ACTOR_POSE_MS = 350; // the actor strikes a pose, the banner pops in
const IMPACT_MS = 750; // the result lands: HP bars, log, hit pose
const RECOVER_MS = 450; // back to idle before the next turn
const BEFORE_AI_MS = 600; // a breath between the player's result and the AI's turn
const ANNOUNCE_MS = 1000; // the AI says what it picked
const BANNER_MS = 1800;
const ROUND_CLEAR_MS = 1900;
const HIT_SHAKE_MS = 450;
const GAME_OVER_DELAY_MS = 2400;

const PLAYER_HUD = { x: 24, y: 12, w: 500, h: 82 };
const ENEMY_HUD = { x: 756, y: 12, w: 500, h: 82 };
const LOG_RECT = { x: 290, y: 520, w: 700, h: 92 };
// The dice area sits exactly between the Pause button (bottom edge y = 130) and the log (top edge y = 520): 60 px above and below.
const TRAY_RECT = { x: 460, y: 190, w: 360, h: 270 };

/**
 * choose:  the player may pick attack or heal
 * throw:   an action is picked, the dice area waits for the throw
 * busy:    dice rolling, a result being shown, or the AI acting. All input is ignored.
 * ended:   someone's HP hit 0 and the player lost; no input
 */
type Mode = 'choose' | 'throw' | 'busy' | 'ended';

export class GameScene implements Scene {
  readonly battle: Battle;
  readonly log = new LogBuffer();
  readonly tray: DiceTray;

  /**
   * What the screen shows. The battle already knows the result the moment the dice are thrown, but the HP bars,
   * ROUND and enemy must not reveal it early, so this is only updated from events once the result is presented.
   */
  readonly view: { round: number; player: Combatant; enemy: Combatant };
  readonly poses: Record<Side, PoseName> = { player: 'idle', enemy: 'idle' };
  banner: ActiveBanner | null = null;
  /** The explanation of a special result, shown in the dice area before the critical move happens. */
  explain: ActiveBanner | null = null;
  /** The turn currently being shown (kept for inspection in dev). */
  lastPlan: TurnPlan | null = null;
  mode: Mode = 'choose';
  /** The pause menu is open. While true the loop's update time is frozen and only the menu takes input. */
  paused = false;

  private readonly seq = new Sequencer();
  private pendingAction: Action = 'attack';
  /** The turn whose dice are rolling. */
  private pending: TurnPlan | null = null;
  private rollingFor: Side | null = null;
  private bubble: { text: string; ms: number } | null = null;
  private hitMs: Record<Side, number> = { player: 0, enemy: 0 };
  private shownHp: { player: number; enemy: number };
  private gameOverTimerMs: number | null = null;
  /** Game time since the scene began (ms). Drives the background and stage animation; frozen while paused. */
  private clock = 0;

  private readonly attackButton: Button;
  private readonly healButton: Button;
  private readonly pauseButton: Button;
  private readonly buttons: ButtonGroup;
  private readonly pauseMenu: ButtonGroup;

  constructor(
    private readonly app: AppContext,
    private readonly params: SceneParams['game'],
  ) {
    this.battle = new Battle(params.character, createGameRng(app.search));
    const s = this.battle.state;
    this.view = { round: s.round, player: { ...s.player }, enemy: { ...s.enemy } };
    this.shownHp = { player: s.player.hp, enemy: s.enemy.hp };
    this.log.push(`ROUND ${s.round} 시작! 상대는 ${CHARACTERS[s.enemy.id].name}`);

    // The dice tray only decides how things look. Its own random source is separate from the game's,
    // so how long the player holds can never change which numbers come up.
    const cosmeticRng = createRng((Math.random() * 0x100000000) >>> 0);
    this.tray = new DiceTray(TRAY_RECT, cosmeticRng, {
      onRelease: () => this.onThrow(),
      onSettled: () => this.onDiceSettled(),
    });

    this.attackButton = new Button({ x: 400, y: 628, w: 220, h: 68 }, '공격', () => this.chooseAction('attack'), {
      ...BUTTON_STYLES.red,
      fontSize: 34,
    });
    this.healButton = new Button({ x: 660, y: 628, w: 220, h: 68 }, '회복', () => this.chooseAction('heal'), {
      ...BUTTON_STYLES.green,
      fontSize: 34,
    });
    this.pauseButton = new Button({ x: (LOGICAL_WIDTH - 160) / 2, y: 86, w: 160, h: 44 }, 'Pause', () => this.setPaused(true), {
      ...BUTTON_STYLES.blue,
      fontSize: 24,
    });
    this.buttons = new ButtonGroup([this.attackButton, this.healButton, this.pauseButton]);

    const menuX = (LOGICAL_WIDTH - 300) / 2;
    this.pauseMenu = new ButtonGroup([
      new Button({ x: menuX, y: 282, w: 300, h: 64 }, '이어하기', () => this.setPaused(false), { ...BUTTON_STYLES.gold, fontSize: 30 }),
      new Button({ x: menuX, y: 362, w: 300, h: 64 }, '재시작', () => this.app.manager.go('characterSelect'), { ...BUTTON_STYLES.blue, fontSize: 30 }),
      new Button({ x: menuX, y: 442, w: 300, h: 64 }, '타이틀', () => this.app.manager.go('title'), { ...BUTTON_STYLES.blue, fontSize: 30 }),
    ]);
  }

  // ---- pause -----------------------------------------------------------------------------------------------

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.app.setPaused(paused);
    this.buttons.cancel();
    this.pauseMenu.cancel();
    this.tray.pointerCancel();
  }

  /** Leaving the game (restart, title, game over) must never leave the loop frozen. */
  exit(): void {
    if (this.paused) this.setPaused(false);
  }

  // ---- the turn, step by step ------------------------------------------------------------------------------

  private beginChoose(): void {
    this.tray.clear();
    this.mode = 'choose';
  }

  /** The player picked attack or heal: the dice area wakes up and waits for the throw. */
  private chooseAction(action: Action): void {
    if (this.mode !== 'choose') return;
    this.pendingAction = action;
    this.mode = 'throw';
    this.tray.enable(CHARACTERS[this.view.player.id].diceCount);
  }

  /** The player let go of the dice area. The faces are decided now by the battle's seeded RNG, never by the hold time. */
  private onThrow(): DiceResult | null {
    if (this.mode !== 'throw') return null;
    const plan = describeTurn(this.battle.playerAction(this.pendingAction));
    this.pending = plan;
    this.rollingFor = 'player';
    this.mode = 'busy';
    return splitRolls(plan.outcome);
  }

  /** Every die stopped: now the result is presented. */
  private onDiceSettled(): void {
    const plan = this.pending;
    if (!plan) return;
    this.pending = null;
    this.presentResult(plan);
  }

  /**
   * A special result (Critical! or FAIL!) first highlights the dice and explains the effect, and only then does the move
   * happen. After that, for every result: pose and banner, then the impact (HP bars, log, hit pose), then back to idle,
   * then on to whatever comes next. Heals work the same way.
   */
  private presentResult(plan: TurnPlan): void {
    this.lastPlan = plan;
    const banner = plan.banner;
    const steps = [];
    if (banner) {
      steps.push({
        ms: EXPLAIN_MS,
        start: () => {
          this.tray.startHighlight();
          this.explain = { text: '', detail: banner.detail, tone: banner.tone, age: 0, life: EXPLAIN_MS };
        },
        end: () => {
          this.tray.stopHighlight();
          this.explain = null;
        },
      });
    }
    steps.push(
      {
        ms: ACTOR_POSE_MS,
        start: () => {
          this.poses[plan.actor] = plan.actorPose;
          if (banner) this.showBanner(banner.text, '', banner.tone, BANNER_MS);
        },
      },
      {
        ms: IMPACT_MS,
        start: () => {
          this.apply(plan.events);
          if (plan.victim) {
            this.poses[plan.victim] = 'hit';
            this.hitMs[plan.victim] = HIT_SHAKE_MS;
          }
        },
      },
      {
        ms: RECOVER_MS,
        start: () => {
          // whoever went down stays down (hit / fail); everyone else gets back on their feet
          if (plan.defeated !== plan.actor) this.poses[plan.actor] = 'idle';
          if (plan.victim && plan.defeated !== plan.victim) this.poses[plan.victim] = 'idle';
        },
      },
      { ms: 0, end: () => this.afterTurn(plan) },
    );
    this.seq.run(steps);
  }

  private afterTurn(plan: TurnPlan): void {
    if (plan.ending === 'gameOver') {
      this.mode = 'ended';
      return;
    }
    if (plan.ending === 'roundCleared') {
      const p = this.view.player;
      const gain = Math.min(Math.floor(p.maxHp * ROUND_CLEAR_HEAL_RATIO), p.maxHp - p.hp);
      this.seq.run([
        {
          ms: ROUND_CLEAR_MS,
          start: () =>
            this.showBanner(
              `ROUND ${this.view.round} CLEAR!`,
              gain > 0 ? `다음 ROUND에서 HP ${gain} 회복` : 'HP가 가득 차 있습니다',
              'info',
              ROUND_CLEAR_MS,
            ),
        },
        { ms: 0, end: () => this.startNextRound() },
      ]);
      return;
    }
    if (plan.actor === 'player') {
      this.seq.run([{ ms: BEFORE_AI_MS }, { ms: 0, end: () => this.startEnemyTurn() }]);
    } else {
      this.beginChoose();
    }
  }

  /** The AI picks at random (inside the battle), shows its choice, then its dice roll by themselves. */
  private startEnemyTurn(): void {
    const plan = describeTurn(this.battle.enemyAction());
    const word = plan.action === 'attack' ? '공격' : '회복';
    this.tray.clear();
    this.seq.run([
      {
        ms: ANNOUNCE_MS,
        start: () => {
          this.bubble = { text: `${word}!`, ms: ANNOUNCE_MS };
          this.log.push(`상대는 ${word}을 선택했다!`, 'info');
        },
      },
      {
        ms: 0,
        end: () => {
          this.pending = plan;
          this.rollingFor = 'enemy';
          this.tray.rollAuto(splitRolls(plan.outcome));
        },
      },
    ]);
  }

  private startNextRound(): void {
    this.apply(this.battle.startNextRound());
    this.shownHp.enemy = 0; // the new enemy's bar fills up
    this.poses.player = 'idle';
    this.poses.enemy = 'idle';
    this.beginChoose();
  }

  private showBanner(text: string, detail: string, tone: BannerTone, life: number): void {
    this.banner = { text, detail, tone, age: 0, life };
  }

  /** Put events on the screen: the log, and the visible HP / ROUND / enemy. */
  private apply(events: BattleEvent[]): void {
    for (const event of events) {
      const line = formatEventLine(event);
      if (line) this.log.push(line.text, line.kind);
      switch (event.type) {
        case 'damaged':
        case 'healed':
          this.view[event.target].hp = event.hpAfter;
          break;
        case 'selfKO':
          this.view[event.actor].hp = 0;
          break;
        case 'selfDamaged':
          this.view[event.actor].hp = event.hpAfter;
          break;
        case 'roundStarted': {
          const maxHp = CHARACTERS[event.enemy].maxHp;
          this.view.round = event.round;
          this.view.enemy = { id: event.enemy, hp: maxHp, maxHp };
          break;
        }
        case 'gameOver':
          this.gameOverTimerMs = GAME_OVER_DELAY_MS;
          break;
        default:
          break;
      }
    }
  }

  // ---- update / render -------------------------------------------------------------------------------------

  update(loopDtMs: number): void {
    // The loop already passes 0 while paused; this keeps the scene frozen even if it is ever called with real time.
    const dtMs = this.paused ? 0 : loopDtMs;
    const v = this.view;
    this.shownHp.player = approach(this.shownHp.player, v.player.hp, HP_BAR_SPEED, dtMs);
    this.shownHp.enemy = approach(this.shownHp.enemy, v.enemy.hp, HP_BAR_SPEED, dtMs);

    this.clock += dtMs;
    this.tray.update(dtMs);
    this.seq.update(dtMs);

    if (this.explain) this.explain.age += dtMs;
    if (this.banner) {
      this.banner.age += dtMs;
      if (this.banner.age >= this.banner.life) this.banner = null;
    }
    if (this.bubble) {
      this.bubble.ms -= dtMs;
      if (this.bubble.ms <= 0) this.bubble = null;
    }
    for (const side of ['player', 'enemy'] as const) this.hitMs[side] = Math.max(0, this.hitMs[side] - dtMs);

    const canChoose = this.mode === 'choose';
    this.attackButton.enabled = canChoose;
    this.healButton.enabled = canChoose;

    if (this.gameOverTimerMs !== null) {
      this.gameOverTimerMs -= dtMs;
      if (this.gameOverTimerMs <= 0) {
        this.app.manager.go('gameOver', { round: this.view.round, character: this.params.character });
      }
    }
  }

  private trayCaption(): string {
    if (this.mode === 'throw') return this.pendingAction === 'attack' ? '공격' : '회복';
    if (this.rollingFor) return this.rollingFor === 'player' ? '내 주사위' : '상대의 주사위';
    return '';
  }

  /** A quick horizontal shake that dies down after a hit. */
  private shakeOffset(side: Side): number {
    const left = this.hitMs[side];
    if (left <= 0) return 0;
    return Math.sin(left * 0.08) * 12 * (left / HIT_SHAKE_MS);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.view;
    drawBackground(ctx, this.clock);
    drawFloor(ctx);
    drawPlatform(ctx, PLAYER_X, STAGE_Y, 150, ACCENT.blue, this.clock);
    drawPlatform(ctx, ENEMY_X, STAGE_Y, 150, ACCENT.red, this.clock);
    drawSprite(ctx, this.app.sprites, s.player.id, this.poses.player, PLAYER_X + this.shakeOffset('player'), BODY_Y, 'right');
    drawSprite(ctx, this.app.sprites, s.enemy.id, this.poses.enemy, ENEMY_X + this.shakeOffset('enemy'), BODY_Y, 'left');

    // the HUD goes on top of the characters, so big critical effects never cover the HP bars
    drawHud(ctx, this.app.sprites, {
      rect: PLAYER_HUD,
      side: 'left',
      character: s.player.id,
      name: CHARACTERS[s.player.id].name,
      tag: '유저',
      shown: this.shownHp.player,
      hp: s.player.hp,
      max: s.player.maxHp,
    });
    drawHud(ctx, this.app.sprites, {
      rect: ENEMY_HUD,
      side: 'right',
      character: s.enemy.id,
      name: CHARACTERS[s.enemy.id].name,
      tag: '상대',
      shown: this.shownHp.enemy,
      hp: s.enemy.hp,
      max: s.enemy.maxHp,
    });
    drawRoundBadge(ctx, LOGICAL_WIDTH / 2, 38, `ROUND ${s.round}`);
    this.pauseButton.draw(ctx);

    this.tray.draw(ctx, this.banner || this.explain ? '' : this.trayCaption());
    if (this.explain) drawExplanation(ctx, TRAY_RECT, this.explain.detail, this.explain.tone, this.explain.age);
    if (this.bubble) this.drawBubble(ctx, this.bubble.text);
    if (this.banner) drawBanner(ctx, this.banner);
    drawLogWindow(ctx, LOG_RECT, this.log, 3);
    this.attackButton.draw(ctx);
    this.healButton.draw(ctx);
    if (this.paused) this.drawPauseMenu(ctx);
  }

  private drawPauseMenu(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.7)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, 720);
    ctx.restore();
    drawPanel(ctx, { x: (LOGICAL_WIDTH - 420) / 2, y: 180, w: 420, h: 384 }, { radius: 24, border: ACCENT.gold, borderWidth: 3, glow: 'rgba(245,197,66,0.5)' });
    drawText(ctx, '일시정지', LOGICAL_WIDTH / 2, 232, { size: 44, display: true, align: 'center', baseline: 'middle', color: '#f5c542' });
    this.pauseMenu.draw(ctx);
    drawText(ctx, 'ESC 키로도 열고 닫을 수 있어요', LOGICAL_WIDTH / 2, 538, { size: 18, align: 'center', baseline: 'middle', color: '#c9d0f0' });
  }

  /** The AI's speech bubble above its head. */
  private drawBubble(ctx: CanvasRenderingContext2D, text: string): void {
    const w = 170;
    const h = 64;
    const x = ENEMY_X - w / 2;
    const y = 128;
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ENEMY_X - 14, y + h - 2);
    ctx.lineTo(ENEMY_X + 14, y + h - 2);
    ctx.lineTo(ENEMY_X, y + h + 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawText(ctx, text, ENEMY_X, y + h / 2, { size: 38, display: true, align: 'center', baseline: 'middle', color: '#23264a' });
  }

  onPointerDown(x: number, y: number): void {
    if (this.paused) {
      this.pauseMenu.pointerDown(x, y);
      return;
    }
    if (this.tray.pointerDown(x, y)) return;
    this.buttons.pointerDown(x, y);
  }
  onPointerMove(x: number, y: number): void {
    if (this.paused) this.pauseMenu.pointerMove(x, y);
    else this.buttons.pointerMove(x, y);
  }
  onPointerUp(x: number, y: number): void {
    if (this.paused) {
      this.pauseMenu.pointerUp(x, y);
      return;
    }
    this.tray.pointerUp();
    this.buttons.pointerUp(x, y);
  }
  /** Escape opens the pause menu, and closes it again. */
  onKeyDown(key: string): void {
    if (key === 'Escape') this.setPaused(!this.paused);
  }
  onPointerCancel(): void {
    this.tray.pointerCancel();
    this.buttons.cancel();
    this.pauseMenu.cancel();
  }
}
