export type InstrumentAttributeValue = string | number | boolean;

export type InstrumentAttributes = Readonly<Record<string, InstrumentAttributeValue>>;

export type InstrumentationClock = () => number;

export interface InstrumentationOptions {
  readonly attributes?: InstrumentAttributes;
}

export interface InstrumentationSpan {
  setAttribute(name: string, value: InstrumentAttributeValue): void;
  addEvent(name: string, attributes?: InstrumentAttributes): void;
  incrementCounter(name: string, delta?: number): void;
}

export interface ActiveInstrumentationSpan extends InstrumentationSpan {
  end(error?: unknown): void;
}

export interface Instrumentation {
  run<T>(name: string, fn: (span: InstrumentationSpan) => T, options?: InstrumentationOptions): T;
  runAsync<T>(
    name: string,
    fn: (span: InstrumentationSpan) => Promise<T>,
    options?: InstrumentationOptions,
  ): Promise<T>;
  startSpan(name: string, options?: InstrumentationOptions): ActiveInstrumentationSpan;
}

export interface LocalSpanEvent {
  readonly name: string;
  readonly attributes: InstrumentAttributes;
}

export interface LocalSpanRecord {
  readonly name: string;
  readonly durationMs: number;
  readonly attributes: InstrumentAttributes;
  readonly counters: Readonly<Record<string, number>>;
  readonly events: readonly LocalSpanEvent[];
  readonly error?: string;
}

export interface ProfileSummaryEntry {
  readonly name: string;
  readonly totalMs: number;
  readonly calls: number;
  readonly averageMs: number;
  readonly maxMs: number;
  readonly attributes?: Readonly<Record<string, readonly InstrumentAttributeValue[]>>;
  readonly counters?: Readonly<Record<string, number>>;
  readonly errors?: number;
}
