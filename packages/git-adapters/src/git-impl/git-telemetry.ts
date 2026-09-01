import { GitAdapterError } from "@gitlode/internal-contracts/git";
import {
  getTelemetryAttributeMetadata,
  type TelemetryAttributeId,
} from "@gitlode/internal-contracts/telemetry";
import { recordSpanError } from "@gitlode/internal-foundation/otel-support";
import {
  context,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";

export const attributeKey = (id: TelemetryAttributeId): string =>
  getTelemetryAttributeMetadata(id).key;

export async function withGitAsyncSpan<T>(
  tracer: Tracer,
  name: string,
  callback: (span: Span) => Promise<T>,
  options: SpanOptions | undefined,
  parent: Context,
): Promise<T> {
  const span = tracer.startSpan(name, options, parent);
  try {
    return await context.with(trace.setSpan(parent, span), () => callback(span));
  } catch (error) {
    if (error instanceof GitAdapterError) span.setStatus({ code: SpanStatusCode.ERROR });
    else recordSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

export function setGitProcessError(span: Span, error: unknown): void {
  if (error instanceof GitAdapterError) span.setStatus({ code: SpanStatusCode.ERROR });
  else {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.recordException(new Error("Git adapter runtime failure"));
  }
}
