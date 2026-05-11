import type { MonotonicClock, ProfilingEntry, StageProfiler } from "./types.js";

export class DefaultStageProfiler implements StageProfiler {
  readonly name: string;

  private readonly _clock: MonotonicClock;
  /** Full slash-separated path from the root, used as the key in entries(). */
  private readonly _fullPath: string;
  private _activeCount = 0;
  private _activeStart = 0;
  private _wallMs = 0;
  private _workMs = 0;
  private readonly _children: DefaultStageProfiler[] = [];

  constructor(name: string, clock: MonotonicClock, fullPath?: string) {
    this.name = name;
    this._clock = clock;
    this._fullPath = fullPath ?? name;
  }

  start(): void {
    if (this._activeCount > 0) return;
    this._wallMs = 0;
    this._workMs = 0;
    this._activeCount = 1;
    this._activeStart = this._clock();
  }

  resume(): void {
    if (this._activeCount === 0) {
      this._activeStart = this._clock();
    }
    this._activeCount++;
  }

  stop(): void {
    if (this._activeCount === 0) return;
    this._activeCount--;
    if (this._activeCount === 0) {
      this._wallMs += this._clock() - this._activeStart;
    }
  }

  private _addWorkMs(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this._workMs += ms;
  }

  measureWork<T>(fn: () => T): T {
    const startedAt = this._clock();
    try {
      const result = fn();
      if (this._isPromiseLike(result)) {
        return result.finally(() => {
          this._addWorkMs(this._clock() - startedAt);
        }) as T;
      }
      this._addWorkMs(this._clock() - startedAt);
      return result;
    } catch (error) {
      this._addWorkMs(this._clock() - startedAt);
      throw error;
    }
  }

  private _isPromiseLike<T>(value: T): value is T & Promise<unknown> {
    return typeof value === "object" && value !== null && "finally" in value;
  }

  createScopedProfiler(name: string): StageProfiler {
    // Escape `/` in caller-supplied name so the separator is unambiguous in full paths.
    const escapedName = name.replace(/\//g, "//");
    const childPath = `${this._fullPath}/${escapedName}`;
    const child = new DefaultStageProfiler(escapedName, this._clock, childPath);
    this._children.push(child);
    return child;
  }

  entries(): readonly ProfilingEntry[] {
    const currentWallMs =
      this._activeCount > 0 ? this._wallMs + (this._clock() - this._activeStart) : this._wallMs;

    const result: ProfilingEntry[] = [
      { name: this._fullPath, wallMs: currentWallMs, workMs: this._workMs },
    ];

    for (const child of this._children) {
      for (const entry of child.entries()) {
        result.push(entry);
      }
    }

    return result;
  }
}
