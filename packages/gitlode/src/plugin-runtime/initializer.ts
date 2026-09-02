import { getTelemetryAttributeMetadata } from "@gitlode/internal-contracts/telemetry";
import { recordSpanError } from "@gitlode/internal-foundation/otel-support";
import { context, SpanStatusCode, trace, type Context } from "@opentelemetry/api";

import type {
  PluginInitializationOutcome,
  PluginInitializationFailure,
  PluginInitializationSuccess,
  PluginRuntimeEntry,
} from "./types.js";

/** Invoke init() on each entry in parallel and return each plugin's normalized outcome. */
export async function initializePlugins(
  entries: readonly PluginRuntimeEntry[],
  parentContext: Context,
): Promise<PluginInitializationOutcome[]> {
  return Promise.all(
    entries.map<Promise<PluginInitializationOutcome>>(async (entry) => {
      const span = entry.tracer.startSpan("gitlode.plugin.init", undefined, parentContext);
      const initContext = trace.setSpan(parentContext, span);
      try {
        const result = await context.with(
          initContext,
          async () => await entry.plugin.init(entry.runtimeContext),
        );
        span.setAttribute(getTelemetryAttributeMetadata("plugin_init_result").key, result.type);
        if (result.type === "fatal") {
          span.setAttribute(
            getTelemetryAttributeMetadata("plugin_init_failure_source").key,
            "returned",
          );
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        span.end();
        return {
          entry,
          ...result,
        } satisfies PluginInitializationSuccess | PluginInitializationFailure;
      } catch (error) {
        span.setAttribute(getTelemetryAttributeMetadata("plugin_init_result").key, "fatal");
        span.setAttribute(
          getTelemetryAttributeMetadata("plugin_init_failure_source").key,
          "thrown",
        );
        recordSpanError(span, error);
        span.end();
        entry.runtimeContext.error(error instanceof Error ? error.message : String(error));
        return {
          entry,
          type: "fatal",
        };
      }
    }),
  );
}
