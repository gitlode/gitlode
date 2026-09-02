import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { satisfies, valid, validRange } from "semver";

import { packageVersion } from "../package-metadata.js";
import type { DiagnosticReporter } from "../plugin-api/index.js";
import type { PluginEntry, PluginPackageResolution } from "./types.js";

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

function isValidPackageName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 214 &&
    /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(value)
  );
}

function resolveTelemetryScope(entry: PluginEntry, packageData: unknown): PluginPackageResolution {
  const manifest = packageData as { name?: unknown; version?: unknown } | null;
  if (!isValidPackageName(manifest?.name)) {
    return { scope: { name: `gitlode.plugin.${entry.namespace}` }, manifest: packageData };
  }
  const packageVersion = typeof manifest.version === "string" ? valid(manifest.version) : null;
  return {
    scope:
      packageVersion === null
        ? { name: manifest.name }
        : { name: manifest.name, version: packageVersion },
    manifest: packageData,
  };
}

interface PluginCompatibilityResult {
  readonly resolutions: readonly {
    readonly entry: PluginEntry;
    readonly packageResolution: PluginPackageResolution;
  }[];
  readonly warningCount: number;
}

/**
 * Warn when a plugin's declared gitlode peer range is absent, unreadable, or incompatible.
 * Compatibility diagnostics never terminate the run.
 */
export async function checkPluginCompatibility(
  entries: readonly PluginEntry[],
  reporter: Pick<DiagnosticReporter, "warn">,
): Promise<PluginCompatibilityResult> {
  let warningCount = 0;
  const warn = (message: string) => {
    warningCount++;
    reporter.warn(message);
  };
  const resolutions: Array<PluginCompatibilityResult["resolutions"][number]> = [];

  for (const entry of entries) {
    const found = await findNearestPackageJson(entry.resolvedEntrypointUrl);
    if (found === null) {
      warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${entry.entrypoint}.`,
      );
      resolutions.push({
        entry,
        packageResolution: { scope: { name: `gitlode.plugin.${entry.namespace}` } },
      });
      continue;
    }

    const { filePath, data: packageData } = found;
    const packageResolution = {
      ...resolveTelemetryScope(entry, packageData),
      manifestPath: filePath,
    };
    resolutions.push({ entry, packageResolution });
    let peerRange: string | undefined;
    try {
      const packageManifest = packageData as { peerDependencies?: Record<string, string> };
      peerRange = packageManifest.peerDependencies?.["gitlode"];
    } catch {
      warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${filePath}.`,
      );
      continue;
    }

    if (peerRange === undefined) {
      warn(
        `Plugin "${entry.namespace}" does not declare peerDependencies.gitlode. Compatibility unknown; continuing.`,
      );
      continue;
    }

    if (validRange(peerRange) === null) {
      warn(
        `Plugin "${entry.namespace}" compatibility check skipped: unable to read package metadata at ${filePath}.`,
      );
      continue;
    }

    if (!satisfies(packageVersion, peerRange)) {
      warn(
        `Plugin "${entry.namespace}" declares peer gitlode ${peerRange}, but running gitlode is ${packageVersion}. Continuing; behavior may be incompatible.`,
      );
    }
  }

  return { resolutions, warningCount };
}
