import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "gitlode",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
