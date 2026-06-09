import { describe, expect, it } from "vitest";

import { classifyPath } from "../src/classifier.js";
import { parseConfig } from "../src/config.js";
import { BUILT_IN_RULE_SETS } from "../src/rule-sets.js";

describe("built-in rule sets", () => {
  it("defines the common rule set", () => {
    const common = BUILT_IN_RULE_SETS.get("common");

    expect(common?.name).toBe("common");
    expect(common?.mappings.suffixes.size).toBeGreaterThan(0);
    expect(common?.mappings.basenames.size).toBeGreaterThan(0);
  });

  it("includes accepted common entries", () => {
    const config = expectConfig();

    expect(classifyPath("src/index.ts", config).name).toBe("TypeScript");
    expect(classifyPath("package.json", config).name).toBe("npm package manifest");
    expect(classifyPath(".gitignore", config).name).toBe("Git ignore file");
  });

  it("omits ambiguous V1 signatures", () => {
    const config = expectConfig();

    expect(classifyPath("source.m", config).name).toBe("Unknown");
    expect(classifyPath("include/header.h", config).name).toBe("Unknown");
    expect(classifyPath("script.pl", config).name).toBe("Unknown");
  });
});

function expectConfig() {
  const result = parseConfig(undefined);
  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.value;
}
