import type { Namespace, PluginFailurePolicy } from "../../core/index.js";

export interface ConfigExtractionRange {
  readonly sinceRef?: string;
  readonly sinceDate?: Date;
}

export interface ConfigExtractionSection {
  readonly refs?: readonly string[];
  readonly range?: ConfigExtractionRange;
}

export interface ConfigRotationSection {
  readonly lines?: number;
  readonly size?: number;
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

export interface ProjectConfigurationV1 {
  readonly version: 1;
  readonly extraction?: ConfigExtractionSection;
  readonly output?: ConfigOutputSection;
  readonly repository?: ConfigRepositorySection;
  readonly runtime?: ConfigRuntimeSection;
  readonly extensions?: ConfigExtensionsSection;
}
