import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeAtomicJson } from "../../scripts/tooling/atomic-json.js";

const directories: string[] = [];
afterEach(async () =>
  Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  ),
);

describe("atomic calibration artifact writer", () => {
  it("replaces complete JSON across repeated progress writes without leaving siblings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atomic-calibration-"));
    directories.push(directory);
    await writeAtomicJson(directory, "progress.json", { ordinal: 1 });
    expect(JSON.parse(await readFile(join(directory, "progress.json"), "utf8"))).toEqual({
      ordinal: 1,
    });
    await writeAtomicJson(directory, "progress.json", { ordinal: 2, attempts: [1, 2] });
    expect(JSON.parse(await readFile(join(directory, "progress.json"), "utf8"))).toEqual({
      ordinal: 2,
      attempts: [1, 2],
    });
    expect(await readdir(directory)).toEqual(["progress.json"]);
  });

  it("preserves an existing destination and cleans the temporary sibling when rename fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atomic-calibration-"));
    directories.push(directory);
    const destination = join(directory, "progress.json");
    await writeFile(destination, '{"previous":true}\n');
    await expect(
      writeAtomicJson(
        directory,
        "progress.json",
        { replacement: true },
        {
          mkdir: async () => undefined,
          writeFile: async (path, contents) => writeFile(path, contents),
          rename: async () => {
            throw new Error("rename failed");
          },
          rm: async (path) => rm(path, { force: true }),
        },
      ),
    ).rejects.toThrow("rename failed");
    expect(JSON.parse(await readFile(destination, "utf8"))).toEqual({ previous: true });
    expect(await readdir(directory)).toEqual(["progress.json"]);
  });
  it("preserves the original write failure when cleanup also fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "atomic-calibration-"));
    directories.push(directory);
    await expect(
      writeAtomicJson(
        directory,
        "progress.json",
        { replacement: true },
        {
          mkdir: async () => undefined,
          writeFile: async () => {
            throw new Error("write failed");
          },
          rename: async () => undefined,
          rm: async () => {
            throw new Error("cleanup failed");
          },
        },
      ),
    ).rejects.toThrow("write failed");
  });
});
