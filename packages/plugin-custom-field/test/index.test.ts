import { describe, expect, it } from "vitest";

import factory, { parseConfig } from "../src/index.js";

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

  it("returns ready init result and projects scalar values", async () => {
    const pluginString = await factory({ value: "release-2026-06" });
    await expect(pluginString.init(runtime)).resolves.toEqual({ type: "ready" });
    await expect(pluginString.project({} as never)).resolves.toEqual({
      type: "success",
      data: "release-2026-06",
    });

    const pluginNumber = await factory({ value: 20260602 });
    await expect(pluginNumber.init(runtime)).resolves.toEqual({ type: "ready" });
    await expect(pluginNumber.project({} as never)).resolves.toEqual({
      type: "success",
      data: 20260602,
    });

    const pluginBoolean = await factory({ value: true });
    await expect(pluginBoolean.init(runtime)).resolves.toEqual({ type: "ready" });
    await expect(pluginBoolean.project({} as never)).resolves.toEqual({
      type: "success",
      data: true,
    });
  });

  it("returns fatal init result for invalid config", async () => {
    const plugin = await factory({ value: { nested: { key: "value" } } });
    await expect(plugin.init(runtime)).resolves.toEqual({ type: "fatal" });
  });
});

describe("parseConfig", () => {
  it("returns error when top-level config is not an object", () => {
    const result = parseConfig("invalid-config");
    expect(result).toEqual({
      type: "error",
      message: 'Invalid plugin config: top-level value must be an object with a "value" property.',
    });
  });

  it("returns error when value is missing or not an object", () => {
    const resultMissing = parseConfig({});
    expect(resultMissing).toEqual({
      type: "error",
      message: 'Invalid plugin config: "value" must be an object, string, number, or boolean.',
    });
  });

  it("returns error when non-finite top-level number is provided", () => {
    const resultNaN = parseConfig({ value: Number.NaN });
    expect(resultNaN).toEqual({
      type: "error",
      message: 'Invalid plugin config: "value" must be a finite number.',
    });

    const resultInfinity = parseConfig({ value: Number.POSITIVE_INFINITY });
    expect(resultInfinity).toEqual({
      type: "error",
      message: 'Invalid plugin config: "value" must be a finite number.',
    });
  });

  it("returns error when value is null at top-level", () => {
    const result = parseConfig({ value: null });
    expect(result).toEqual({
      type: "error",
      message: 'Invalid plugin config: "value" must be an object, string, number, or boolean.',
    });
  });

  it("returns error when value is empty", () => {
    const result = parseConfig({ value: {} });
    expect(result).toEqual({
      type: "error",
      message: 'Invalid plugin config: "value" must contain at least one entry.',
    });
  });

  it("returns error for invalid field names", () => {
    const result = parseConfig({ value: { "bad.name": "value" } });
    expect(result).toEqual({
      type: "error",
      message: 'Invalid plugin config: field name "bad.name" must match ^[A-Za-z_][A-Za-z0-9_-]*$.',
    });
  });

  it("returns error for object and array field values", () => {
    const resultObject = parseConfig({ value: { nested: { key: "value" } } });
    expect(resultObject).toEqual({
      type: "error",
      message: 'Invalid plugin config: field "nested" must be string, number, boolean, or null.',
    });

    const resultArray = parseConfig({ value: { list: ["a", "b"] } });
    expect(resultArray).toEqual({
      type: "error",
      message: 'Invalid plugin config: field "list" must be string, number, boolean, or null.',
    });
  });

  it("returns error for non-finite number values", () => {
    const resultNaN = parseConfig({ value: { value: Number.NaN } });
    expect(resultNaN).toEqual({
      type: "error",
      message: 'Invalid plugin config: field "value" must be a finite number.',
    });

    const resultInfinity = parseConfig({ value: { value: Number.POSITIVE_INFINITY } });
    expect(resultInfinity).toEqual({
      type: "error",
      message: 'Invalid plugin config: field "value" must be a finite number.',
    });
  });
});
