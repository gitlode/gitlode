import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveSourceRevision } from "../../src/support/source-revision.js";

describe("source revision resolution", () => {
  it("resolves the actual HEAD using process-local safe.directory", async () => {
    const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));
    await expect(resolveSourceRevision(repositoryRoot)).resolves.toMatch(/^[0-9a-f]{7,64}$/);
    const args: string[] = [];
    const revision = await resolveSourceRevision(repositoryRoot, async (_file, commandArgs) => {
      args.push(...commandArgs);
      return { stdout: "4e195ed\n", stderr: "" } as never;
    });
    expect(revision).toMatch(/^[0-9a-f]{7,64}$/);
    expect(args).toEqual([
      "-c",
      expect.stringMatching(/^safe\.directory=/),
      "-C",
      expect.any(String),
      "rev-parse",
      "HEAD",
    ]);
  });

  it("supports checkout paths containing spaces without changing Git config", async () => {
    const root = join(process.cwd(), ".tmp source revision path");
    await mkdir(root, { recursive: true });
    try {
      let captured = "";
      await expect(
        resolveSourceRevision(root, async (_file, args) => {
          captured = args[1] ?? "";
          return { stdout: "abcdef1\n", stderr: "" } as never;
        }),
      ).resolves.toBe("abcdef1");
      expect(captured).toContain(".tmp source revision path");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects invalid Git output and propagates Git failures", async () => {
    await expect(
      resolveSourceRevision(
        process.cwd(),
        async () => ({ stdout: "not-a-revision\n", stderr: "" }) as never,
      ),
    ).rejects.toThrow("invalid HEAD revision");
    await expect(
      resolveSourceRevision(process.cwd(), async () => {
        throw new Error("git failed");
      }),
    ).rejects.toThrow("git failed");
  });
});
