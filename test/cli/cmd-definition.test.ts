import { describe, expect, it } from "vitest";

import { cmdDefinition } from "../../src/cli/index.js";

describe("cmdDefinition – help output wiring", () => {
  it("has a meta object with name and description", () => {
    expect(cmdDefinition.meta?.name).toBe("gitrail");
    expect(cmdDefinition.meta?.description).toBeTruthy();
  });

  it("exposes all expected argument definitions", () => {
    const args = cmdDefinition.args as Record<string, unknown>;
    expect(args).toBeDefined();

    const expectedKeys = [
      "repository-path",
      "branch",
      "output-dir",
      "output-prefix",
      "state",
      "since-commit",
      "since-date",
      "rotate-lines",
      "rotate-size",
    ];
    for (const key of expectedKeys) {
      expect(args, `expected arg "${key}" to be defined`).toHaveProperty(key);
    }
  });

  it("each arg definition has a description string", () => {
    const args = cmdDefinition.args as Record<string, { description?: string }>;
    for (const [key, def] of Object.entries(args)) {
      expect(typeof def.description, `arg "${key}" is missing a description`).toBe("string");
    }
  });
});
