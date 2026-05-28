import { describe, expect, expectTypeOf, it } from "vitest";

import { isCommitOid, isCommitOidForProfile } from "../../src/core/types.js";
import type {
  PluginProjectionResult,
  PluginProjectionValue,
  ProjectedExtensionValue,
} from "../../src/core/types.js";

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

// ---------------------------------------------------------------------------
// Plugin contract type assertions
// ---------------------------------------------------------------------------

describe("PluginProjectionValue type contract", () => {
  it("accepts string, number, boolean, and plain object", () => {
    expectTypeOf<string>().toMatchTypeOf<PluginProjectionValue>();
    expectTypeOf<number>().toMatchTypeOf<PluginProjectionValue>();
    expectTypeOf<boolean>().toMatchTypeOf<PluginProjectionValue>();
    expectTypeOf<Record<string, unknown>>().toMatchTypeOf<PluginProjectionValue>();
  });

  it("does not accept null", () => {
    expectTypeOf<null>().not.toMatchTypeOf<PluginProjectionValue>();
  });
});

describe("PluginProjectionResult success data type", () => {
  it("success data is PluginProjectionValue (does not include null)", () => {
    type SuccessData = Extract<PluginProjectionResult, { type: "success" }>["data"];
    expectTypeOf<null>().not.toMatchTypeOf<SuccessData>();
    expectTypeOf<string>().toMatchTypeOf<SuccessData>();
    expectTypeOf<number>().toMatchTypeOf<SuccessData>();
    expectTypeOf<boolean>().toMatchTypeOf<SuccessData>();
    expectTypeOf<Record<string, unknown>>().toMatchTypeOf<SuccessData>();
  });
});

describe("ProjectedExtensionValue type contract", () => {
  it("accepts all PluginProjectionValue members plus null", () => {
    expectTypeOf<string>().toMatchTypeOf<ProjectedExtensionValue>();
    expectTypeOf<number>().toMatchTypeOf<ProjectedExtensionValue>();
    expectTypeOf<boolean>().toMatchTypeOf<ProjectedExtensionValue>();
    expectTypeOf<Record<string, unknown>>().toMatchTypeOf<ProjectedExtensionValue>();
    expectTypeOf<null>().toMatchTypeOf<ProjectedExtensionValue>();
  });
});
