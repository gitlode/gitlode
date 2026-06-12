import { describe, expect, it } from "vitest";

import { isCommitOid, isCommitOidForProfile } from "../../src/model/guards.js";

describe("commit OID validators", () => {
  it("isCommitOid accepts both sha1 and sha256 profiles", () => {
    expect(isCommitOid("e0510975693543a29c76334ea7fd01222ba3da99")).toBe(true);
    expect(isCommitOid("5032585f67a21689368d3748de15c7e7b51b344795368a52e146eb5e575d506d")).toBe(
      true,
    );
  });

  it("isCommitOidForProfile enforces the selected profile length", () => {
    const sha1Oid = "e0510975693543a29c76334ea7fd01222ba3da99";
    const sha256Oid = "5032585f67a21689368d3748de15c7e7b51b344795368a52e146eb5e575d506d";

    expect(isCommitOidForProfile(sha1Oid, "sha1")).toBe(true);
    expect(isCommitOidForProfile(sha1Oid, "sha256")).toBe(false);
    expect(isCommitOidForProfile(sha256Oid, "sha256")).toBe(true);
    expect(isCommitOidForProfile(sha256Oid, "sha1")).toBe(false);
  });
});
