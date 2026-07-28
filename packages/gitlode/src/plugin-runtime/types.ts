import type {
  Namespace,
  PluginFailurePolicy,
  PluginInitFatal,
  PluginInitSuccess,
  ProjectorPlugin,
} from "../plugin-api/index.js";

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
