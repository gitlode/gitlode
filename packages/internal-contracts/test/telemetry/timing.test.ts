import { describe, expect, it } from "vitest";

import { createMonotonicTiming } from "../../src/telemetry/timing.js";
describe("monotonic timing", () => {
  it("reads once at start and once only on first completion, converting milliseconds", () => {
    let reads = 0;
    const values = [10, 1010];
    const timing = createMonotonicTiming(() => values[reads++]!);
    const token = timing.start(true);
    expect(reads).toBe(1);
    expect(timing.complete(token)).toEqual({ recordable: true, durationSeconds: 1 });
    expect(timing.complete(token)).toEqual({ recordable: false });
    expect(reads).toBe(2);
  });
  it("records zero duration", () => {
    const timing = createMonotonicTiming(() => 4);
    expect(timing.complete(timing.start(true))).toEqual({ recordable: true, durationSeconds: 0 });
  });
  it("shares no-op tokens without clock reads", () => {
    let reads = 0;
    const timing = createMonotonicTiming(() => ++reads);
    const a = timing.start(false),
      b = timing.start(false);
    expect(a).toBe(b);
    expect(timing.complete(a)).toEqual({ recordable: false });
    expect(reads).toBe(0);
  });
  it.each(["throwing", "nonfinite", "backward"])("isolates a %s clock", (kind) => {
    let reads = 0;
    const timing = createMonotonicTiming(() => {
      reads++;
      if (kind === "throwing") throw new Error("clock");
      if (kind === "nonfinite") return Infinity;
      return reads === 1 ? 2 : 1;
    });
    const token = timing.start(true);
    expect(() => timing.complete(token)).not.toThrow();
    expect(timing.complete(token)).toEqual({ recordable: false });
  });
});
