import { describe, expect, it } from "vitest";

import factory from "../src/index.js";

const runtime = {
  warn() {},
  error() {},
};

describe("@gitlode/plugin-custom-field", () => {
  it("returns ready init result and projects configured fields", async () => {
    const plugin = await factory({
      value: {
        branch: "develop",
        run_id: 1234,
        is_backfill: false,
        notes: null,
      },
    });

    await expect(plugin.init(runtime)).resolves.toEqual({ type: "ready" });

    const projected = await plugin.project({} as never);
    expect(projected).toEqual({
      type: "success",
      data: {
        branch: "develop",
        run_id: 1234,
        is_backfill: false,
        notes: null,
      },
    });

    if (projected.type === "success") {
      expect(Object.isFrozen(projected.data)).toBe(true);
    }
  });

  it("returns fatal init result when top-level config is not an object", async () => {
    const plugin = await factory("invalid-config");
    await expect(plugin.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: top-level value must be an object with a "value" property.',
    });
  });

  it("returns fatal init result when value is missing or not an object", async () => {
    const pluginMissing = await factory({});
    await expect(pluginMissing.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: "value" must be an object containing at least one entry.',
    });

    const pluginInvalid = await factory({ value: [] });
    await expect(pluginInvalid.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: "value" must be an object containing at least one entry.',
    });
  });

  it("returns fatal init result when value is empty", async () => {
    const plugin = await factory({ value: {} });
    await expect(plugin.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: "value" must contain at least one entry.',
    });
  });

  it("returns fatal init result for invalid field names", async () => {
    const plugin = await factory({ value: { "bad.name": "value" } });
    await expect(plugin.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field name "bad.name" must match ^[A-Za-z_][A-Za-z0-9_-]*$.',
    });
  });

  it("returns fatal init result for object and array field values", async () => {
    const pluginObject = await factory({ value: { nested: { key: "value" } } });
    await expect(pluginObject.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "nested" must be string, number, boolean, or null.',
    });

    const pluginArray = await factory({ value: { list: ["a", "b"] } });
    await expect(pluginArray.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "list" must be string, number, boolean, or null.',
    });
  });

  it("returns fatal init result for non-finite number values", async () => {
    const pluginNaN = await factory({ value: { value: Number.NaN } });
    await expect(pluginNaN.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "value" must be a finite number.',
    });

    const pluginInfinity = await factory({ value: { value: Number.POSITIVE_INFINITY } });
    await expect(pluginInfinity.init(runtime)).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "value" must be a finite number.',
    });
  });

  it("returns the same precomputed projection result on repeated project calls", async () => {
    const plugin = await factory({ value: { branch: "main" } });
    const first = await plugin.project({} as never);
    const second = await plugin.project({} as never);

    expect(first).toBe(second);
  });
});
