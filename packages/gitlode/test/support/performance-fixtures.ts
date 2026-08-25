import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { createDeterministicRepository } from "./deterministic-repository.js";
import type { FixtureQuantities } from "./performance-harness.js";

const execute = promisify(execFile);
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "Gitlode Performance",
  GIT_AUTHOR_EMAIL: "performance@gitlode.invalid",
  GIT_COMMITTER_NAME: "Gitlode Performance",
  GIT_COMMITTER_EMAIL: "performance@gitlode.invalid",
  TZ: "UTC",
};
async function git(directory: string, args: string[], index: number) {
  await execute("git", ["-c", "commit.gpgSign=false", ...args], {
    cwd: directory,
    env: {
      ...env,
      GIT_AUTHOR_DATE: `2024-03-${String(1 + (index % 20)).padStart(2, "0")}T00:00:00Z`,
      GIT_COMMITTER_DATE: `2024-03-${String(1 + (index % 20)).padStart(2, "0")}T00:00:00Z`,
    },
  });
}
/** Extends the T00A recipe deterministically; the generated .git directory remains temporary. */
export async function createPerformanceRepository(
  directory: string,
  family: "commit_heavy_repository" | "file_heavy_repository",
  quantities: FixtureQuantities,
) {
  const repository = await createDeterministicRepository(directory);
  for (let commit = 0; commit < quantities.commits; commit++) {
    const fileCount = family === "file_heavy_repository" ? quantities.files : 1;
    for (let file = 0; file < fileCount; file++) {
      const path = join(directory, `perf-${String(file).padStart(5, "0")}.txt`);
      if (commit > 0 && (commit + file) % 11 === 0) await rm(path, { force: true });
      else await writeFile(path, `recipe=performance-v1\ncommit=${commit}\nfile=${file}\n雪\n`);
    }
    await git(directory, ["add", "-A"], commit);
    await git(directory, ["commit", "-m", `performance ${family} ${commit}`], commit);
  }
  return repository;
}
export async function createPluginProjectionFixture(
  directory: string,
  quantities: FixtureQuantities,
) {
  await mkdir(directory, { recursive: true });
  const registrations = Array.from({ length: quantities.plugins }, (_, index) => ({
    namespace: `plugin-${index}`,
    package: `deterministic-${index % 2}`,
    outcome: index % 3 === 0 ? "skip" : "success",
  }));
  await writeFile(
    join(directory, "plugin-input.json"),
    `${JSON.stringify({ recipeRevision: "performance-v1", registrations }, undefined, 2)}\n`,
  );
  return registrations;
}
export function createAggregationFixture(scale: number) {
  return Array.from({ length: scale }, (_, index) => ({
    identity: `observation-${index % 4}`,
    attributes: { outcome: index % 2 ? "success" : "skip" },
    value: index + 0.125,
  }));
}
