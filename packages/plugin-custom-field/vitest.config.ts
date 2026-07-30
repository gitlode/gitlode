import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "plugin-custom-field",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
