import type { Meter, Tracer } from "@opentelemetry/api";

import type {
  Namespace,
  PluginFailurePolicy,
  PluginInitFatal,
  PluginInitSuccess,
  PluginRuntimeContext,
  ProjectorPlugin,
} from "../plugin-api/index.js";
import type { PluginProjectionMetricRecorder } from "./plugin-projection-metric-recorder.js";

interface PluginDeclaration {
  readonly entrypoint: string;
  readonly config?: unknown;
  readonly failurePolicy: PluginFailurePolicy;
}

export type PluginDeclarations = Readonly<Record<Namespace, PluginDeclaration>>;

/** Runtime registry entry for a loaded and initialized plugin. */
export interface PluginEntry {
  readonly namespace: Namespace;
  readonly plugin: ProjectorPlugin;
  readonly failurePolicy: PluginFailurePolicy;
  readonly entrypoint: string;
  readonly resolvedEntrypointUrl: string;
}

interface PluginTelemetryScope {
  readonly name: string;
  readonly version?: string;
}

export interface PluginPackageResolution {
  readonly scope: PluginTelemetryScope;
  readonly manifestPath?: string;
  readonly manifest?: unknown;
}

export interface PluginRuntimeEntry extends PluginEntry {
  readonly runtimeContext: PluginRuntimeContext;
  readonly tracer: Tracer;
  readonly meter: Meter;
  readonly projectionMetricRecorder: PluginProjectionMetricRecorder;
}

export type PluginSetupTermination = { kind: "user-error"; message: string };

export type ResolvePluginEntriesResult =
  | { kind: "resolved"; entries: PluginEntry[] }
  | { kind: "termination"; termination: PluginSetupTermination };

export interface PluginInitializationSuccess extends PluginInitSuccess {
  readonly entry: PluginEntry;
}

export interface PluginInitializationFailure extends PluginInitFatal {
  readonly entry: PluginEntry;
}

export type PluginInitializationOutcome = PluginInitializationSuccess | PluginInitializationFailure;
