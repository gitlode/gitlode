export type WallClock = () => Date;
export type MonotonicClock = () => number;

/**
 * A named, accumulating timer that supports hierarchical scoping.
 *
 * ## Lifecycle
 * - `start()`: Resets wall/work durations to 0 and begins wall timing. No-op if already running.
 * - `resume()`: Begins accumulating without resetting. No-op if already running.
 * - `stop()`: Pauses accumulation. No-op if not running.
 * - `measureWork(fn)`: Measures one work interval and adds it to additive work time.
 * - `entries()`: Returns a snapshot of this profiler and all descendants in preorder.
 *   If called while running, includes elapsed time up to the current moment.
 *
 * ## Tree structure
 * Each profiler may have child profilers created via `createScopedProfiler()`.
 * Parent and child durations are completely independent: a parent's times are
 * determined solely by its own `start/resume/stop` calls, not by its children.
 * Siblings are ordered by creation order.
 *
 * ## Concurrency
 * Sharing a single profiler instance across concurrent async operations is not
 * recommended. Unexpected interleaving of `resume/stop` calls may produce inaccurate
 * measurements, but will not throw exceptions or affect the main extraction process.
 * Wall-clock timing is reference-count based so overlapping intervals are counted once.
 * Additive work timing should be recorded via `measureWork(...)`.
 *
 * ## Error tolerance
 * All methods are designed to be safe to call in any order. Unexpected call sequences
 * (e.g., `stop()` when not running) are silently treated as no-ops.
 */

export interface StageProfiler {
  /** The local name segment of this profiler (not the full path). */
  readonly name: string;
  /** Resets accumulated duration to 0 and begins timing. No-op if already running. */
  start(): void;
  /** Resumes timing without resetting accumulated duration. No-op if already running. */
  resume(): void;
  /** Pauses timing and adds elapsed duration to the accumulator. No-op if not running. */
  stop(): void;
  /**
   * Measures execution time of `fn` and adds it to additive work duration.
   * Works with both sync and async functions.
   */
  measureWork<T>(fn: () => T): T;
  /**
   * Creates and registers a new child profiler with the given name.
   * The child's full path in `entries()` is `parent_path/child_name`.
   * Children are listed in creation order in `entries()`.
   * If `name` contains `/`, it is escaped as `//` in the full path.
   */
  createScopedProfiler(name: string): StageProfiler;
  /**
   * Returns profiling entries for this profiler and all descendants in preorder
   * (self first, then each child's subtree in creation order).
   * Each entry's `name` is the full slash-separated path from the root.
   * If this profiler is currently running, `wallMs` includes time up to now.
   */
  entries(): readonly ProfilingEntry[];
} // Compatibility aliases removed in Phase 7 cleanup
/** A single timing measurement produced by a {@link StageProfiler}. */

export interface ProfilingEntry {
  /** Full slash-separated path from the root, e.g. `"elapsed/traversal"`. */
  readonly name: string;
  /** Wall-clock duration in milliseconds (parallel overlap counted once). */
  readonly wallMs: number;
  /** Additive work duration in milliseconds (parallel overlap counted per interval). */
  readonly workMs: number;
}
