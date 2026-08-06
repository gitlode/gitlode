import type { PluginRuntimeContext } from "../plugin-api/index.js";
import type {
  PluginEntry,
  PluginInitializationOutcome,
  PluginInitializationFailure,
  PluginInitializationSuccess,
} from "./types.js";

/** Invoke init() on each entry in parallel and return each plugin's normalized outcome. */
export async function initializePlugins(
  entries: readonly PluginEntry[],
  createRuntimeContext: (entry: PluginEntry) => PluginRuntimeContext,
): Promise<PluginInitializationOutcome[]> {
  return Promise.all(
    entries.map<Promise<PluginInitializationOutcome>>(async (entry) => {
      let runtimeContext: PluginRuntimeContext | undefined;
      try {
        runtimeContext = createRuntimeContext(entry);
        return {
          entry,
          ...(await entry.plugin.init(runtimeContext)),
        } satisfies PluginInitializationSuccess | PluginInitializationFailure;
      } catch (error) {
        runtimeContext?.error(error instanceof Error ? error.message : String(error));
        return {
          entry,
          type: "fatal",
        };
      }
    }),
  );
}
