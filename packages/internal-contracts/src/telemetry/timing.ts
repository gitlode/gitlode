const timingTokenBrand: unique symbol = Symbol("timingToken");
export type TimingToken = { readonly [timingTokenBrand]: true };
interface MutableTimingToken extends TimingToken {
  startMilliseconds: number;
  completed: boolean;
}
export type TimingCompletion =
  | { readonly recordable: true; readonly durationSeconds: number }
  | { readonly recordable: false };
export interface MonotonicTiming {
  start(enabled: boolean): TimingToken;
  complete(token: TimingToken): TimingCompletion;
}
const NOOP_TOKEN = Object.freeze({ [timingTokenBrand]: true }) as TimingToken;
const NOT_RECORDABLE = Object.freeze({ recordable: false }) as TimingCompletion;
export function createMonotonicTiming(
  clock: () => number = () => performance.now(),
): MonotonicTiming {
  return {
    start(enabled) {
      if (!enabled) return NOOP_TOKEN;
      try {
        const startMilliseconds = clock();
        if (!Number.isFinite(startMilliseconds)) return NOOP_TOKEN;
        return { [timingTokenBrand]: true, startMilliseconds, completed: false };
      } catch {
        return NOOP_TOKEN;
      }
    },
    complete(token) {
      if (token === NOOP_TOKEN) return NOT_RECORDABLE;
      const mutable = token as MutableTimingToken;
      if (mutable.completed) return NOT_RECORDABLE;
      mutable.completed = true;
      try {
        const elapsed = clock() - mutable.startMilliseconds;
        if (!Number.isFinite(elapsed) || elapsed < 0) return NOT_RECORDABLE;
        return { recordable: true, durationSeconds: (Object.is(elapsed, -0) ? 0 : elapsed) / 1000 };
      } catch {
        return NOT_RECORDABLE;
      }
    },
  };
}
