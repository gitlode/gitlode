import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/line-diff-adapters",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
