import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "plugin-assay-metrics",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
