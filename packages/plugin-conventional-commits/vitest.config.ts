import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "plugin-conventional-commits",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
