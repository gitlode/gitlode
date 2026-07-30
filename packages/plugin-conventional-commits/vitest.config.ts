import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/plugin-conventional-commits",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
