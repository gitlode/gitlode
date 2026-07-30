import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/plugin-assay-metrics",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
