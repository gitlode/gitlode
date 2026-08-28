const timingTokenBrand: unique symbol = Symbol("timingToken");
export type TimingToken = { readonly [timingTokenBrand]: true };
interface MutableTimingToken extends TimingToken {
  startMilliseconds: number | null;
  completed: boolean;
}
export type TimingCompletion =
  | { readonly firstCompletion: false }
  | { readonly firstCompletion: true; readonly durationSeconds: number | null };
export interface MonotonicTiming {
  start(enabled: boolean): TimingToken;
  complete(token: TimingToken): TimingCompletion;
}
const NOOP_TOKEN = Object.freeze({ [timingTokenBrand]: true }) as TimingToken;
const ALREADY_COMPLETED = Object.freeze({ firstCompletion: false }) as TimingCompletion;
export function createMonotonicTiming(
  clock: () => number = () => performance.now(),
): MonotonicTiming {
  return {
    start(enabled) {
      if (!enabled) return NOOP_TOKEN;
      let startMilliseconds: number | null = null;
      try {
        const value = clock();
        if (Number.isFinite(value)) startMilliseconds = value;
      } catch {
        // Clock failure makes only the duration unavailable; the token remains enabled.
      }
      return { [timingTokenBrand]: true, startMilliseconds, completed: false };
    },
    complete(token) {
      if (token === NOOP_TOKEN) return ALREADY_COMPLETED;
      const mutable = token as MutableTimingToken;
      if (mutable.completed) return ALREADY_COMPLETED;
      mutable.completed = true;
      if (mutable.startMilliseconds === null)
        return { firstCompletion: true, durationSeconds: null };
      try {
        const elapsed = clock() - mutable.startMilliseconds;
        if (!Number.isFinite(elapsed) || elapsed < 0)
          return { firstCompletion: true, durationSeconds: null };
        return {
          firstCompletion: true,
          durationSeconds: (Object.is(elapsed, -0) ? 0 : elapsed) / 1000,
        };
      } catch {
        return { firstCompletion: true, durationSeconds: null };
      }
    },
  };
}
