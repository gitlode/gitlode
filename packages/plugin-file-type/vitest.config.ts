import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/plugin-file-type",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
