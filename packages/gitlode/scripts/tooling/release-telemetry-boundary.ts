import { readFileSync, realpathSync, existsSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { join, dirname } from "node:path";

interface RuntimeChunk {
  readonly fileName: string;
  readonly imports: readonly string[];
  readonly dynamicImports: readonly string[];
  readonly moduleIds: readonly string[];
}

const implementationOwner =
  /\/execution\/telemetry\/(?:enabled-worker-telemetry|bounded-retention|local-span-processor|local-metric-reader|diagnostic-accumulator|profile-report-builder|profile-report-primitives)\.[cm]?[jt]s$/;
const forbiddenPackage =
  /^@opentelemetry\/(?:sdk-|context-|core(?:\/|$)|resources(?:\/|$)|semantic-conventions(?:\/|$))/;
const privatePackage = /^@gitlode\//;
const require = createRequire(import.meta.url);

// Inspect declared external dependency closure conservatively, including CJS packages. This is
// separate from runtime load evidence; an installed dependency is not evidence of evaluation.
function externalClosure(specifier: string, seen = new Set<string>(), from = require): void {
  if (isBuiltin(specifier)) return;
  if (privatePackage.test(specifier)) throw new Error(`Private workspace leak: ${specifier}`);
  if (forbiddenPackage.test(specifier)) throw new Error(`Eager SDK dependency: ${specifier}`);
  const packageName = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : (specifier.split("/")[0] ?? specifier);
  for (const searchPath of from.resolve.paths(packageName) ?? []) {
    const manifestPath = join(searchPath, packageName, "package.json");
    if (existsSync(manifestPath)) {
      const directory = dirname(realpathSync(manifestPath));
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
      };
      if (seen.has(directory)) return;
      seen.add(directory);
      if (forbiddenPackage.test(manifest.name))
        throw new Error(`Eager SDK owner: ${manifest.name}`);
      const localRequire = createRequire(join(directory, "package.json"));
      for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        externalClosure(dependency, seen, localRequire);
      }
      return;
    }
  }
  throw new Error(`External package owner missing: ${specifier}`);
}

export function verifyReleaseTelemetryBoundary(chunks: readonly RuntimeChunk[]): void {
  process.stdout.write(
    `Release telemetry graph inventory: ${JSON.stringify(chunks.map(({ fileName, imports, dynamicImports, moduleIds }) => ({ fileName, imports, dynamicImports, moduleIds })))}\n`,
  );
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  // Every lazy target must exist; private specifiers are forbidden even in the lazy closure.
  for (const chunk of chunks) {
    for (const edge of [...chunk.imports, ...chunk.dynamicImports]) {
      if (privatePackage.test(edge)) throw new Error(`Private workspace leak: ${edge}`);
      if (
        (edge.startsWith(".") || (!edge.includes("/") && /\.[cm]?js$/.test(edge))) &&
        !byName.has(edge)
      ) {
        throw new Error(`Missing emitted asset: ${chunk.fileName} -> ${edge}`);
      }
    }
  }
  for (const entry of ["index.js", "worker-entry.js", "plugin-api.js"]) {
    const visited = new Set<string>();
    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);
      const chunk = byName.get(name);
      if (!chunk) throw new Error(`Missing stable entry/chunk: ${name}`);
      for (const id of chunk.moduleIds) {
        const normalized = id.replaceAll("\\", "/");
        if (
          implementationOwner.test(normalized) ||
          /\/node_modules\/@opentelemetry\/(?:sdk-|context-|core\/|resources\/)/.test(normalized)
        ) {
          throw new Error(`Forbidden eager owner from ${entry}: ${id}`);
        }
      }
      for (const edge of chunk.imports) {
        if (byName.has(edge)) visit(edge);
        else externalClosure(edge);
      }
    };
    visit(entry);
    process.stdout.write(
      `Release telemetry eager closure: ${entry}: ${visited.size} chunks passed\n`,
    );
  }
  if (
    !chunks.some((chunk) =>
      chunk.moduleIds.some((id) =>
        /\/enabled-worker-telemetry\.ts$/.test(id.replaceAll("\\", "/")),
      ),
    )
  ) {
    throw new Error("Enabled telemetry implementation missing from release graph");
  }
}
