import { fileURLToPath } from "node:url";

import { defineProject } from "vitest/config";

export default defineProject({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    ...(process.platform === "win32" ? { maxWorkers: 2 } : {}),
    name: "performance",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
