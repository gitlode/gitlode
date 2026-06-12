import { describe, expect, it } from "vitest";

import { classifyPath } from "../src/classifier.js";
import { parseConfig } from "../src/config.js";

describe("classifyPath", () => {
  it("classifies built-in suffixes case-insensitively", () => {
    expect(classifyPath("SRC/INDEX.TS", config()).name).toBe("TypeScript");
  });

  it("normalizes Windows path separators", () => {
    expect(classifyPath("src\\index.ts", config()).name).toBe("TypeScript");
  });

  it("uses exact basename mappings before suffix mappings", () => {
    const result = classifyPath("package.json", config());

    expect(result).toMatchObject({
      name: "npm package manifest",
      source: "common",
      matched: "package.json",
    });
  });

  it("uses plugin basename mappings before plugin suffix mappings", () => {
    const result = classifyPath(
      "tool.config.json",
      config({
        ruleSets: [],
        mappings: { "tool.config.json": "tool config", "*.json": "custom JSON" },
      }),
    );

    expect(result).toMatchObject({
      name: "tool config",
      source: "plugin-config",
      matched: "tool.config.json",
    });
  });

  it("uses plugin suffix mappings before built-in suffix mappings", () => {
    const result = classifyPath(
      "src/index.ts",
      config({ mappings: { "*.ts": "Custom TypeScript" } }),
    );

    expect(result).toMatchObject({
      name: "Custom TypeScript",
      source: "plugin-config",
      matched: "*.ts",
    });
  });

  it("uses the longest matching suffix", () => {
    const result = classifyPath(
      "types/index.d.ts",
      config({
        ruleSets: [],
        mappings: { "*.ts": "TypeScript", "*.d.ts": "TypeScript declaration" },
      }),
    );

    expect(result).toMatchObject({
      name: "TypeScript declaration",
      matched: "*.d.ts",
    });
  });

  it("treats basename matching as case-sensitive", () => {
    expect(classifyPath("Dockerfile", config()).name).toBe("Dockerfile");
    expect(classifyPath("dockerfile", config()).name).toBe("Unknown");
  });

  it("returns Unknown when no mapping matches", () => {
    expect(classifyPath("src/file.unmapped", config()).name).toBe("Unknown");
  });
});

function config(rawConfig?: unknown) {
  const result = parseConfig(rawConfig);
  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.value;
}
