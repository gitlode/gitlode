import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { satisfies, validRange } from "semver";

import type { ConfigExtensionsSection } from "../config/index.js";
import type {
  DiagnosticReporter,
  Namespace,
  PluginEntry,
  PluginFactory,
  PluginInitFatal,
  PluginInitSuccess,
  PluginRuntimeContext,
  ProjectorPlugin,
} from "../core/index.js";
import type { AbsoluteDirectoryPath } from "../support/index.js";

export type PluginSetupTermination = { kind: "user-error"; message: string };

export type ResolvePluginEntriesResult =
  | { kind: "resolved"; entries: PluginEntry[] }
  | { kind: "termination"; termination: PluginSetupTermination };

class PluginSetupSignal extends Error {
  readonly termination: PluginSetupTermination;

  constructor(termination: PluginSetupTermination) {
    super(termination.message);
    this.name = "PluginSetupSignal";
    this.termination = termination;
  }
}

function configError(msg: string): never {
  throw new PluginSetupSignal({ kind: "user-error", message: msg });
}

/**
 * Resolve plugin entrypoints, invoke their factory functions, and return a
 * list of PluginEntry records. The configPath is used to resolve relative
 * entrypoints.
 */
export async function resolvePluginEntries(
  extensions: ConfigExtensionsSection,
  baseDir: AbsoluteDirectoryPath,
): Promise<ResolvePluginEntriesResult> {
  try {
    const entries: PluginEntry[] = [];

    for (const [namespace, extEntry] of Object.entries(extensions)) {
      const { entrypoint, config: pluginConfig, failurePolicy } = extEntry;

      let resolvedSpecifier: string;
      if (entrypoint.startsWith(".") || isAbsolute(entrypoint)) {
        resolvedSpecifier = pathToFileURL(resolve(baseDir, entrypoint)).href;
      } else {
        // Bare specifier: resolve from config file's directory using require.resolve
        try {
          const req = createRequire(pathToFileURL(baseDir + "/").href);
          resolvedSpecifier = pathToFileURL(req.resolve(entrypoint)).href;
        } catch {
          configError(
            `Cannot resolve plugin entrypoint "${entrypoint}" for namespace "${namespace}"`,
          );
        }
      }

      let mod: unknown;
      try {
        mod = await import(resolvedSpecifier);
      } catch (err) {
        configError(
          `Failed to load plugin "${entrypoint}" for namespace "${namespace}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const factory = (mod as { default?: unknown })?.default;
      if (typeof factory !== "function") {
        configError(
          `Plugin "${entrypoint}" for namespace "${namespace}" does not export a default function`,
        );
      }

      let plugin: ProjectorPlugin;
      try {
        plugin = (await (factory as PluginFactory)(pluginConfig)) as ProjectorPlugin;
      } catch (err) {
        configError(
          `Plugin factory for namespace "${namespace}" threw an error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (typeof plugin !== "object" || plugin === null || typeof plugin.project !== "function") {
        configError(
          `Plugin factory for namespace "${namespace}" did not return a valid ProjectorPlugin`,
        );
      }

      entries.push({ namespace: namespace as Namespace, plugin, failurePolicy });
    }

    return { kind: "resolved", entries };
  } catch (err) {
    if (err instanceof PluginSetupSignal) {
      return { kind: "termination", termination: err.termination };
    }
    throw err;
  }
}

export interface PluginInitializationSuccess extends PluginInitSuccess {
  readonly entry: PluginEntry;
}

export interface PluginInitializationFailure extends PluginInitFatal {
  readonly entry: PluginEntry;
}

export type PluginInitializationOutcome = PluginInitializationSuccess | PluginInitializationFailure;

/** Invoke init() on each entry in parallel and return each plugin's normalized outcome. */
export async function initializePlugins(
  entries: PluginEntry[],
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
        };
      } catch (err) {
        runtimeContext?.error(err instanceof Error ? err.message : String(err));
        return {
          entry,
          type: "fatal",
        };
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Compatibility check
// ---------------------------------------------------------------------------

// Read core version once from this package's own package.json. Cached after
// the first call. Returns null when the version cannot be determined.
let _cachedCoreVersion: string | null | undefined = undefined;

async function readCoreVersion(): Promise<string | null> {
  if (_cachedCoreVersion !== undefined) {
    return _cachedCoreVersion;
  }
  try {
    const pkgUrl = new URL("../../package.json", import.meta.url);
    const raw = await readFile(fileURLToPath(pkgUrl), "utf8");
    const pkg = JSON.parse(raw) as { version?: unknown };
    _cachedCoreVersion = typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    _cachedCoreVersion = null;
  }
  return _cachedCoreVersion;
}

const MAX_WALK_STEPS = 20;

async function findNearestPackageJson(
  entrypointUrl: string,
): Promise<{ filePath: string; data: unknown } | null> {
  let dir: string;
  try {
    dir = dirname(fileURLToPath(entrypointUrl));
  } catch {
    return null;
  }

  for (let i = 0; i < MAX_WALK_STEPS; i++) {
    const candidate = resolve(dir, "package.json");
    try {
      const raw = await readFile(candidate, "utf8");
      return { filePath: candidate, data: JSON.parse(raw) };
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        break; // filesystem root reached
      }
      dir = parent;
    }
  }
  return null;
}

function resolveEntrypointToUrl(entrypoint: string, baseDir: AbsoluteDirectoryPath): string | null {
  try {
    if (entrypoint.startsWith(".") || isAbsolute(entrypoint)) {
      return pathToFileURL(resolve(baseDir, entrypoint)).href;
    }
    const req = createRequire(pathToFileURL(baseDir + "/").href);
    return pathToFileURL(req.resolve(entrypoint)).href;
  } catch {
    return null;
  }
}

/**
 * Check each plugin's declared `peerDependencies.gitlode` range against the
 * running core version. Emits a warning to stderr for each mismatch or missing
 * declaration. Never causes a non-zero exit — always warning-only.
 *
 * Must be called before `initializePlugins` and skipped when no config is
 * provided (the caller is responsible for that guard).
 */
export async function checkPluginCompatibility(
  entries: PluginEntry[],
  extensions: ConfigExtensionsSection,
  baseDir: AbsoluteDirectoryPath,
  reporter: Pick<DiagnosticReporter, "warn">,
): Promise<void> {
  const coreVersion = await readCoreVersion();
  if (coreVersion === null) {
    return; // Cannot determine core version; skip all checks silently
  }

  for (const entry of entries) {
    const extEntry = extensions[entry.namespace];
    if (!extEntry) continue;

    const entrypointUrl = resolveEntrypointToUrl(extEntry.entrypoint, baseDir);
    if (entrypointUrl === null) {
      reporter.warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${extEntry.entrypoint}.`,
      );
      continue;
    }

    const found = await findNearestPackageJson(entrypointUrl);
    if (found === null) {
      reporter.warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${extEntry.entrypoint}.`,
      );
      continue;
    }

    const { filePath, data: pkgData } = found;

    let peerRange: string | undefined;
    try {
      const pkg = pkgData as { peerDependencies?: Record<string, string> };
      peerRange = pkg.peerDependencies?.["gitlode"];
    } catch {
      reporter.warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${filePath}.`,
      );
      continue;
    }

    if (peerRange === undefined) {
      reporter.warn(
        `Plugin "${entry.namespace}" does not declare peerDependencies.gitlode. Compatibility unknown; continuing.`,
      );
      continue;
    }

    if (validRange(peerRange) === null) {
      reporter.warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${filePath}.`,
      );
      continue;
    }

    if (!satisfies(coreVersion, peerRange)) {
      reporter.warn(
        `Plugin "${entry.namespace}" declares peer gitlode ${peerRange}, but running gitlode is ${coreVersion}. Continuing; behavior may be incompatible.`,
      );
    }
    // Range satisfied → no output
  }
}
