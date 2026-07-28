import type { Namespace, PluginFailurePolicy } from "../plugin-api/index.js";
import type { IsoDateTimeString } from "../support/index.js";

interface ConfigExtractionRange {
  readonly sinceRef?: string;
  readonly sinceDate?: IsoDateTimeString;
}

interface ConfigExtractionSection {
  readonly refs?: readonly string[];
  readonly range?: ConfigExtractionRange;
}

interface ConfigRotationSection {
  readonly lines?: number;
  readonly size?: number;
}

interface ConfigOutputSection {
  readonly directory?: string;
  readonly prefix?: string;
  readonly rotation?: ConfigRotationSection;
}

interface ConfigRepositorySection {
  readonly name?: string;
  readonly url?: string;
}

export type GitAdapterName = "isomorphic-git" | "git-cli";

interface ConfigRuntimeSection {
  readonly profile?: boolean;
  readonly gitAdapter?: GitAdapterName;
}

interface ConfigExtensionEntry {
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

export type ConfigDiagnosticCode = "not-found" | "read-failed" | "invalid-json" | "invalid-schema";

interface ConfigDiagnostic {
  readonly code: ConfigDiagnosticCode;
  readonly message: string;
}

export type ConfigLoadResult =
  | { readonly kind: "success"; readonly value: ProjectConfigurationV1 }
  | { readonly kind: "failure"; readonly diagnostic: ConfigDiagnostic };
