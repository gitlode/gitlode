import type {
  FactFor,
  FactType,
  ProjectedExtensionValue,
  ProjectedRecordFor,
} from "@gitlode/internal-contracts/extraction";
import type { Instrumentation } from "@gitlode/internal-foundation/instrumentation";
import type { Brand } from "@gitlode/internal-foundation/type-utils";

export interface DiagnosticReporter {
  warn(message: string): void;
  error(message: string): void;
}

export type PluginFailurePolicy = "skip-fact" | "fatal";

export type PluginInitSuccess = { type: "ready" };

export type PluginInitFatal = { type: "fatal" };

export type PluginInitResult = PluginInitSuccess | PluginInitFatal;

/**
 * A value a plugin may return as successful projection data.
 * Return `{ type: "skip" }` instead of `null` when no data should be attached.
 */
export type PluginProjectionValue = Exclude<ProjectedExtensionValue, null>;

export type PluginProjectionResult =
  | { type: "success"; data: PluginProjectionValue }
  | { type: "skip" }
  | { type: "fatal" };

type ProjectionContextFor<Type extends FactType> = {
  readonly fact: FactFor<Type>;
  readonly baseRecord: Readonly<ProjectedRecordFor<Type>>;
};

/** Read-only fact and base-record pair passed to plugins for enrichment. */
export type ProjectionContext = {
  [Type in FactType]: ProjectionContextFor<Type>;
}[FactType];

export interface PluginRuntimeContext extends DiagnosticReporter {
  readonly instrumentation: Instrumentation;
}

/** Contract implemented by every projector plugin. */
export interface ProjectorPlugin {
  init(runtime: PluginRuntimeContext): Promise<PluginInitResult>;
  project(context: ProjectionContext): Promise<PluginProjectionResult>;
}

/** ESM module default-export signature for plugin factories. */
export type PluginFactory = (config: unknown) => ProjectorPlugin | Promise<ProjectorPlugin>;

/** Validated plugin namespace matching `/^[a-z0-9-]+$/`. */
export type Namespace = Brand<string, "Namespace">;
