import { describe, expect, it } from "vitest";

import { createMonotonicTiming } from "../../src/telemetry/index.js";

describe("monotonic timing", () => {
  it("reads once at start and once only on first completion", () => {
    let reads = 0;
    const timing = createMonotonicTiming(() => reads++ * 1000);
    const token = timing.start(true);
    expect(timing.complete(token)).toEqual({ firstCompletion: true, durationSeconds: 1 });
    expect(timing.complete(token)).toEqual({ firstCompletion: false });
    expect(reads).toBe(2);
  });
  it("records zero duration without negative zero", () => {
    const timing = createMonotonicTiming(() => 4);
    const result = timing.complete(timing.start(true));
    expect(result).toEqual({ firstCompletion: true, durationSeconds: 0 });
    if (result.firstCompletion) expect(Object.is(result.durationSeconds, -0)).toBe(false);
  });
  it("shares no-op tokens without clock reads", () => {
    let reads = 0;
    const timing = createMonotonicTiming(() => ++reads);
    const a = timing.start(false),
      b = timing.start(false);
    expect(a).toBe(b);
    expect(timing.complete(a)).toEqual({ firstCompletion: false });
    expect(reads).toBe(0);
  });
  it.each([NaN, Infinity, -Infinity])("owns completion after nonfinite start %s", (value) => {
    const timing = createMonotonicTiming(() => value);
    const a = timing.start(true),
      b = timing.start(true);
    expect(a).not.toBe(b);
    expect(timing.complete(a)).toEqual({ firstCompletion: true, durationSeconds: null });
    expect(timing.complete(a)).toEqual({ firstCompletion: false });
  });
  it("owns completion after a throwing start clock", () => {
    const timing = createMonotonicTiming(() => {
      throw new Error("clock");
    });
    const token = timing.start(true);
    expect(timing.complete(token)).toEqual({ firstCompletion: true, durationSeconds: null });
    expect(timing.complete(token)).toEqual({ firstCompletion: false });
  });
  it("sets terminal state before a throwing completion clock", () => {
    let reads = 0;
    const timing = createMonotonicTiming(() => {
      if (reads++) throw new Error("clock");
      return 0;
    });
    const token = timing.start(true);
    expect(timing.complete(token)).toEqual({ firstCompletion: true, durationSeconds: null });
    expect(timing.complete(token)).toEqual({ firstCompletion: false });
    expect(reads).toBe(2);
  });
  it.each([NaN, Infinity, -Infinity])("rejects nonfinite completion %s", (value) => {
    let first = true;
    const timing = createMonotonicTiming(() => (first ? ((first = false), 0) : value));
    expect(timing.complete(timing.start(true))).toEqual({
      firstCompletion: true,
      durationSeconds: null,
    });
  });
  it("rejects a backward clock", () => {
    let value = 2;
    const timing = createMonotonicTiming(() => value--);
    expect(timing.complete(timing.start(true))).toEqual({
      firstCompletion: true,
      durationSeconds: null,
    });
  });
});
