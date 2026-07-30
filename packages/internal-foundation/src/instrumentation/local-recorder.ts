import type {
  ActiveInstrumentationSpan,
  InstrumentAttributeValue,
  Instrumentation,
  InstrumentationClock,
  InstrumentationOptions,
  InstrumentationSpan,
  InstrumentAttributes,
  LocalSpanEvent,
  LocalSpanRecord,
  ProfileSummaryEntry,
} from "./type.js";

class LocalActiveSpan implements ActiveInstrumentationSpan {
  private readonly _recorder: LocalInstrumentationRecorder;
  private readonly _name: string;
  private readonly _startedAt: number;
  private readonly _startOrder: number;
  private readonly _attributes = new Map<string, InstrumentAttributeValue>();
  private readonly _counters = new Map<string, number>();
  private readonly _events: LocalSpanEvent[] = [];
  private _ended = false;

  constructor(
    recorder: LocalInstrumentationRecorder,
    name: string,
    startedAt: number,
    startOrder: number,
    attributes: InstrumentAttributes | undefined,
  ) {
    this._recorder = recorder;
    this._name = name;
    this._startedAt = startedAt;
    this._startOrder = startOrder;
    for (const [key, value] of Object.entries(attributes ?? {})) {
      this._attributes.set(key, value);
    }
  }

  setAttribute(name: string, value: InstrumentAttributeValue): void {
    if (this._ended) return;
    this._attributes.set(name, value);
  }

  addEvent(name: string, attributes?: InstrumentAttributes): void {
    if (this._ended) return;
    this._events.push({ name, attributes: sortAttributes(attributes ?? {}) });
  }

  incrementCounter(name: string, delta = 1): void {
    if (this._ended || !Number.isFinite(delta)) return;
    this._counters.set(name, (this._counters.get(name) ?? 0) + delta);
  }

  end(error?: unknown): void {
    if (this._ended) return;
    this._ended = true;
    this._recorder._record({
      name: this._name,
      durationMs: Math.max(0, this._recorder.clock() - this._startedAt),
      attributes: mapToSortedRecord(this._attributes),
      counters: mapToSortedRecord(this._counters),
      events: [...this._events],
      error: error === undefined ? undefined : formatSpanError(error),
      startOrder: this._startOrder,
    });
  }
}

export class LocalInstrumentationRecorder implements Instrumentation {
  readonly clock: InstrumentationClock;
  private readonly _records: RecordedLocalSpan[] = [];
  private _nextStartOrder = 0;

  constructor(clock: InstrumentationClock) {
    this.clock = clock;
  }

  run<T>(name: string, fn: (span: InstrumentationSpan) => T, options?: InstrumentationOptions): T {
    const span = this.startSpan(name, options);
    try {
      const result = fn(span);
      span.end();
      return result;
    } catch (error) {
      span.end(error);
      throw error;
    }
  }

  async runAsync<T>(
    name: string,
    fn: (span: InstrumentationSpan) => Promise<T>,
    options?: InstrumentationOptions,
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      span.end(error);
      throw error;
    }
  }

  startSpan(name: string, options?: InstrumentationOptions): ActiveInstrumentationSpan {
    return new LocalActiveSpan(
      this,
      name,
      this.clock(),
      this._nextStartOrder++,
      options?.attributes,
    );
  }

  records(): readonly LocalSpanRecord[] {
    return this._records.map((record) => ({
      name: record.name,
      durationMs: record.durationMs,
      attributes: { ...record.attributes },
      counters: { ...record.counters },
      events: record.events.map((event) => ({ ...event, attributes: { ...event.attributes } })),
      error: record.error,
    }));
  }

  summary(): readonly ProfileSummaryEntry[] {
    const aggregates = new Map<string, MutableProfileSummary>();

    for (const record of this._records) {
      let aggregate = aggregates.get(record.name);
      if (!aggregate) {
        aggregate = {
          name: record.name,
          totalMs: 0,
          calls: 0,
          maxMs: 0,
          firstStartOrder: record.startOrder,
          attributes: new Map(),
          counters: new Map(),
          errors: 0,
        };
        aggregates.set(record.name, aggregate);
      }

      aggregate.totalMs += record.durationMs;
      aggregate.calls++;
      aggregate.maxMs = Math.max(aggregate.maxMs, record.durationMs);
      aggregate.firstStartOrder = Math.min(aggregate.firstStartOrder, record.startOrder);
      if (record.error !== undefined) aggregate.errors++;

      for (const [key, value] of Object.entries(record.attributes)) {
        const values = aggregate.attributes.get(key) ?? new Set<InstrumentAttributeValue>();
        values.add(value);
        aggregate.attributes.set(key, values);
      }

      for (const [key, value] of Object.entries(record.counters)) {
        aggregate.counters.set(key, (aggregate.counters.get(key) ?? 0) + value);
      }
    }

    return [...aggregates.values()]
      .sort((a, b) => a.firstStartOrder - b.firstStartOrder)
      .map((aggregate) => {
        const attributes = summaryAttributes(aggregate.attributes);
        const counters = mapToSortedRecord(aggregate.counters);
        return {
          name: aggregate.name,
          totalMs: aggregate.totalMs,
          calls: aggregate.calls,
          averageMs: aggregate.calls === 0 ? 0 : aggregate.totalMs / aggregate.calls,
          maxMs: aggregate.maxMs,
          ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
          ...(Object.keys(counters).length > 0 ? { counters } : {}),
          ...(aggregate.errors > 0 ? { errors: aggregate.errors } : {}),
        };
      });
  }

  _record(record: RecordedLocalSpan): void {
    this._records.push(record);
  }
}

interface RecordedLocalSpan extends LocalSpanRecord {
  readonly startOrder: number;
}

interface MutableProfileSummary {
  readonly name: string;
  totalMs: number;
  calls: number;
  maxMs: number;
  firstStartOrder: number;
  readonly attributes: Map<string, Set<InstrumentAttributeValue>>;
  readonly counters: Map<string, number>;
  errors: number;
}

function sortAttributes(attributes: InstrumentAttributes): InstrumentAttributes {
  return Object.fromEntries(Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b)));
}

function mapToSortedRecord<T extends InstrumentAttributeValue | number>(
  map: ReadonlyMap<string, T>,
): Readonly<Record<string, T>> {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function summaryAttributes(
  attributes: ReadonlyMap<string, ReadonlySet<InstrumentAttributeValue>>,
): Readonly<Record<string, readonly InstrumentAttributeValue[]>> {
  return Object.fromEntries(
    [...attributes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => [
        key,
        [...values].sort((a, b) => String(a).localeCompare(String(b))),
      ]),
  );
}

function formatSpanError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error);
}
