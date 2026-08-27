import { describe, expect, it } from "vitest";

import {
  compareCodeUnits,
  compareProfileAttributes,
  compareProfileAttributeValues,
  compareProfileScopes,
  normalizeProfileAttributeValue,
  normalizeProfileInstrumentationScope,
} from "../../src/telemetry/normalization.js";
describe("profile normalization", () => {
  it("accepts only canonical scalar values", () => {
    for (const value of ["x", true, false, 0, 2.5])
      expect(normalizeProfileAttributeValue(value)).toEqual({ valid: true, value });
    expect(normalizeProfileAttributeValue(-0)).toEqual({ valid: true, value: 0 });
    for (const value of [NaN, Infinity, -Infinity, undefined, [], {}, 1n, null])
      expect(normalizeProfileAttributeValue(value)).toEqual({ valid: false });
  });
  it("uses deterministic type, code-unit, attribute, and scope ordering", () => {
    const values = ["a", 2, true, false, 1, "ä"].sort(compareProfileAttributeValues);
    expect(values).toEqual([false, true, 1, 2, "a", "ä"]);
    expect(compareCodeUnits("z", "ä")).toBeLessThan(0);
    expect(
      [
        { key: "z", value: 1 },
        { key: "a", value: 1 },
      ]
        .sort(compareProfileAttributes)
        .map((x) => x.key),
    ).toEqual(["a", "z"]);
    const scopes = [
      { name: "b", version: null },
      { name: "a", version: "1" },
      { name: "a", version: null },
    ].sort(compareProfileScopes);
    expect(scopes).toEqual([
      { name: "a", version: null },
      { name: "a", version: "1" },
      { name: "b", version: null },
    ]);
    expect(normalizeProfileInstrumentationScope("x")).toEqual({ name: "x", version: null });
  });
});
