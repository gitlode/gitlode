import {
  context,
  SpanStatusCode,
  trace,
  type Context,
  type Exception,
  type Span,
  type SpanOptions,
  type Tracer,
} from "@opentelemetry/api";

type Synchronous<T> = T extends PromiseLike<unknown> ? never : T;

function normalizeException(error: unknown): Exception {
  if (error instanceof Error || typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return { name: "NonErrorThrown", message: String(error) };
  }
  if (typeof error === "symbol") return { name: "NonErrorThrown", message: "Symbol" };
  if (error === null) return { name: "NonErrorThrown", message: "null" };
  if (error === undefined) return { name: "NonErrorThrown", message: "undefined" };
  return { name: "NonErrorThrown", message: "Object" };
}

export function recordSpanError(span: Span, error: unknown): void {
  span.recordException(normalizeException(error));
  span.setStatus({ code: SpanStatusCode.ERROR });
}

export function withSpan<T>(
  tracer: Tracer,
  name: string,
  callback: (span: Span) => Synchronous<T>,
  options?: SpanOptions,
  parentContext: Context = context.active(),
): T {
  const span = tracer.startSpan(name, options, parentContext);
  try {
    return context.with(trace.setSpan(parentContext, span), callback, undefined, span) as T;
  } catch (error) {
    recordSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

export async function withAsyncSpan<T>(
  tracer: Tracer,
  name: string,
  callback: (span: Span) => PromiseLike<T>,
  options?: SpanOptions,
  parentContext: Context = context.active(),
): Promise<T> {
  const span = tracer.startSpan(name, options, parentContext);
  try {
    return await context.with(trace.setSpan(parentContext, span), callback, undefined, span);
  } catch (error) {
    recordSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}
