import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { satisfies, validRange } from "semver";
import { z } from "zod";

import type {
  Namespace,
  PluginEntry,
  PluginFactory,
  PluginFailurePolicy,
  ProjectorPlugin,
} from "../core/index.js";

// ---------------------------------------------------------------------------
// Config file schema types
// ---------------------------------------------------------------------------

export interface PluginExtensionEntry {
  readonly entrypoint: string;
  readonly config?: unknown;
  readonly failurePolicy: PluginFailurePolicy;
}

export interface PluginConfigFile {
  readonly version: 1;
  readonly extensions: Readonly<Record<Namespace, PluginExtensionEntry>>;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const NAMESPACE_PATTERN = /^[a-z0-9-]+$/;

function isNamespace(s: string): s is Namespace {
  return NAMESPACE_PATTERN.test(s);
}

const PluginExtensionEntrySchema = z
  .object({
    entrypoint: z.string().min(1, "must be a non-empty string"),
    config: z.unknown().optional(),
    failurePolicy: z.enum(["skip-fact", "fatal"]).default("skip-fact"),
  })
  .strict();

const PluginConfigFileSchema = z
  .object({
    version: z.literal(1),
    extensions: z
      .record(
        z.string().refine(isNamespace, { message: "must match pattern [a-z0-9-]+" }),
        PluginExtensionEntrySchema,
      )
      .refine((ext) => Object.keys(ext).length > 0, {
        message: '"extensions" must contain at least one entry',
      }),
  })
  .strict();

function configError(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function validatePluginConfig(raw: unknown, configPath: string): PluginConfigFile {
  const result = PluginConfigFileSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
      return `${path}: ${issue.message}`;
    });
    configError(`Invalid config file${messages.join("; ")} (${configPath})`);
  }
  // Zod validates all namespace keys via isNamespace; cast bridges the Namespace key type.
  return result.data as unknown as PluginConfigFile;
}

// ---------------------------------------------------------------------------
// Loader pipeline
// ---------------------------------------------------------------------------

/** Read and validate the config file at the given absolute path. */
export async function loadPluginConfig(configPath: string): Promise<PluginConfigFile> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (err) {
    const msg =
      err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
        ? `Config file not found: ${configPath}`
        : `Failed to read config file: ${configPath}`;
    configError(msg);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    configError(`Invalid config file: not valid JSON (${configPath})`);
  }

  return validatePluginConfig(parsed, configPath);
}

/**
 * Resolve plugin entrypoints, invoke their factory functions, and return a
 * list of PluginEntry records. The configPath is used to resolve relative
 * entrypoints.
 */
export async function resolvePluginEntries(
  config: PluginConfigFile,
  configPath: string,
): Promise<PluginEntry[]> {
  const configDir = dirname(configPath);
  const entries: PluginEntry[] = [];

  for (const [namespace, extEntry] of Object.entries(config.extensions)) {
    const { entrypoint, config: pluginConfig, failurePolicy } = extEntry;

    let resolvedSpecifier: string;
    if (entrypoint.startsWith(".") || isAbsolute(entrypoint)) {
      resolvedSpecifier = pathToFileURL(resolve(configDir, entrypoint)).href;
    } else {
      // Bare specifier: resolve from config file's directory using require.resolve
      try {
        const req = createRequire(pathToFileURL(configDir + "/").href);
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

  return entries;
}

/** Invoke init() on each entry in parallel. Collects all fatal results and exits if any. */
export async function initializePlugins(entries: PluginEntry[]): Promise<void> {
  const results = await Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.plugin.init !== "function") {
        return null;
      }
      try {
        return { entry, result: await entry.plugin.init() };
      } catch (err) {
        return {
          entry,
          result: {
            type: "fatal" as const,
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    }),
  );

  const fatals = results.filter(
    (r): r is { entry: PluginEntry; result: { type: "fatal"; message: string } } =>
      r !== null && r.result.type === "fatal",
  );

  if (fatals.length > 0) {
    for (const { entry, result } of fatals) {
      process.stderr.write(`Plugin "${entry.namespace}" init failed: ${result.message}\n`);
    }
    process.exit(1);
  }
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

function resolveEntrypointToUrl(entrypoint: string, configDir: string): string | null {
  try {
    if (entrypoint.startsWith(".") || isAbsolute(entrypoint)) {
      return pathToFileURL(resolve(configDir, entrypoint)).href;
    }
    const req = createRequire(pathToFileURL(configDir + "/").href);
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
  config: PluginConfigFile,
  configPath: string,
): Promise<void> {
  const coreVersion = await readCoreVersion();
  if (coreVersion === null) {
    return; // Cannot determine core version; skip all checks silently
  }

  const configDir = dirname(configPath);

  for (const entry of entries) {
    const extEntry = config.extensions[entry.namespace];
    if (!extEntry) continue;

    const entrypointUrl = resolveEntrypointToUrl(extEntry.entrypoint, configDir);
    if (entrypointUrl === null) {
      process.stderr.write(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${extEntry.entrypoint}.\n`,
      );
      continue;
    }

    const found = await findNearestPackageJson(entrypointUrl);
    if (found === null) {
      process.stderr.write(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${extEntry.entrypoint}.\n`,
      );
      continue;
    }

    const { filePath, data: pkgData } = found;

    let peerRange: string | undefined;
    try {
      const pkg = pkgData as { peerDependencies?: Record<string, string> };
      peerRange = pkg.peerDependencies?.["gitlode"];
    } catch {
      process.stderr.write(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${filePath}.\n`,
      );
      continue;
    }

    if (peerRange === undefined) {
      process.stderr.write(
        `Plugin "${entry.namespace}" does not declare peerDependencies.gitlode. Compatibility unknown; continuing.\n`,
      );
      continue;
    }

    if (validRange(peerRange) === null) {
      process.stderr.write(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${filePath}.\n`,
      );
      continue;
    }

    if (!satisfies(coreVersion, peerRange)) {
      process.stderr.write(
        `Plugin "${entry.namespace}" declares peer gitlode ${peerRange}, but running gitlode is ${coreVersion}. Continuing; behavior may be incompatible.\n`,
      );
    }
    // Range satisfied → no output
  }
}
