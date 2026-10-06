import { MAX_FRAME_MS, UPDATE_STEP_MS } from './constants';

export interface LoopCallbacks {
  /** Called once per fixed step with the step length in ms. While paused, dt is 0. */
  update(dtMs: number): void;
  /** Called once per animation frame. alpha (0..1) is how far we are into the next, not yet simulated step. */
  render(alpha: number): void;
}

export interface LoopOptions {
  stepMs?: number;
  maxFrameMs?: number;
  requestFrame?: (cb: (nowMs: number) => void) => number;
  cancelFrame?: (id: number) => void;
}

/** Fixed-step update with a variable-rate render. */
export class GameLoop {
  /** When true, update still runs on schedule but receives dt = 0, so every dt-driven timer freezes while render continues. */
  paused = false;

  private readonly stepMs: number;
  private readonly maxFrameMs: number;
  private readonly requestFrame: (cb: (nowMs: number) => void) => number;
  private readonly cancelFrame: (id: number) => void;
  private accumulator = 0;
  private lastTime: number | null = null;
  private rafId: number | null = null;

  constructor(
    private readonly callbacks: LoopCallbacks,
    options: LoopOptions = {},
  ) {
    this.stepMs = options.stepMs ?? UPDATE_STEP_MS;
    this.maxFrameMs = options.maxFrameMs ?? MAX_FRAME_MS;
    this.requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = null;
    const onFrame = (nowMs: number) => {
      this.frame(nowMs);
      this.rafId = this.requestFrame(onFrame);
    };
    this.rafId = this.requestFrame(onFrame);
  }

  stop(): void {
    if (this.rafId !== null) this.cancelFrame(this.rafId);
    this.rafId = null;
  }

  /** Advance by one animation frame. Exposed so tests can drive the loop with a fake clock. */
  frame(nowMs: number): void {
    if (this.lastTime === null) this.lastTime = nowMs;
    const frameMs = Math.min(Math.max(nowMs - this.lastTime, 0), this.maxFrameMs);
    this.lastTime = nowMs;
    this.accumulator += frameMs;

    while (this.accumulator >= this.stepMs) {
      this.callbacks.update(this.paused ? 0 : this.stepMs);
      this.accumulator -= this.stepMs;
    }
    this.callbacks.render(this.accumulator / this.stepMs);
  }
}
