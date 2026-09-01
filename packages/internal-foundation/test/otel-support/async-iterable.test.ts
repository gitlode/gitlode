import { context, createContextKey, ROOT_CONTEXT, SpanStatusCode, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAsyncIterableInstrumenter } from "../../src/otel-support/index.js";
import { installContextManager, makeTracer } from "./fakes.js";

beforeEach(() => installContextManager());
afterEach(() => context.disable());

const COMPLETION_ATTRIBUTE = "test.stream.completion";
const completion = (span: { attributes: Record<string, unknown> }) =>
  span.attributes[COMPLETION_ATTRIBUTE];
const instrumentAsyncIterable = createAsyncIterableInstrumenter((span, value) => {
  span.setAttribute(COMPLETION_ATTRIBUTE, value);
});

function iterableFrom<T>(iterator: AsyncIterator<T>): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: () => iterator };
}

describe("instrumentAsyncIterable", () => {
  it("is completely lazy and gives every iterator an independent span", async () => {
    const { tracer, starts } = makeTracer();
    const factory = vi.fn(() => iterableFrom({ next: async () => ({ value: 1, done: true }) }));
    const wrapped = instrumentAsyncIterable(tracer, "stream", factory);
    const first = wrapped[Symbol.asyncIterator]();
    const second = wrapped[Symbol.asyncIterator]();
    expect(starts).toHaveLength(0);
    expect(factory).not.toHaveBeenCalled();
    await first.next();
    await second.next();
    expect(starts).toHaveLength(2);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(starts.map(({ span }) => [completion(span), span.endCount])).toEqual([
      ["exhausted", 1],
      ["exhausted", 1],
    ]);
    expect(starts.every(({ span }) => !("gitlode.stream.completion" in span.attributes))).toBe(
      true,
    );
  });

  it("resolves omitted parent on first next, supports override, and forwards options", async () => {
    const key = createContextKey("parent");
    const construction = ROOT_CONTEXT.setValue(key, "construction");
    const pull = ROOT_CONTEXT.setValue(key, "pull");
    const explicit = ROOT_CONTEXT.setValue(key, "explicit");
    const { tracer, starts } = makeTracer();
    const options = { attributes: { option: true } };
    const wrapped = context.with(construction, () =>
      instrumentAsyncIterable(
        tracer,
        "stream",
        () => iterableFrom({ next: async () => ({ done: true, value: undefined }) }),
        options,
      ),
    );
    const iterator = wrapped[Symbol.asyncIterator]();
    await context.with(pull, () => iterator.next());
    const explicitIterator = instrumentAsyncIterable(
      tracer,
      "explicit",
      () => iterableFrom({ next: async () => ({ done: true, value: undefined }) }),
      undefined,
      explicit,
    )[Symbol.asyncIterator]();
    await context.with(pull, () => explicitIterator.next());
    expect(starts.map(({ parent }) => parent?.getValue(key))).toEqual(["pull", "explicit"]);
    expect(starts[0]!.options).toBe(options);
  });

  it("activates factory, acquisition, and every source method but not consumer work", async () => {
    const { tracer, starts } = makeTracer();
    const active: unknown[] = [];
    let pulls = 0;
    const wrapped = instrumentAsyncIterable(tracer, "stream", (span) => {
      active.push(trace.getSpan(context.active()));
      return {
        [Symbol.asyncIterator]() {
          active.push(trace.getSpan(context.active()));
          return {
            next: async () => {
              active.push(trace.getSpan(context.active()));
              await Promise.resolve();
              active.push(trace.getSpan(context.active()));
              return { value: ++pulls, done: false };
            },
            return: async () => {
              active.push(trace.getSpan(context.active()));
              await Promise.resolve();
              active.push(trace.getSpan(context.active()));
              return { value: 0, done: true };
            },
            throw: async () => {
              active.push(trace.getSpan(context.active()));
              await Promise.resolve();
              active.push(trace.getSpan(context.active()));
              return { value: 0, done: true };
            },
          };
        },
      };
    });
    const iterator = wrapped[Symbol.asyncIterator]();
    await iterator.next();
    expect(trace.getSpan(context.active())).toBeUndefined();
    await iterator.next();
    await iterator.throw("handled");
    expect(active.every((seen) => seen === starts[0]!.span)).toBe(true);
    expect(completion(starts[0]!.span)).toBe("handled_throw");
  });

  it("tracks cancellation intent across done:false until eventual completion", async () => {
    const { tracer, starts } = makeTracer();
    let returns = 0;
    let pulls = 0;
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => ({ value: 2, done: ++pulls > 1 }),
        return: async () => ({ value: ++returns, done: returns > 1 }),
      }),
    )[Symbol.asyncIterator]();
    await iterator.next();
    expect(await iterator.return?.()).toEqual({ value: 1, done: false });
    expect(starts[0]!.span.endCount).toBe(0);
    await iterator.next();
    expect(completion(starts[0]!.span)).toBe("cancelled");
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("allows handled throw to continue when done:false", async () => {
    const { tracer, starts } = makeTracer();
    let pulls = 0;
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => ({ value: 2, done: ++pulls > 1 }),
        throw: async () => ({ value: 1, done: false }),
      }),
    )[Symbol.asyncIterator]();
    await iterator.next();
    expect(await iterator.throw?.("handled")).toEqual({ value: 1, done: false });
    expect(starts[0]!.span.endCount).toBe(0);
    await iterator.next();
    expect(completion(starts[0]!.span)).toBe("exhausted");
  });

  it("cleans up and throws TypeError when source has no throw method", async () => {
    const cleanup = vi.fn(async () => ({ value: undefined, done: true as const }));
    const { tracer, starts } = makeTracer();
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => ({ value: 1, done: false }),
        return: cleanup,
      }),
    )[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.throw?.("original")).rejects.toBeInstanceOf(TypeError);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(completion(starts[0]!.span)).toBe("error");
    expect(starts[0]!.span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
  });

  it("gives cleanup failure precedence when throw is unavailable", async () => {
    const cleanupError = new Error("cleanup");
    const { tracer } = makeTracer();
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => ({ value: 1, done: false }),
        return: async () => {
          throw cleanupError;
        },
      }),
    )[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.throw?.("original")).rejects.toBe(cleanupError);
  });

  it.each(["next", "return", "throw"] as const)(
    "records %s failure and preserves its identity",
    async (method) => {
      const failure = { method };
      const { tracer, starts } = makeTracer();
      const source = {
        next: async () =>
          method === "next" ? Promise.reject(failure) : { value: 1, done: false as const },
        return: async () => {
          if (method === "return") throw failure;
          return { value: 1, done: true as const };
        },
        throw: async () => {
          if (method === "throw") throw failure;
          return { value: 1, done: true as const };
        },
      };
      const iterator = instrumentAsyncIterable(tracer, "stream", () => iterableFrom(source))[
        Symbol.asyncIterator
      ]();
      if (method !== "next") await iterator.next();
      await expect(
        method === "next"
          ? iterator.next()
          : method === "return"
            ? iterator.return?.()
            : iterator.throw?.(),
      ).rejects.toBe(failure);
      expect(completion(starts[0]!.span)).toBe("error");
      expect(starts[0]!.span.endCount).toBe(1);
    },
  );

  it.each(["factory", "acquisition"])("records %s failure", async (stage) => {
    const failure = Symbol(stage);
    const { tracer, starts } = makeTracer();
    const factory = () => {
      if (stage === "factory") throw failure;
      return Object.defineProperty({}, Symbol.asyncIterator, {
        get() {
          throw failure;
        },
      }) as AsyncIterable<number>;
    };
    const iterator = instrumentAsyncIterable(tracer, "stream", factory)[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBe(failure);
    expect(completion(starts[0]!.span)).toBe("error");
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("rejects invalid iterator results", async () => {
    const { tracer, starts } = makeTracer();
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => 1 as never,
      }),
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBeInstanceOf(TypeError);
    expect(completion(starts[0]!.span)).toBe("error");
  });

  it("serializes concurrent calls in invocation order", async () => {
    const { tracer } = makeTracer();
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const iterator = instrumentAsyncIterable(tracer, "stream", () =>
      iterableFrom({
        next: async () => {
          order.push("next:start");
          await gate;
          order.push("next:end");
          return { value: 1, done: false };
        },
        return: async () => {
          order.push("return");
          return { value: 2, done: true };
        },
      }),
    )[Symbol.asyncIterator]();
    const next = iterator.next();
    const returned = iterator.return?.();
    await Promise.resolve();
    expect(order).toEqual(["next:start"]);
    release();
    await Promise.all([next, returned]);
    expect(order).toEqual(["next:start", "next:end", "return"]);
  });

  it("has stable terminal behavior without re-running the source or ending twice", async () => {
    const { tracer, starts } = makeTracer();
    const next = vi.fn(async () => ({ value: 1, done: true as const }));
    const iterator = instrumentAsyncIterable(tracer, "stream", () => iterableFrom({ next }))[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    expect(await iterator.next()).toEqual({ value: undefined, done: true });
    expect(await iterator.return?.(3)).toEqual({ value: 3, done: true });
    const thrown = {};
    await expect(iterator.throw?.(thrown)).rejects.toBe(thrown);
    expect(next).toHaveBeenCalledOnce();
    expect(starts).toHaveLength(1);
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("ends once and preserves a completion callback failure", async () => {
    const failure = Symbol("completion callback failure");
    const onCompletion = vi.fn(() => {
      throw failure;
    });
    const throwingInstrumenter = createAsyncIterableInstrumenter(onCompletion);
    const { tracer, starts } = makeTracer();
    const next = vi.fn(async () => ({ value: 1, done: true as const }));
    const iterator = throwingInstrumenter(tracer, "stream", () => iterableFrom({ next }))[
      Symbol.asyncIterator
    ]();

    await expect(iterator.next()).rejects.toBe(failure);
    expect(onCompletion).toHaveBeenCalledOnce();
    expect(onCompletion).toHaveBeenCalledWith(starts[0]!.span, "exhausted");
    expect(starts[0]!.span.endCount).toBe(1);

    expect(await iterator.next()).toEqual({ value: undefined, done: true });
    expect(await iterator.return?.(2)).toEqual({ value: 2, done: true });
    const terminalThrow = Symbol("terminal throw");
    await expect(iterator.throw?.(terminalThrow)).rejects.toBe(terminalThrow);
    expect(next).toHaveBeenCalledOnce();
    expect(onCompletion).toHaveBeenCalledOnce();
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("does not create source or span for return/throw before first next", async () => {
    const { tracer, starts } = makeTracer();
    const factory = vi.fn(() =>
      iterableFrom({ next: async () => ({ done: true, value: undefined }) }),
    );
    const returned = instrumentAsyncIterable(tracer, "stream", factory)[Symbol.asyncIterator]();
    expect(await returned.return?.(7)).toEqual({ value: 7, done: true });
    const thrown = instrumentAsyncIterable(tracer, "stream", factory)[Symbol.asyncIterator]();
    const value = Symbol("stop");
    await expect(thrown.throw?.(value)).rejects.toBe(value);
    expect(factory).not.toHaveBeenCalled();
    expect(starts).toHaveLength(0);
  });

  it("supports a custom error policy without changing terminal identity or repeating it", async () => {
    const failure = Symbol("custom failure");
    const { tracer, starts } = makeTracer();
    const onError = vi.fn();
    const instrumenter = createAsyncIterableInstrumenter(vi.fn(), onError);
    const iterator = instrumenter(tracer, "stream", () =>
      iterableFrom({
        next: async () => {
          throw failure;
        },
      }),
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBe(failure);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(starts[0]!.span, failure);
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("preserves application failure when error completion callback throws", async () => {
    const failure = Symbol("source failure");
    const completion = vi.fn(() => {
      throw Symbol("completion failure");
    });
    const onError = vi.fn();
    const { tracer, starts } = makeTracer();
    const iterator = createAsyncIterableInstrumenter(completion, onError)(tracer, "stream", () =>
      iterableFrom({
        next: async () => {
          throw failure;
        },
      }),
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBe(failure);
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    await expect(iterator.return?.()).resolves.toEqual({ value: undefined, done: true });
    expect(onError).toHaveBeenCalledOnce();
    expect(completion).toHaveBeenCalledOnce();
    expect(completion).toHaveBeenCalledWith(starts[0]!.span, "error");
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("keeps the original failure and ends when custom error policy throws", async () => {
    const failure = Symbol("application failure");
    const { tracer, starts } = makeTracer();
    const instrumenter = createAsyncIterableInstrumenter(vi.fn(), () => {
      throw Symbol("telemetry failure");
    });
    const iterator = instrumenter(tracer, "stream", () =>
      iterableFrom({
        next: async () => {
          throw failure;
        },
      }),
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBe(failure);
    expect(starts[0]!.span.endCount).toBe(1);
  });

  it("allows a typed policy to set ERROR without recording an exception", async () => {
    const failure = Symbol("typed failure");
    const { tracer, starts } = makeTracer();
    const setTypedError = vi.fn((span) => span.setStatus({ code: SpanStatusCode.ERROR }));
    const iterator = createAsyncIterableInstrumenter(vi.fn(), setTypedError)(tracer, "stream", () =>
      iterableFrom({
        next: async () => {
          throw failure;
        },
      }),
    )[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBe(failure);
    expect(setTypedError).toHaveBeenCalledOnce();
    expect(starts[0]!.span.endCount).toBe(1);
  });
});
