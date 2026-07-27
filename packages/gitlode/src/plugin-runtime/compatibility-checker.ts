import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { satisfies, validRange } from "semver";

import type { DiagnosticReporter } from "../plugin-api/index.js";
import type { AbsoluteDirectoryPath } from "../support/index.js";
import type { PluginDeclarations, PluginEntry } from "./types.js";

let cachedCoreVersion: string | null | undefined;

async function readCoreVersion(): Promise<string | null> {
  if (cachedCoreVersion !== undefined) {
    return cachedCoreVersion;
  }
  try {
    const packageUrl = new URL("../../package.json", import.meta.url);
    const raw = await readFile(fileURLToPath(packageUrl), "utf8");
    const packageData = JSON.parse(raw) as { version?: unknown };
    cachedCoreVersion = typeof packageData.version === "string" ? packageData.version : null;
  } catch {
    cachedCoreVersion = null;
  }
  return cachedCoreVersion;
}

const MAX_WALK_STEPS = 20;

async function findNearestPackageJson(
  entrypointUrl: string,
): Promise<{ filePath: string; data: unknown } | null> {
  let directory: string;
  try {
    directory = dirname(fileURLToPath(entrypointUrl));
  } catch {
    return null;
  }

  for (let index = 0; index < MAX_WALK_STEPS; index++) {
    const candidate = resolve(directory, "package.json");
    try {
      const raw = await readFile(candidate, "utf8");
      return { filePath: candidate, data: JSON.parse(raw) };
    } catch {
      const parent = dirname(directory);
      if (parent === directory) {
        break;
      }
      directory = parent;
    }
  }
  return null;
}

function resolveEntrypointToUrl(entrypoint: string, baseDir: AbsoluteDirectoryPath): string | null {
  try {
    if (entrypoint.startsWith(".") || isAbsolute(entrypoint)) {
      return pathToFileURL(resolve(baseDir, entrypoint)).href;
    }
    const requireFromBaseDirectory = createRequire(pathToFileURL(baseDir + "/").href);
    return pathToFileURL(requireFromBaseDirectory.resolve(entrypoint)).href;
  } catch {
    return null;
  }
}

/**
 * Warn when a plugin's declared gitlode peer range is absent, unreadable, or incompatible.
 * Compatibility diagnostics never terminate the run.
 */
export async function checkPluginCompatibility(
  entries: readonly PluginEntry[],
  declarations: PluginDeclarations,
  baseDir: AbsoluteDirectoryPath,
  reporter: Pick<DiagnosticReporter, "warn">,
): Promise<void> {
  const coreVersion = await readCoreVersion();
  if (coreVersion === null) {
    return;
  }

  for (const entry of entries) {
    const declaration = declarations[entry.namespace];
    if (!declaration) continue;

    const entrypointUrl = resolveEntrypointToUrl(declaration.entrypoint, baseDir);
    if (entrypointUrl === null) {
      reporter.warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${declaration.entrypoint}.`,
      );
      continue;
    }

    const found = await findNearestPackageJson(entrypointUrl);
    if (found === null) {
      reporter.warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${declaration.entrypoint}.`,
      );
      continue;
    }

    const { filePath, data: packageData } = found;
    let peerRange: string | undefined;
    try {
      const packageManifest = packageData as { peerDependencies?: Record<string, string> };
      peerRange = packageManifest.peerDependencies?.["gitlode"];
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
  }
}
