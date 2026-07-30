import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "plugin-file-type",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
