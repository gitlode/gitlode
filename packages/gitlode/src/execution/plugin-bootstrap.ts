import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type { FactProjector } from "@gitlode/internal-contracts/extraction";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";
import { getTelemetryAttributeMetadata } from "@gitlode/internal-contracts/telemetry";
import { recordSpanError } from "@gitlode/internal-foundation/otel-support";
import type { AbsoluteDirectoryPath } from "@gitlode/internal-foundation/support";
import {
  context,
  SpanStatusCode,
  trace,
  type Context,
  type Meter,
  type Tracer,
} from "@opentelemetry/api";

import {
  checkPluginCompatibility,
  createPluginProjectionMetricRecorder,
  EnrichingFactProjector,
  initializePlugins,
  type PluginDeclarations,
  type PluginInitializationFailure,
  type PluginRuntimeEntry,
  resolvePluginEntries,
} from "../plugin-runtime/index.js";

interface PluginBootstrapReporters {
  readonly progressReporter: ProgressReporter;
  readonly diagnosticReporter: DiagnosticReporter;
}

interface PluginBootstrapTelemetry {
  readonly pluginRuntimeTracer: Tracer;
  readonly projectionTracer: Tracer;
  readonly rootContext: Context;
  readonly getPluginTracer: (name: string, version?: string) => Tracer;
  readonly getPluginMeter: (name: string, version?: string) => Meter;
}

type BuildPluginProjectorResult =
  | { readonly kind: "success"; readonly projector: FactProjector }
  | { readonly kind: "termination"; readonly message: string };

function formatPluginInitializationFailure(result: PluginInitializationFailure): string {
  return `Plugin "${result.entry.namespace}" init failed.`;
}

export function hasEffectivePluginDeclarations(
  declarations: PluginDeclarations | undefined,
): declarations is PluginDeclarations {
  return declarations !== undefined && Object.keys(declarations).length > 0;
}

export async function buildPluginProjector(
  declarations: PluginDeclarations,
  baseDirectory: AbsoluteDirectoryPath,
  baseProjector: FactProjector,
  reporters: PluginBootstrapReporters,
  telemetry: PluginBootstrapTelemetry,
): Promise<BuildPluginProjectorResult> {
  const configuredCount = Object.keys(declarations).length;
  const configuredCountKey = getTelemetryAttributeMetadata("plugin_configured_count").key;
  const resolvedCountKey = getTelemetryAttributeMetadata("plugin_resolved_count").key;
  const readyCountKey = getTelemetryAttributeMetadata("plugin_ready_count").key;
  const failedCountKey = getTelemetryAttributeMetadata("plugin_failed_count").key;
  const warningCountKey = getTelemetryAttributeMetadata("plugin_compatibility_warning_count").key;
  const bootstrapSpan = telemetry.pluginRuntimeTracer.startSpan(
    "gitlode.plugin.bootstrap",
    { attributes: { [configuredCountKey]: configuredCount } },
    telemetry.rootContext,
  );
  const bootstrapContext = trace.setSpan(telemetry.rootContext, bootstrapSpan);

  try {
    reporters.progressReporter.emit({ type: "phase-start", phase: "initializing-plugins" });

    const resolveSpan = telemetry.pluginRuntimeTracer.startSpan(
      "gitlode.plugin.resolve",
      { attributes: { [configuredCountKey]: configuredCount } },
      bootstrapContext,
    );
    let pluginEntriesResult;
    try {
      const resolveContext = trace.setSpan(bootstrapContext, resolveSpan);
      pluginEntriesResult = await context.with(
        resolveContext,
        async () => await resolvePluginEntries(declarations, baseDirectory),
      );
      if (pluginEntriesResult.kind === "resolved") {
        resolveSpan.setAttribute(resolvedCountKey, pluginEntriesResult.entries.length);
      } else {
        resolveSpan.setStatus({ code: SpanStatusCode.ERROR });
      }
    } catch (error) {
      recordSpanError(resolveSpan, error);
      throw error;
    } finally {
      resolveSpan.end();
    }

    if (pluginEntriesResult.kind === "termination") {
      bootstrapSpan.setStatus({ code: SpanStatusCode.ERROR });
      return { kind: "termination", message: pluginEntriesResult.termination.message };
    }

    const pluginEntries = pluginEntriesResult.entries;
    bootstrapSpan.setAttribute(resolvedCountKey, pluginEntries.length);
    const compatibilitySpan = telemetry.pluginRuntimeTracer.startSpan(
      "gitlode.plugin.compatibility.check",
      { attributes: { [resolvedCountKey]: pluginEntries.length } },
      bootstrapContext,
    );
    let compatibilityResult;
    try {
      const compatibilityContext = trace.setSpan(bootstrapContext, compatibilitySpan);
      compatibilityResult = await context.with(compatibilityContext, async () =>
        checkPluginCompatibility(pluginEntries, {
          warn(message) {
            reporters.diagnosticReporter.report({ severity: "warn", message });
          },
        }),
      );
      compatibilitySpan.setAttribute(warningCountKey, compatibilityResult.warningCount);
    } catch (error) {
      recordSpanError(compatibilitySpan, error);
      throw error;
    } finally {
      compatibilitySpan.end();
    }

    const scopeBindings = new Map<
      string,
      Pick<PluginRuntimeEntry, "tracer" | "meter" | "projectionMetricRecorder">
    >();
    const runtimeEntries: PluginRuntimeEntry[] = compatibilityResult.resolutions.map(
      ({ entry, packageResolution }) => {
        const { name, version } = packageResolution.scope;
        const identity = `${name}\u0000${version ?? ""}`;
        let binding = scopeBindings.get(identity);
        if (binding === undefined) {
          const tracer = telemetry.getPluginTracer(name, version);
          const meter = telemetry.getPluginMeter(name, version);
          binding = {
            tracer,
            meter,
            projectionMetricRecorder: createPluginProjectionMetricRecorder(meter),
          };
          scopeBindings.set(identity, binding);
        }
        return {
          ...entry,
          ...binding,
          runtimeContext: {
            tracer: binding.tracer,
            meter: binding.meter,
            warn(message) {
              reporters.diagnosticReporter.report({
                severity: "warn",
                message: `Plugin "${entry.namespace}": ${message}`,
              });
            },
            error(message) {
              reporters.diagnosticReporter.report({
                severity: "error",
                message: `Plugin "${entry.namespace}": ${message}`,
              });
            },
          },
        };
      },
    );

    const pluginInitResults = await initializePlugins(runtimeEntries, bootstrapContext);
    const pluginInitFailures = pluginInitResults.filter((result) => result.type === "fatal");
    bootstrapSpan.setAttribute(readyCountKey, pluginInitResults.length - pluginInitFailures.length);
    bootstrapSpan.setAttribute(failedCountKey, pluginInitFailures.length);
    if (pluginInitFailures.length > 0) {
      bootstrapSpan.setStatus({ code: SpanStatusCode.ERROR });
      return {
        kind: "termination",
        message: pluginInitFailures
          .map((result) => formatPluginInitializationFailure(result))
          .join("\n"),
      };
    }

    const projector = new EnrichingFactProjector(
      baseProjector,
      runtimeEntries,
      reporters.diagnosticReporter,
      telemetry.projectionTracer,
    );
    reporters.progressReporter.emit({ type: "phase-end", phase: "initializing-plugins" });
    return { kind: "success", projector };
  } catch (error) {
    recordSpanError(bootstrapSpan, error);
    throw error;
  } finally {
    bootstrapSpan.end();
  }
}
