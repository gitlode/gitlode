import type { Instrumentation, InstrumentationOptions, InstrumentationSpan } from "./type.js";

export function instrumentAsyncIterable<T>(
  instrumentation: Instrumentation,
  name: string,
  factory: (span: InstrumentationSpan) => AsyncIterable<T>,
  options?: InstrumentationOptions,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      const span = instrumentation.startSpan(name, options);
      try {
        for await (const item of factory(span)) {
          yield item;
        }
        span.end();
      } catch (error) {
        span.end(error);
        throw error;
      }
    },
  };
}
