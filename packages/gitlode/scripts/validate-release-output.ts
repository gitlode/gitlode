import { readFile, readdir } from "node:fs/promises";
import { builtinModules } from "node:module";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const distDirectory = resolve(packageRoot, "dist");
const privatePackagePrefix = "@gitlode/";
const allowedExternalPackages = new Set([
  "chalk",
  "commander",
  "diff",
  "isomorphic-git",
  "semver",
  "zod",
]);
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function packageName(specifier: string): string {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0] ?? specifier;
}

function isEmptyEsmExport(source: string): boolean {
  return /^\s*export\s*\{\s*\}\s*;?\s*$/u.test(source);
}

const files = (await readdir(distDirectory, { recursive: true })).map((file) =>
  file.replaceAll("\\", "/"),
);
const expectedEntries = ["index.js", "plugin-api.js", "worker-entry.js"];
const expectedDeclarations = ["index.d.ts", "plugin-api.d.ts"];

for (const file of [...expectedEntries, ...expectedDeclarations]) {
  assert(files.includes(file), `Missing release output: dist/${file}`);
}

assert(!files.includes("worker-entry.d.ts"), "worker-entry.d.ts must not be published");
assert(
  files
    .filter((file) => file.endsWith(".d.ts"))
    .sort()
    .join("\n") === expectedDeclarations.sort().join("\n"),
  `Unexpected declaration output:\n${files.filter((file) => file.endsWith(".d.ts")).join("\n")}`,
);
assert(
  files.every(
    (file) =>
      !file.includes("/") &&
      (file.endsWith(".js") || file.endsWith(".js.map") || file.endsWith(".d.ts")),
  ),
  `Stale or nested development output remains:\n${files.join("\n")}`,
);

const javaScriptFiles = files.filter((file) => file.endsWith(".js"));
for (const file of javaScriptFiles) {
  const source = await readFile(resolve(distDirectory, file), "utf8");
  if (file === "plugin-api.js" && isEmptyEsmExport(source)) continue;
  assert(files.includes(`${file}.map`), `Missing source map for dist/${file}`);
  assert(source.includes(`//# sourceMappingURL=${file}.map`), `Missing source map URL in ${file}`);

  const specifiers = [
    ...source.matchAll(/\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1] as string);

  for (const specifier of specifiers) {
    assert(
      !specifier.startsWith(privatePackagePrefix),
      `Private package import remains in ${file}: ${specifier}`,
    );
    if (specifier.startsWith(".") || specifier.startsWith("/") || builtins.has(specifier)) continue;
    assert(
      allowedExternalPackages.has(packageName(specifier)),
      `Unexpected external import in ${file}: ${specifier}`,
    );
  }
}

for (const file of expectedDeclarations) {
  const source = await readFile(resolve(distDirectory, file), "utf8");
  assert(!source.includes(privatePackagePrefix), `Private package specifier remains in ${file}`);
}

const indexSource = await readFile(resolve(distDirectory, "index.js"), "utf8");
assert(indexSource.startsWith("#!/usr/bin/env node\n"), "CLI shebang was not preserved");

const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
};
assert(manifest.bin?.["gitlode"] === "./dist/index.js", "CLI bin mapping changed");
assert(manifest.exports?.["."] !== undefined, "Root export is missing");
assert(manifest.exports?.["./plugin-api"] !== undefined, "Plugin API export is missing");
assert(manifest.exports?.["./worker-entry"] === undefined, "Worker entry must not be exported");

process.stdout.write(
  `Validated ${javaScriptFiles.length} JavaScript files, ${expectedDeclarations.length} declarations, exports, imports, maps, and shebang.\n`,
);
