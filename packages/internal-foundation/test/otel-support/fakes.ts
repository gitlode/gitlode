import { AsyncLocalStorage } from "node:async_hooks";

import {
  context,
  ROOT_CONTEXT,
  type Context,
  type ContextManager,
  type Exception,
  type Span,
  type SpanOptions,
  type SpanStatus,
  type Tracer,
} from "@opentelemetry/api";

export class TestContextManager implements ContextManager {
  private readonly storage = new AsyncLocalStorage<Context>();
  active(): Context {
    return this.storage.getStore() ?? ROOT_CONTEXT;
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    activeContext: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.storage.run(activeContext, () => fn.apply(thisArg, args));
  }
  bind<T>(_context: Context, target: T): T {
    return target;
  }
  enable(): this {
    return this;
  }
  disable(): this {
    this.storage.disable();
    return this;
  }
}

export interface TestSpan extends Span {
  attributes: Record<string, unknown>;
  exceptions: Exception[];
  statuses: SpanStatus[];
  endCount: number;
}

export function makeSpan(): TestSpan {
  return {
    attributes: {},
    exceptions: [],
    statuses: [],
    endCount: 0,
    spanContext: () => ({ traceId: "1".repeat(32), spanId: "2".repeat(16), traceFlags: 1 }),
    setAttribute(key, value) {
      this.attributes[key] = value;
      return this;
    },
    setAttributes(values) {
      Object.assign(this.attributes, values);
      return this;
    },
    addEvent() {
      return this;
    },
    addLink() {
      return this;
    },
    addLinks() {
      return this;
    },
    setStatus(status) {
      this.statuses.push(status);
      return this;
    },
    updateName() {
      return this;
    },
    end() {
      this.endCount++;
    },
    isRecording: () => true,
    recordException(exception) {
      this.exceptions.push(exception);
    },
  };
}

export function makeTracer() {
  const starts: Array<{ name: string; options?: SpanOptions; parent?: Context; span: TestSpan }> =
    [];
  const tracer = {
    startSpan(name: string, options?: SpanOptions, parent?: Context) {
      const span = makeSpan();
      starts.push({ name, options, parent, span });
      return span;
    },
  } as unknown as Tracer;
  return { tracer, starts };
}

export function installContextManager(): TestContextManager {
  context.disable();
  const manager = new TestContextManager();
  context.setGlobalContextManager(manager);
  return manager;
}
