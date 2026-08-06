import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@gitlode/plugin-identity-profile",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
