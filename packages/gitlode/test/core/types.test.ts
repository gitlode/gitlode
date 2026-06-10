import { describe, expectTypeOf, it } from "vitest";

import type {
  PluginProjectionResult,
  PluginProjectionValue,
  ProjectedExtensionValue,
} from "../../src/core/types.js";

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
