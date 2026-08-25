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
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
};
const isolated = [
  "-c",
  "commit.gpgSign=false",
  "-c",
  "tag.gpgSign=false",
  "-c",
  `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
  "-c",
  "core.autocrlf=false",
  "-c",
  "core.fileMode=false",
];
async function git(directory: string, args: string[], index: number) {
  await execute("git", [...isolated, ...args], {
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
  if (quantities.commits < 5)
    throw new Error("final total commits cannot be below the five-commit base recipe");
  for (let commit = 0; commit < quantities.commits - 5; commit++) {
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
  const packageDirectory = join(directory, "deterministic-plugin");
  await mkdir(packageDirectory);
  await writeFile(
    join(packageDirectory, "package.json"),
    `${JSON.stringify({ name: "@gitlode/performance-fixture-plugin", version: "1.0.0", type: "module" }, undefined, 2)}\n`,
  );
  await writeFile(
    join(packageDirectory, "index.js"),
    `export default async (config) => ({\n  async init() { return { type: "ready" }; },\n  async project(context) {\n    if (config.outcome === "skip" || context.fact.type !== "file-change") return { type: "skip" };\n    return { type: "success", data: { fixture: "performance-v2", namespaceOrdinal: config.ordinal } };\n  }\n});\n`,
  );
  const extensions = Object.fromEntries(
    registrations.map((registration, ordinal) => [
      registration.namespace,
      {
        entrypoint: "./deterministic-plugin/index.js",
        config: { outcome: registration.outcome, ordinal },
        failurePolicy: "fatal",
      },
    ]),
  );
  const config = { version: 1, runtime: { gitAdapter: "isomorphic-git" }, extensions };
  await writeFile(
    join(directory, "plugin-input.json"),
    `${JSON.stringify({ recipeRevision: "performance-v2", package: { name: "@gitlode/performance-fixture-plugin", version: "1.0.0" }, registrations }, undefined, 2)}\n`,
  );
  await writeFile(
    join(directory, "gitlode.config.json"),
    `${JSON.stringify(config, undefined, 2)}\n`,
  );
  return { registrations, configPath: join(directory, "gitlode.config.json") };
}
export function createAggregationFixture(scale: number) {
  return Array.from({ length: scale }, (_, index) => ({
    identity: `observation-${index % 4}`,
    attributes: { outcome: index % 2 ? "success" : "skip" },
    value: index + 0.125,
  }));
}
