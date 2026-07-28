import { createRequire } from "node:module";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Namespace, PluginFactory, ProjectorPlugin } from "../plugin-api/index.js";
import type { AbsoluteDirectoryPath } from "../support/index.js";
import type {
  PluginDeclarations,
  PluginSetupTermination,
  ResolvePluginEntriesResult,
} from "./types.js";

class PluginSetupSignal extends Error {
  readonly termination: PluginSetupTermination;

  constructor(termination: PluginSetupTermination) {
    super(termination.message);
    this.name = "PluginSetupSignal";
    this.termination = termination;
  }
}

function configError(message: string): never {
  throw new PluginSetupSignal({ kind: "user-error", message });
}

function resolvePluginSpecifier(
  entrypoint: string,
  namespace: string,
  baseDir: AbsoluteDirectoryPath,
): string {
  if (entrypoint.startsWith(".") || isAbsolute(entrypoint)) {
    return pathToFileURL(resolve(baseDir, entrypoint)).href;
  }

  try {
    const requireFromBaseDirectory = createRequire(pathToFileURL(baseDir + "/").href);
    return pathToFileURL(requireFromBaseDirectory.resolve(entrypoint)).href;
  } catch {
    configError(`Cannot resolve plugin entrypoint "${entrypoint}" for namespace "${namespace}"`);
  }
}

async function loadPluginModule(
  entrypoint: string,
  namespace: string,
  resolvedSpecifier: string,
): Promise<unknown> {
  try {
    return await import(resolvedSpecifier);
  } catch (error) {
    configError(
      `Failed to load plugin "${entrypoint}" for namespace "${namespace}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function createPlugin(
  module: unknown,
  entrypoint: string,
  namespace: string,
  pluginConfig: unknown,
): Promise<ProjectorPlugin> {
  const factory = (module as { default?: unknown })?.default;
  if (typeof factory !== "function") {
    configError(
      `Plugin "${entrypoint}" for namespace "${namespace}" does not export a default function`,
    );
  }

  let plugin: ProjectorPlugin;
  try {
    plugin = (await (factory as PluginFactory)(pluginConfig)) as ProjectorPlugin;
  } catch (error) {
    configError(
      `Plugin factory for namespace "${namespace}" threw an error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof plugin !== "object" || plugin === null || typeof plugin.project !== "function") {
    configError(
      `Plugin factory for namespace "${namespace}" did not return a valid ProjectorPlugin`,
    );
  }
  return plugin;
}

/** Resolve plugin entrypoints and invoke their factory functions in declaration order. */
export async function resolvePluginEntries(
  declarations: PluginDeclarations,
  baseDir: AbsoluteDirectoryPath,
): Promise<ResolvePluginEntriesResult> {
  try {
    const entries = [];

    for (const [namespace, declaration] of Object.entries(declarations)) {
      const { entrypoint, config: pluginConfig, failurePolicy } = declaration;
      const resolvedSpecifier = resolvePluginSpecifier(entrypoint, namespace, baseDir);
      const module = await loadPluginModule(entrypoint, namespace, resolvedSpecifier);
      const plugin = await createPlugin(module, entrypoint, namespace, pluginConfig);
      entries.push({ namespace: namespace as Namespace, plugin, failurePolicy });
    }

    return { kind: "resolved", entries };
  } catch (error) {
    if (error instanceof PluginSetupSignal) {
      return { kind: "termination", termination: error.termination };
    }
    throw error;
  }
}
