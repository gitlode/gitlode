export { checkPluginCompatibility } from "./compatibility-checker.js";
export { initializePlugins } from "./initializer.js";
export { resolvePluginEntries } from "./module-loader.js";
export { EnrichingFactProjector } from "./plugin-enriching-projector.js";
export type {
  PluginDeclaration,
  PluginDeclarations,
  PluginEntry,
  PluginInitializationFailure,
  PluginInitializationOutcome,
  PluginInitializationSuccess,
  PluginSetupTermination,
  ResolvePluginEntriesResult,
} from "./types.js";
