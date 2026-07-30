import { defineConfig } from "tsdown";

const runtimeExternals = ["chalk", "commander", "diff", "isomorphic-git", "semver", "zod"];

// Phase B will add the private workspace package names to `noExternal` once they exist.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "plugin-api": "src/plugin-api.ts",
    "worker-entry": "src/execution/worker-entry.ts",
  },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  minify: false,
  treeshake: true,
  splitting: true,
  external: runtimeExternals,
  outputOptions: {
    entryFileNames: "[name].js",
    chunkFileNames: "[name]-[hash].js",
  },
  dts: {
    entry: { index: "src/index.ts", "plugin-api": "src/plugin-api.ts" },
    sourcemap: false,
  },
});
