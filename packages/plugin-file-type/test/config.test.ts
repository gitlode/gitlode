import { describe, expect, it } from "vitest";

import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("uses defaults for omitted config", () => {
    const config = expectOk(parseConfig(undefined));

    expect(config.debug).toBe(false);
    expect(config.ruleSets.map((ruleSet) => ruleSet.name)).toEqual(["common"]);
    expect(config.mappings.basenames.size).toBe(0);
    expect(config.mappings.suffixes.size).toBe(0);
    expect(config.unknownPolicy).toBe("emit");
  });

  it("allows custom-only rule set configuration", () => {
    const config = expectOk(parseConfig({ ruleSets: [] }));

    expect(config.ruleSets).toEqual([]);
  });

  it("rejects unknown top-level fields", () => {
    expect(parseConfig({ typo: true })).toEqual({
      ok: false,
      message: 'Invalid plugin config: unknown field "typo".',
    });
  });

  it("rejects duplicate rule sets", () => {
    expect(parseConfig({ ruleSets: ["common", "common"] })).toEqual({
      ok: false,
      message: 'Invalid plugin config: "ruleSets" must not contain duplicate value "common".',
    });
  });

  it("rejects unsupported rule sets", () => {
    expect(parseConfig({ ruleSets: ["frontend"] })).toEqual({
      ok: false,
      message: 'Invalid plugin config: "ruleSets[0]" must be one of: common.',
    });
  });

  it("rejects invalid mapping signatures", () => {
    expect(parseConfig({ mappings: { "src/*": "Invalid" } })).toEqual({
      ok: false,
      message:
        'Invalid plugin config: mapping key "src/*" must not contain "*" outside the leading "*." form.',
    });
  });

  it("allows dot-prefixed basename mappings", () => {
    const config = expectOk(parseConfig({ mappings: { ".ts": "dot ts file" } }));

    expect(config.mappings.basenames.size).toBe(1);
    expect(config.mappings.suffixes.size).toBe(0);
  });

  it("allows mapping to Unknown", () => {
    const config = expectOk(parseConfig({ mappings: { "*.generated": "Unknown" } }));

    expect([...config.mappings.suffixes.values()][0]?.name).toBe("Unknown");
  });
});

function expectOk<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly message: string },
): T {
  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.value;
}
