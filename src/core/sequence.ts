export interface SequenceStep {
  /** How long the step lasts, in game time (ms). */
  ms: number;
  /** Called when the step begins. */
  start?: () => void;
  /** Called when the step's time is up, before the next step begins. */
  end?: () => void;
}

/**
 * Runs steps one after another. Time only advances through `update(dtMs)`, so a paused loop (dt = 0)
 * freezes the sequence exactly where it is. Callbacks may add more steps with `run`.
 */
export class Sequencer {
  private queue: SequenceStep[] = [];
  private current: SequenceStep | null = null;
  private remaining = 0;

  /** True while a step is running or more are waiting. */
  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Append steps to run after everything already queued. */
  run(steps: SequenceStep[]): void {
    this.queue.push(...steps);
  }

  clear(): void {
    this.queue = [];
    this.current = null;
    this.remaining = 0;
  }

  update(dtMs: number): void {
    if (dtMs <= 0) return;
    let budget = dtMs;
    for (;;) {
      if (this.current === null) {
        const next = this.queue.shift();
        if (!next) return;
        this.current = next;
        this.remaining = next.ms;
        next.start?.();
      }
      if (this.remaining > budget) {
        this.remaining -= budget;
        return;
      }
      budget -= this.remaining;
      const done = this.current;
      this.current = null;
      this.remaining = 0;
      done.end?.();
    }
  }
}
