import type { Namespace, PluginFailurePolicy } from "../../core/index.js";

export interface ConfigExtractionRange {
  readonly sinceRef?: string;
  readonly sinceDate?: string;
}

export interface ConfigExtractionSection {
  readonly refs?: readonly string[];
  readonly range?: ConfigExtractionRange;
}

export interface ConfigRotationSection {
  readonly lines?: number;
  readonly size?: string;
}

export interface ConfigOutputSection {
  readonly directory?: string;
  readonly prefix?: string;
  readonly rotation?: ConfigRotationSection;
}

export interface ConfigRepositorySection {
  readonly name?: string;
  readonly url?: string;
}

export interface ConfigRuntimeSection {
  readonly profile?: boolean;
}

export interface ConfigExtensionEntry {
  readonly entrypoint: string;
  readonly config?: unknown;
  readonly failurePolicy: PluginFailurePolicy;
}

export type ConfigExtensionsSection = Readonly<Record<Namespace, ConfigExtensionEntry>>;

export interface ConfigFileV1 {
  readonly version: 1;
  readonly extraction?: ConfigExtractionSection;
  readonly output?: ConfigOutputSection;
  readonly repository?: ConfigRepositorySection;
  readonly runtime?: ConfigRuntimeSection;
  readonly extensions?: ConfigExtensionsSection;
}

export interface LoadedConfigFile {
  readonly path: string;
  readonly directory: string;
  readonly config: ConfigFileV1;
}

export type LoadConfigResult =
  | { kind: "loaded"; loaded: LoadedConfigFile }
  | { kind: "termination"; termination: { kind: "user-error"; message: string } };
