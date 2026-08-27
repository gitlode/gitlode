import { describe, expect, it } from "vitest";

import {
  instrumentAsyncIterable,
  LocalInstrumentationRecorder,
} from "../../src/instrumentation/index.js";

describe("LocalInstrumentationRecorder", () => {
  it("records sync spans with attributes and counters", () => {
    let time = 0;
    const recorder = new LocalInstrumentationRecorder(() => time);

    recorder.run("work", (span) => {
      span.setAttribute("path", "sync");
      span.incrementCounter("items");
      span.incrementCounter("items", 2);
      time += 5;
    });

    expect(recorder.records()).toEqual([
      {
        name: "work",
        durationMs: 5,
        attributes: { path: "sync" },
        counters: { items: 3 },
        events: [],
        error: undefined,
      },
    ]);
    expect(recorder.summary()).toEqual([
      {
        name: "work",
        totalMs: 5,
        calls: 1,
        averageMs: 5,
        maxMs: 5,
        attributes: { path: ["sync"] },
        counters: { items: 3 },
      },
    ]);
  });

  it("records async spans and closes spans when errors are thrown", async () => {
    let time = 10;
    const recorder = new LocalInstrumentationRecorder(() => time);

    await expect(
      recorder.runAsync("async-work", async (span) => {
        span.addEvent("before-failure", { retryable: false });
        time += 7;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(recorder.records()).toEqual([
      {
        name: "async-work",
        durationMs: 7,
        attributes: {},
        counters: {},
        events: [{ name: "before-failure", attributes: { retryable: false } }],
        error: "boom",
      },
    ]);
    expect(recorder.summary()).toEqual([
      {
        name: "async-work",
        totalMs: 7,
        calls: 1,
        averageMs: 7,
        maxMs: 7,
        errors: 1,
      },
    ]);
  });

  it("aggregates repeated spans deterministically", () => {
    let time = 0;
    const recorder = new LocalInstrumentationRecorder(() => time);

    recorder.run("repeat", (span) => {
      span.setAttribute("strategy", "a");
      span.incrementCounter("reads", 2);
      time += 3;
    });
    recorder.run("repeat", (span) => {
      span.setAttribute("strategy", "b");
      span.incrementCounter("reads", 4);
      time += 5;
    });

    expect(recorder.summary()).toEqual([
      {
        name: "repeat",
        totalMs: 8,
        calls: 2,
        averageMs: 4,
        maxMs: 5,
        attributes: { strategy: ["a", "b"] },
        counters: { reads: 6 },
      },
    ]);
  });

  it("orders summary entries by first span start", () => {
    let time = 0;
    const recorder = new LocalInstrumentationRecorder(() => time);

    recorder.run("outer", () => {
      recorder.run("inner", () => {
        time += 1;
      });
      time += 1;
    });

    expect(recorder.records().map((record) => record.name)).toEqual(["inner", "outer"]);
    expect(recorder.summary().map((entry) => entry.name)).toEqual(["outer", "inner"]);
  });

  it("measures async iterable consumption rather than factory creation", async () => {
    let time = 0;
    const recorder = new LocalInstrumentationRecorder(() => time);
    let factoryCalls = 0;

    const iterable = instrumentAsyncIterable(recorder, "stream", (span) => {
      factoryCalls++;
      span.setAttribute("kind", "async-iterable");
      return (async function* () {
        time += 2;
        span.incrementCounter("items");
        yield "a";
        time += 3;
        span.incrementCounter("items");
        yield "b";
      })();
    });

    expect(factoryCalls).toBe(0);
    expect(recorder.records()).toEqual([]);

    const values: string[] = [];
    for await (const value of iterable) {
      values.push(value);
    }

    expect(values).toEqual(["a", "b"]);
    expect(factoryCalls).toBe(1);
    expect(recorder.summary()).toEqual([
      {
        name: "stream",
        totalMs: 5,
        calls: 1,
        averageMs: 5,
        maxMs: 5,
        attributes: { kind: ["async-iterable"] },
        counters: { items: 2 },
      },
    ]);
  });
});
