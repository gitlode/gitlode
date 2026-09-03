import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "tsdown";

const externalRuntimePackages = [
  "@opentelemetry/api",
  "@opentelemetry/context-async-hooks",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/sdk-trace-base",
  "chalk",
  "commander",
  "diff",
  "isomorphic-git",
  "semver",
  "zod",
] as const;

const futurePrivateWorkspacePackages = [
  ["@gitlode/internal-foundation", "../internal-foundation"],
  ["@gitlode/internal-contracts", "../internal-contracts"],
  ["@gitlode/git-adapters", "../git-adapters"],
  ["@gitlode/line-diff-adapters", "../line-diff-adapters"],
] as const;

const activePrivateWorkspacePackages = futurePrivateWorkspacePackages
  .filter(([, directory]) => existsSync(resolve(import.meta.dirname, directory, "package.json")))
  .map(([packageName]) => packageName);
const privateWorkspacePackageMatcher = (id: string) =>
  activePrivateWorkspacePackages.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  name: "gitlode",
  pkg: { name: "gitlode", dependencies: {} },
  entry: {
    index: "./src/index.ts",
    "plugin-api": "./src/plugin-api.ts",
    "worker-entry": "./src/execution/worker-entry.ts",
  },
  tsconfig: "./tsconfig.release.json",
  platform: "node",
  target: "node22",
  format: "esm",
  outDir: "./dist",
  sourcemap: true,
  clean: true,
  minify: false,
  shims: false,
  treeshake: true,
  hash: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  outputOptions: {
    entryFileNames: "[name].js",
    chunkFileNames: "[name]-[hash].js",
  },
  deps: {
    neverBundle: [...externalRuntimePackages],
    alwaysBundle: privateWorkspacePackageMatcher,
    onlyBundle: activePrivateWorkspacePackages,
    onlyImport: [...externalRuntimePackages],
    dts: {
      neverBundle: [...externalRuntimePackages],
      alwaysBundle: privateWorkspacePackageMatcher,
    },
  },
  dts: {
    entry: ["src/index.ts", "src/plugin-api.ts"],
    tsconfig: "./tsconfig.release.json",
    sourcemap: false,
  },
  exports: false,
  failOnWarn: true,
  suppressWarnings: [
    "TypeScript 7.0 does not yet have a stable API and is experimental. Some options will be unavailable.",
  ],
});
