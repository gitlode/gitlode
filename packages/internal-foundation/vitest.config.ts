import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/internal-foundation",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
