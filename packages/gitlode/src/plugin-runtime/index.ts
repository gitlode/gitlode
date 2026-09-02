export { checkPluginCompatibility } from "./compatibility-checker.js";
export { initializePlugins } from "./initializer.js";
export { resolvePluginEntries } from "./module-loader.js";
export { EnrichingFactProjector } from "./plugin-enriching-projector.js";
export {
  createPluginProjectionMetricRecorder,
  NOOP_PLUGIN_PROJECTION_METRIC_RECORDER,
  type PluginProjectionMetricRecorder,
  type PluginProjectionOutcome,
} from "./plugin-projection-metric-recorder.js";
export type {
  PluginDeclarations,
  PluginEntry,
  PluginInitializationFailure,
  PluginRuntimeEntry,
} from "./types.js";
