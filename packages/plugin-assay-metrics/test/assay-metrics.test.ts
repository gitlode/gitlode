import { describe, expect, it } from "vitest";

import { computeChurn, computeDelta, computeNetChange } from "../src/assay-metrics.js";

describe("computeDelta", () => {
  it("returns correct delta when additions and deletions are present", () => {
    const result = computeDelta({ additions: 10, deletions: 4 });
    expect(result).toBe(6);
  });

  it("returns minus delta when deletions are greater than additions", () => {
    const result = computeDelta({ additions: 3, deletions: 5 });
    expect(result).toBe(-2);
  });

  it("returns null when additions is null", () => {
    const result = computeDelta({ additions: null, deletions: 4 });
    expect(result).toBeNull();
  });

  it("returns null when deletions is null", () => {
    const result = computeDelta({ additions: 10, deletions: null });
    expect(result).toBeNull();
  });
});

describe("computeChurn", () => {
  it("returns correct churn when additions and deletions are present", () => {
    const result = computeChurn({ additions: 10, deletions: 4 });
    expect(result).toBe(14);
  });

  it("returns correct churn when deletions are greater than additions", () => {
    const result = computeChurn({ additions: 3, deletions: 5 });
    expect(result).toBe(8);
  });

  it("returns null when additions is null", () => {
    const result = computeChurn({ additions: null, deletions: 4 });
    expect(result).toBeNull();
  });

  it("returns null when deletions is null", () => {
    const result = computeChurn({ additions: 10, deletions: null });
    expect(result).toBeNull();
  });
});

describe("computeNetChange", () => {
  it("returns correct net change when additions and deletions are present", () => {
    const result = computeNetChange({ additions: 10, deletions: 4 });
    expect(result).toBe(10);
  });

  it("returns correct net change when deletions are greater than additions", () => {
    const result = computeNetChange({ additions: 3, deletions: 5 });
    expect(result).toBe(5);
  });

  it("returns null when additions is null", () => {
    const result = computeNetChange({ additions: null, deletions: 4 });
    expect(result).toBeNull();
  });

  it("returns null when deletions is null", () => {
    const result = computeNetChange({ additions: 10, deletions: null });
    expect(result).toBeNull();
  });
});
