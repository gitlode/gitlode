import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/internal-contracts",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
