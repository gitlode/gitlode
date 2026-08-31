import type { Context, Exception, Span, SpanOptions, SpanStatus, Tracer } from "@opentelemetry/api";

export interface TestSpan extends Span {
  readonly attributes: Record<string, unknown>;
  readonly exceptions: Exception[];
  readonly statuses: SpanStatus[];
  endCount: number;
}

function makeSpan(): TestSpan {
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

export function makeTracer(): {
  tracer: Tracer;
  starts: Array<{ name: string; options?: SpanOptions; parent?: Context; span: TestSpan }>;
} {
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
