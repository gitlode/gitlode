import type {
  ActiveInstrumentationSpan,
  InstrumentAttributeValue,
  Instrumentation,
  InstrumentAttributes,
  InstrumentationOptions,
  InstrumentationSpan,
} from "./type.js";

class NoopSpan implements ActiveInstrumentationSpan {
  setAttribute(_name: string, _value: InstrumentAttributeValue): void {}
  addEvent(_name: string, _attributes?: InstrumentAttributes): void {}
  incrementCounter(_name: string, _delta?: number): void {}
  end(_error?: unknown): void {}
}

const noopSpan = new NoopSpan();

export class NoopInstrumentation implements Instrumentation {
  run<T>(
    _name: string,
    fn: (span: InstrumentationSpan) => T,
    _options?: InstrumentationOptions,
  ): T {
    return fn(noopSpan);
  }

  async runAsync<T>(
    _name: string,
    fn: (span: InstrumentationSpan) => Promise<T>,
    _options?: InstrumentationOptions,
  ): Promise<T> {
    return await fn(noopSpan);
  }

  startSpan(_name: string, _options?: InstrumentationOptions): ActiveInstrumentationSpan {
    return noopSpan;
  }
}

export const noopInstrumentation = new NoopInstrumentation();
