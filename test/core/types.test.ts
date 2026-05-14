import { describe, expect, it } from "vitest";

import { isCommitHash } from "../../src/core/types.js";

describe("isCommitHash", () => {
  it("returns true for valid commit hashes", () => {
    // SHA-1 hash
    expect(isCommitHash("e0510975693543a29c76334ea7fd01222ba3da99")).toBe(true);
    // ^([0-9a-f]{40}|[0-9a-f]{64})$
    // SHA-256 hash
    // expect(isCommitHash("5032585f67a21689368d3748de15c7e7b51b344795368a52e146eb5e575d506d")).toBe(
    //   true,
    // );
  });

  it("returns false for invalid commit hashes", () => {
    expect(isCommitHash("")).toBe(false);
    expect(isCommitHash("g0510975693543a29c76334ea7fd01222ba3da99")).toBe(false); // contains 'g'
    expect(isCommitHash("e0510975693543a29c76334ea7fd01222ba3da9")).toBe(false); // too short
    expect(isCommitHash("e0510975693543a29c76334ea7fd01222ba3da990")).toBe(false); // too long
    expect(isCommitHash(123)).toBe(false); // not a string
  });
});
