/** One screen of the game. Pointer coordinates are logical (1280x720). */
export interface Scene {
  /** Called once after the scene becomes current. */
  enter?(): void;
  /** Called once before the scene is replaced. */
  exit?(): void;
  /** Fixed-step update; dtMs is 0 while the loop is paused. */
  update(dtMs: number): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  onPointerDown?(x: number, y: number): void;
  onPointerMove?(x: number, y: number): void;
  onPointerUp?(x: number, y: number): void;
  /** The pointer sequence was interrupted (e.g. the window lost focus). */
  onPointerCancel?(): void;
  /** A key was pressed (`KeyboardEvent.key`, e.g. "Escape"). Key repeat is filtered out before this is called. */
  onKeyDown?(key: string): void;
}

/**
 * Owns the current scene, switches between scenes by name, and forwards update/render/pointer calls.
 * `Params` maps each scene name to the data it needs when it is created.
 */
export class SceneManager<Params extends Record<string, unknown>> {
  private factories = new Map<keyof Params, (params: never) => Scene>();
  private current: Scene | null = null;
  private currentName: keyof Params | null = null;

  register<K extends keyof Params>(name: K, factory: (params: Params[K]) => Scene): void {
    this.factories.set(name, factory as (params: never) => Scene);
  }

  go<K extends keyof Params>(name: K, ...args: Params[K] extends void ? [] : [Params[K]]): void {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown scene: ${String(name)}`);
    this.current?.exit?.();
    this.current = (factory as (params: unknown) => Scene)(args[0]);
    this.currentName = name;
    this.current.enter?.();
  }

  get name(): keyof Params | null {
    return this.currentName;
  }

  get scene(): Scene | null {
    return this.current;
  }

  update(dtMs: number): void {
    this.current?.update(dtMs);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.current?.render(ctx, alpha);
  }

  pointerDown(x: number, y: number): void {
    this.current?.onPointerDown?.(x, y);
  }

  pointerMove(x: number, y: number): void {
    this.current?.onPointerMove?.(x, y);
  }

  pointerUp(x: number, y: number): void {
    this.current?.onPointerUp?.(x, y);
  }

  pointerCancel(): void {
    this.current?.onPointerCancel?.();
  }

  keyDown(key: string): void {
    this.current?.onKeyDown?.(key);
  }
}
