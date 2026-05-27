import { CommitParser } from "conventional-commits-parser";
import { afterEach, describe, expect, it, vi } from "vitest";

import factory from "../src/index.js";

describe("@gitlode/plugin-conventional-commits-parser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ready init result", async () => {
    const plugin = await factory(undefined);

    await expect(plugin.init?.()).resolves.toEqual({ type: "ready" });
  });

  it("projects using commit fact message", async () => {
    const parseSpy = vi.spyOn(CommitParser.prototype, "parse").mockReturnValue({
      type: "feat",
      subject: "add tests",
    } as never);
    const plugin = await factory(undefined);
    await plugin.init?.();

    const projected = await plugin.project({
      fact: {
        type: "commit",
        message: "feat: add tests",
      },
    } as never);

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenCalledWith("feat: add tests");
    expect(projected).toEqual({
      type: "success",
      data: {
        type: "feat",
        subject: "add tests",
      },
    });
  });

  it("projects using nested commit message for file-change fact", async () => {
    const parseSpy = vi.spyOn(CommitParser.prototype, "parse").mockReturnValue({
      type: "fix",
      subject: "handle file change",
    } as never);
    const plugin = await factory(undefined);
    await plugin.init?.();

    const projected = await plugin.project({
      fact: {
        type: "file-change",
        commit: {
          message: "fix: handle file change",
        },
      },
    } as never);

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenCalledWith("fix: handle file change");
    expect(projected).toEqual({
      type: "success",
      data: {
        type: "fix",
        subject: "handle file change",
      },
    });
  });
});
