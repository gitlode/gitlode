import {
  context,
  trace,
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";

import { STREAM_COMPLETION_ATTRIBUTE, type StreamCompletion } from "./conventions.js";
import { recordSpanError } from "./tracing.js";

type IteratorResultObject<T> = IteratorResult<T> & object;

function validateResult<T>(result: IteratorResult<T>): IteratorResultObject<T> {
  if ((typeof result !== "object" && typeof result !== "function") || result === null) {
    throw new TypeError("Async iterator method returned a non-object value");
  }
  return result;
}

export function instrumentAsyncIterable<T>(
  tracer: Tracer,
  name: string,
  factory: (span: Span) => AsyncIterable<T>,
  options?: SpanOptions,
  parentContext?: Context,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      let span: Span | undefined;
      let spanContext: Context | undefined;
      let source: AsyncIterator<T> | undefined;
      let started = false;
      let terminal = false;
      let cancellationRequested = false;
      let queue = Promise.resolve();

      const finish = (completion: StreamCompletion): void => {
        if (terminal) return;
        terminal = true;
        span?.setAttribute(STREAM_COMPLETION_ATTRIBUTE, completion);
        span?.end();
      };

      const fail = (error: unknown): never => {
        if (!terminal && span) {
          recordSpanError(span, error);
          finish("error");
        }
        throw error;
      };

      const underSpan = <R>(callback: () => R): R => {
        if (!spanContext) throw new Error("The stream span context has not been initialized");
        return context.with(spanContext, callback);
      };

      const start = (invocationContext: Context): void => {
        const parent = parentContext ?? invocationContext;
        const createdSpan = tracer.startSpan(name, options, parent);
        span = createdSpan;
        spanContext = trace.setSpan(parent, createdSpan);
        started = true;
        try {
          source = underSpan(() => factory(createdSpan)[Symbol.asyncIterator]());
        } catch (error) {
          return fail(error);
        }
      };

      const invoke = async (
        method: "next" | "return" | "throw",
        value?: unknown,
        invocationContext: Context = context.active(),
      ): Promise<IteratorResult<T>> => {
        if (terminal) {
          if (method === "throw") throw value;
          return { value: value as T, done: true };
        }

        if (!started) {
          if (method === "return") {
            terminal = true;
            return { value: value as T, done: true };
          }
          if (method === "throw") {
            terminal = true;
            throw value;
          }
          start(invocationContext);
        }

        try {
          const iterator = source;
          if (!iterator) throw new TypeError("The async iterable did not provide an iterator");
          let result: IteratorResult<T>;
          if (method === "next") {
            result = validateResult(await underSpan(() => iterator.next(value)));
          } else if (method === "return") {
            cancellationRequested = true;
            const returnMethod = iterator.return;
            result = returnMethod
              ? validateResult(await underSpan(() => returnMethod.call(iterator, value as T)))
              : { value: value as T, done: true };
          } else if (iterator.throw) {
            const throwMethod = iterator.throw;
            result = validateResult(await underSpan(() => throwMethod.call(iterator, value)));
          } else {
            const returnMethod = iterator.return;
            if (returnMethod) {
              validateResult(await underSpan(() => returnMethod.call(iterator)));
            }
            throw new TypeError("The iterator does not provide a 'throw' method");
          }

          if (result.done) {
            const completion = cancellationRequested
              ? "cancelled"
              : method === "throw"
                ? "handled_throw"
                : method === "return"
                  ? "cancelled"
                  : "exhausted";
            finish(completion);
          }
          return result;
        } catch (error) {
          return fail(error);
        }
      };

      const serialize = (method: "next" | "return" | "throw", value?: unknown) => {
        const invocationContext = context.active();
        const result = queue.then(
          () => invoke(method, value, invocationContext),
          () => invoke(method, value, invocationContext),
        );
        queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      };

      return {
        next: (value?: unknown) => serialize("next", value),
        return: (value?: T | PromiseLike<T>) => serialize("return", value),
        throw: (value?: unknown) => serialize("throw", value),
      };
    },
  };
}
