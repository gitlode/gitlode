import { describe, expect, it } from "vitest";

import factory from "../src/index.js";

describe("@gitlode/plugin-custom-fields", () => {
  it("returns ready init result and projects configured fields", async () => {
    const plugin = await factory({
      fields: {
        branch: "develop",
        run_id: 1234,
        is_backfill: false,
        notes: null,
      },
    });

    await expect(plugin.init?.()).resolves.toEqual({ type: "ready" });

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
    await expect(plugin.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: top-level value must be an object with a "fields" property.',
    });
  });

  it("returns fatal init result when fields is missing or not an object", async () => {
    const pluginMissing = await factory({});
    await expect(pluginMissing.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: "fields" must be an object containing at least one entry.',
    });

    const pluginInvalid = await factory({ fields: [] });
    await expect(pluginInvalid.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: "fields" must be an object containing at least one entry.',
    });
  });

  it("returns fatal init result when fields is empty", async () => {
    const plugin = await factory({ fields: {} });
    await expect(plugin.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: "fields" must contain at least one entry.',
    });
  });

  it("returns fatal init result for invalid field names", async () => {
    const plugin = await factory({ fields: { "bad.name": "value" } });
    await expect(plugin.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field name "bad.name" must match ^[A-Za-z_][A-Za-z0-9_-]*$.',
    });
  });

  it("returns fatal init result for object and array field values", async () => {
    const pluginObject = await factory({ fields: { nested: { key: "value" } } });
    await expect(pluginObject.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "nested" must be string, number, boolean, or null.',
    });

    const pluginArray = await factory({ fields: { list: ["a", "b"] } });
    await expect(pluginArray.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "list" must be string, number, boolean, or null.',
    });
  });

  it("returns fatal init result for non-finite number values", async () => {
    const pluginNaN = await factory({ fields: { value: Number.NaN } });
    await expect(pluginNaN.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "value" must be a finite number.',
    });

    const pluginInfinity = await factory({ fields: { value: Number.POSITIVE_INFINITY } });
    await expect(pluginInfinity.init?.()).resolves.toEqual({
      type: "fatal",
      message: 'Invalid plugin config: field "value" must be a finite number.',
    });
  });

  it("returns the same precomputed projection result on repeated project calls", async () => {
    const plugin = await factory({ fields: { branch: "main" } });
    const first = await plugin.project({} as never);
    const second = await plugin.project({} as never);

    expect(first).toBe(second);
  });
});
