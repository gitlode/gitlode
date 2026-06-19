import { afterEach, describe, expect, it, vi } from "vitest";

import factory from "../src/index.js";

const runtime = {
  warn() {},
  error() {},
};

describe("@gitlode/plugin-assay-metrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ready init result", async () => {
    const plugin = await factory(undefined);

    await expect(plugin.init(runtime)).resolves.toEqual({ type: "ready" });
  });

  it("skips commit facts", async () => {
    const plugin = await factory(undefined);
    await plugin.init(runtime);

    await expect(
      plugin.project({
        fact: {
          type: "commit",
        },
      } as never),
    ).resolves.toEqual({
      type: "skip",
    });
  });

  it("projects file-change facts with computed metrics", async () => {
    const plugin = await factory(undefined);
    await plugin.init(runtime);

    const projected = await plugin.project({
      fact: {
        type: "file-change",
        file: {
          additions: 10,
          deletions: 15,
        },
      },
    } as never);

    expect(projected).toEqual({
      type: "success",
      data: {
        delta: -5,
        churn: 25,
        "net-change": 15,
      },
    });
  });
});
