import type { StageProfiler } from "../types.js";

/**
 * Runs a synchronous task with optional wall/work profiling.
 * If no profiler is provided, executes the task directly.
 */
export function withProfiler<T>(profiler: StageProfiler | undefined, task: () => T): T {
  if (!profiler) return task();
  profiler.resume();
  try {
    return profiler.measureWork(task);
  } finally {
    profiler.stop();
  }
}

/**
 * Runs an asynchronous task with optional wall/work profiling.
 * If no profiler is provided, executes the task directly.
 */
export async function withProfilerAsync<T>(
  profiler: StageProfiler | undefined,
  task: () => Promise<T>,
): Promise<T> {
  if (!profiler) return await task();
  profiler.resume();
  try {
    return await profiler.measureWork(task);
  } finally {
    profiler.stop();
  }
}
