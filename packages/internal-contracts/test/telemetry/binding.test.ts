import type { InstrumentAsyncIterable } from "@gitlode/internal-foundation/otel-support";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CORE_INSTRUMENTATION_SCOPES,
  instrumentAsyncIterable,
  STREAM_COMPLETION_ATTRIBUTE,
  STREAM_COMPLETION_VALUES,
} from "../../src/telemetry/index.js";

interface TestSpan {
  attributes: Record<string, unknown>;
  attributeCalls: string[];
  endCount: number;
}

function makeTracer() {
  const spans: TestSpan[] = [];
  const tracer = {
    startSpan() {
      const state: TestSpan = { attributes: {}, attributeCalls: [], endCount: 0 };
      const span = {
        ...state,
        spanContext: () => ({ traceId: "1".repeat(32), spanId: "2".repeat(16), traceFlags: 1 }),
        setAttribute(key: string, value: unknown) {
          state.attributes[key] = value;
          state.attributeCalls.push(key);
          return this;
        },
        setAttributes: () => span,
        addEvent: () => span,
        addLink: () => span,
        addLinks: () => span,
        setStatus: () => span,
        updateName: () => span,
        end: () => state.endCount++,
        isRecording: () => true,
        recordException: () => undefined,
      };
      spans.push(state);
      return span;
    },
  };
  return { tracer: tracer as never, spans };
}

function iterableFrom<T>(iterator: AsyncIterator<T>): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: () => iterator };
}

describe("telemetry async-iterable binding", () => {
  it("exports the configured factory result as a typed instrumenter", () => {
    expectTypeOf(instrumentAsyncIterable).toEqualTypeOf<InstrumentAsyncIterable>();
  });

  it.each([
    ["exhausted", async (iterator: AsyncIterator<number>) => iterator.next()],
    ["cancelled", async (iterator: AsyncIterator<number>) => iterator.return?.()],
    ["handled_throw", async (iterator: AsyncIterator<number>) => iterator.throw?.("handled")],
  ] as const)("records %s exactly once", async (expected, terminate) => {
    const { tracer, spans } = makeTracer();
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => ({ value: 1, done: expected === "exhausted" }),
        return: async () => ({ value: 1, done: true }),
        throw: async () => ({ value: 1, done: true }),
      }),
    )[Symbol.asyncIterator]();
    if (expected !== "exhausted") await iterator.next();
    await terminate(iterator);
    expect(spans[0]!.attributes[STREAM_COMPLETION_ATTRIBUTE]).toBe(expected);
    expect(spans[0]!.attributeCalls).toEqual([STREAM_COMPLETION_ATTRIBUTE]);
    expect(spans[0]!.endCount).toBe(1);
  });

  it("records error completion exactly once", async () => {
    const { tracer, spans } = makeTracer();
    const failure = Symbol("failure");
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({ next: async () => Promise.reject(failure) }),
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBe(failure);
    expect(spans[0]!.attributes[STREAM_COMPLETION_ATTRIBUTE]).toBe("error");
    expect(spans[0]!.attributeCalls).toEqual([STREAM_COMPLETION_ATTRIBUTE]);
    expect(spans[0]!.endCount).toBe(1);
  });

  it("exports canonical telemetry conventions", () => {
    expect(CORE_INSTRUMENTATION_SCOPES).toEqual([
      "gitlode.execution",
      "gitlode.extraction",
      "gitlode.dag",
      "gitlode.git",
      "gitlode.line_diff",
      "gitlode.plugin_runtime",
    ]);
    expect(STREAM_COMPLETION_ATTRIBUTE).toBe("gitlode.stream.completion");
    expect(STREAM_COMPLETION_VALUES).toEqual(["exhausted", "cancelled", "handled_throw", "error"]);
  });
});
