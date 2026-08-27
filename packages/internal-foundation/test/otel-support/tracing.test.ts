import { context, createContextKey, ROOT_CONTEXT, SpanStatusCode, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { recordSpanError, withAsyncSpan, withSpan } from "../../src/otel-support/index.js";
import { installContextManager, makeSpan, makeTracer } from "./fakes.js";

beforeEach(() => installContextManager());
afterEach(() => context.disable());

describe("span helpers", () => {
  it("preserves sync return identity, forwards options and activates the span", () => {
    const { tracer, starts } = makeTracer();
    const value = {};
    const options = { attributes: { test: true } };
    expect(
      withSpan(
        tracer,
        "work",
        (span) => {
          expect(trace.getSpan(context.active())).toBe(span);
          return value;
        },
        options,
      ),
    ).toBe(value);
    expect(starts[0]).toMatchObject({ name: "work", options });
    expect(starts[0]!.span.statuses).toEqual([]);
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("uses the active parent at call time and supports an explicit override", () => {
    const key = createContextKey("parent");
    const active = ROOT_CONTEXT.setValue(key, "active");
    const explicit = ROOT_CONTEXT.setValue(key, "explicit");
    const { tracer, starts } = makeTracer();
    context.with(active, () => withSpan(tracer, "active", () => undefined));
    context.with(active, () => withSpan(tracer, "explicit", () => undefined, undefined, explicit));
    expect(starts.map(({ parent }) => parent?.getValue(key))).toEqual(["active", "explicit"]);
  });

  it("records normalized unknown errors, sets ERROR without a description, and rethrows identity", () => {
    const { tracer, starts } = makeTracer();
    const thrown = { secret: "not stringified" };
    expect(() =>
      withSpan(tracer, "failure", () => {
        throw thrown;
      }),
    ).toThrow(thrown);
    const span = starts[0]!.span;
    expect(span.exceptions).toEqual([{ name: "NonErrorThrown", message: "Object" }]);
    expect(span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
    expect(span.endCount).toBe(1);
  });

  it("preserves async resolution and rejection identities", async () => {
    const resolved = {};
    const rejected = Symbol("failure");
    const success = makeTracer();
    await expect(
      withAsyncSpan(success.tracer, "success", async (span) => {
        expect(trace.getSpan(context.active())).toBe(span);
        await Promise.resolve();
        expect(trace.getSpan(context.active())).toBe(span);
        return resolved;
      }),
    ).resolves.toBe(resolved);
    expect(success.starts[0]!.span.statuses).toEqual([]);
    expect(success.starts[0]!.span.endCount).toBe(1);

    const failure = makeTracer();
    await expect(
      withAsyncSpan(failure.tracer, "failure", async () => {
        throw rejected;
      }),
    ).rejects.toBe(rejected);
    expect(failure.starts[0]!.span.exceptions).toEqual([
      { name: "NonErrorThrown", message: "Symbol" },
    ]);
    expect(failure.starts[0]!.span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
    expect(failure.starts[0]!.span.endCount).toBe(1);
  });

  it("recordSpanError does not end the span", () => {
    const span = makeSpan();
    recordSpanError(span, 42);
    expect(span.exceptions).toEqual([{ name: "NonErrorThrown", message: "42" }]);
    expect(span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
    expect(span.endCount).toBe(0);
  });

  it("rejects asynchronous callbacks from withSpan at the type level", () => {
    expectTypeOf(withSpan).toBeFunction();
    const typeCheck = () => {
      const { tracer } = makeTracer();
      // @ts-expect-error withSpan deliberately excludes PromiseLike return values.
      withSpan(tracer, "invalid", async () => 1);
    };
    expect(typeCheck).toBeTypeOf("function");
  });
});
