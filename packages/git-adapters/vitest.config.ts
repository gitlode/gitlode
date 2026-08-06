import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/git-adapters",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
