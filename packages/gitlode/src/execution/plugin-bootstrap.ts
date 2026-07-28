import type { FactProjector } from "../extraction-api/index.js";
import type { Instrumentation } from "../instrumentation/index.js";
import {
  checkPluginCompatibility,
  EnrichingFactProjector,
  initializePlugins,
  type PluginDeclarations,
  type PluginInitializationFailure,
  resolvePluginEntries,
} from "../plugin-runtime/index.js";
import type { ProgressReporter } from "../progress/index.js";
import type { AbsoluteDirectoryPath } from "../support/index.js";

interface PluginBootstrapProgress {
  readonly reporter: ProgressReporter;
  readonly renderDiagnostic: (severity: "warn" | "error", message: string) => void;
}

type BuildPluginProjectorResult =
  | {
      readonly kind: "success";
      readonly projector: FactProjector;
    }
  | {
      readonly kind: "termination";
      readonly message: string;
    };

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
  progress: PluginBootstrapProgress,
  instrumentation: Instrumentation,
): Promise<BuildPluginProjectorResult> {
  progress.reporter.emit({ type: "phase-start", phase: "initializing-plugins" });

  const pluginEntriesResult = await instrumentation.runAsync(
    "gitlode.plugins.resolve_entries",
    async () => await resolvePluginEntries(declarations, baseDirectory),
  );
  if (pluginEntriesResult.kind === "termination") {
    return {
      kind: "termination",
      message: pluginEntriesResult.termination.message,
    };
  }

  const pluginEntries = pluginEntriesResult.entries;

  await instrumentation.runAsync("gitlode.plugins.check_compatibility", async () => {
    await checkPluginCompatibility(pluginEntries, declarations, baseDirectory, {
      warn(message) {
        progress.renderDiagnostic("warn", message);
      },
    });
  });

  const pluginInitResults = await instrumentation.runAsync(
    "gitlode.plugins.initialize",
    async (span) => {
      span.incrementCounter("plugins", pluginEntries.length);
      return await initializePlugins(pluginEntries, (entry) => ({
        warn(message) {
          progress.renderDiagnostic("warn", `Plugin "${entry.namespace}": ${message}`);
        },
        error(message) {
          progress.renderDiagnostic("error", `Plugin "${entry.namespace}": ${message}`);
        },
        instrumentation,
      }));
    },
  );

  const pluginInitFailures = pluginInitResults.filter((result) => result.type === "fatal");
  if (pluginInitFailures.length > 0) {
    return {
      kind: "termination",
      message: pluginInitFailures
        .map((result) => formatPluginInitializationFailure(result))
        .join("\n"),
    };
  }

  progress.reporter.emit({ type: "phase-end", phase: "initializing-plugins" });
  return {
    kind: "success",
    projector: new EnrichingFactProjector(baseProjector, pluginEntries, progress.reporter),
  };
}
