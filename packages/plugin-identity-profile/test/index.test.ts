import { describe, expect, it, vi } from "vitest";

import factory from "../src/index.js";

describe("@gitlode/plugin-identity-profile", () => {
  it("returns a fatal init result until the implementation is added", async () => {
    const error = vi.fn();
    const warn = vi.fn();
    const plugin = await factory(undefined);

    await expect(plugin.init({ error, warn })).resolves.toEqual({
      type: "fatal",
      message: "Plugin implementation is not available yet.",
    });

    expect(error).toHaveBeenCalledWith(
      "Plugin implementation is not available yet. The package scaffold is present, but the identity-profile runtime has not been implemented.",
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns an empty success payload from project during bootstrap", async () => {
    const plugin = await factory(undefined);

    await expect(plugin.project({} as never)).resolves.toEqual({
      type: "success",
      data: {},
    });
  });
});
