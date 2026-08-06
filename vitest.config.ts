import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./packages/internal-foundation/vitest.config.ts",
      "./packages/internal-contracts/vitest.config.ts",
      "./packages/git-adapters/vitest.config.ts",
      "./packages/line-diff-adapters/vitest.config.ts",
      "./packages/gitlode/vitest.config.ts",
      "./packages/plugin-assay-metrics/vitest.config.ts",
      "./packages/plugin-conventional-commits/vitest.config.ts",
      "./packages/plugin-custom-field/vitest.config.ts",
      "./packages/plugin-file-type/vitest.config.ts",
      "./packages/plugin-identity-profile/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reporter: ["text", "html", "json"],
    },
  },
});
