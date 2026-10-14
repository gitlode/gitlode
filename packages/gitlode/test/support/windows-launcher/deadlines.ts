import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// hrtime uses the same monotonic origin across the nested Node processes.
export const now = () => Number(process.hrtime.bigint()) / 1e6;
export const remaining = (end: number, ceiling: number) =>
  Math.max(0, Math.min(ceiling, end - now()));
export function cutoff(end: number, ceiling: number, clock = now) {
  return Math.min(end, clock() + ceiling);
}
export async function until<T>(body: Promise<T>, end: number, phase: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      body,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${phase} deadline; retain root`)),
          remaining(end, Infinity),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function receipt(path: string, end: number, phase: string): Promise<unknown> {
  // No Promise.race loser: each read is joined before checking/scheduling the next poll.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), remaining(end, Infinity));
  try {
    for (;;) {
      if (now() >= end || abort.signal.aborted) throw new Error(`${phase} deadline; retain root`);
      try {
        const bytes = await readFile(path, { encoding: "utf8", signal: abort.signal });
        if (now() >= end) throw new Error(`${phase} deadline; retain root`);
        return JSON.parse(bytes) as unknown;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await delay(Math.min(10, remaining(end, Infinity)), undefined, { signal: abort.signal });
    }
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}
export async function settleCleanup(
  end: number,
  phases: Array<{ name: string; run: () => Promise<unknown> }>,
) {
  const errors: Error[] = [];
  for (const phase of phases) {
    try {
      await until(Promise.resolve().then(phase.run), end, phase.name);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error("cleanup failure"));
    }
  }
  if (errors.length) throw new AggregateError(errors, "cleanup uncertainty; retain root");
}
export const errorIdentity = (error: unknown): unknown =>
  error instanceof Error
    ? {
        name: error.name,
        message: error.message.slice(0, 240),
        ...(error instanceof AggregateError ? { secondary: error.errors.map(errorIdentity) } : {}),
      }
    : { name: "UnknownError" };
