import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  performanceStage,
  performanceFinished,
} from "../../packages/gitlode/scripts/tooling/performance-progress.js";
import {
  performanceBehaviorEvidence,
  comparePerformanceBehavior,
  type PerformanceBehavior,
} from "../../packages/gitlode/test/support/performance-equivalence.js";
import { createPerformanceRepository } from "../../packages/gitlode/test/support/performance-fixtures.js";
import { launchMeasuredChild } from "../../packages/gitlode/test/support/performance-harness.js";
import { inspectRun } from "./inspection.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = resolve(source, "../..");
const repository = await realpath(join(root, "fixture/repository"));
const mode = process.argv[2];
if (mode === "prepare") {
  performanceStage({ stage: "preparation", operation: "repository-generation" });
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  const quantities =
    manifest.calibrationTargets["commit_heavy_repository/isomorphic-git"].quantities;
  assert.equal(quantities.commits, 4430);
  await mkdir(join(root, "fixture"));
  await createPerformanceRepository(repository, "commit_heavy_repository", quantities);
  await writeFile(
    join(root, "config.json"),
    JSON.stringify({ version: 1, runtime: { gitAdapter: "isomorphic-git" } }) + "\n",
  );
  await writeFile(
    join(root, "evidence/fixture-preparation.json"),
    JSON.stringify({ repository, quantities, completed: true }, null, 2),
  );
} else {
  assert.equal(mode, "run");
  const ordinal = Number(process.argv[3]);
  const order = ["V0", "V1", "V2", "V2", "V1", "V0"];
  const variant = process.argv[4];
  assert.equal(variant, order[ordinal - 1]);
  const runDir = join(root, "runs", String(ordinal));
  await mkdir(runDir);
  const output = join(runDir, "output");
  await mkdir(output);
  const checkpointPath = join(runDir, "state.json");
  const boundaries = join(runDir, "boundaries.jsonl");
  const args = [
    join(root, "runtimes", variant, "dist/index.js"),
    repository,
    "--ref",
    "main",
    "--output-dir",
    output,
    "--output-prefix",
    "performance",
    "--state",
    checkpointPath,
    "--config",
    join(root, "config.json"),
  ];
  await writeFile(
    join(runDir, "command.json"),
    JSON.stringify(
      {
        variant,
        ordinal,
        executable: process.execPath,
        args: [...args, "--quiet"],
        envObservation: boundaries,
        state: "target_off",
      },
      null,
      2,
    ),
  );
  performanceStage({
    stage: "execution",
    operation: "release-cli",
    iteration: ordinal,
    state: "target_off",
  });
  const raw = await launchMeasuredChild({
    executable: process.execPath,
    args,
    outputDirectory: output,
    checkpointPath,
    state: "target_off",
    phase: "measured",
    order: ordinal <= 3 ? "A-B" : "B-A",
    env: { ...process.env, GITLODE_RSS_EXPERIMENT_LOG: boundaries },
  });
  await writeFile(join(runDir, "raw.json"), JSON.stringify(raw, null, 2));
  performanceStage({ stage: "processing", operation: "capture-run" });
  const baselineDir =
    ordinal > 1 ? (process.env.GITLODE_RSS_BASELINE ?? join(root, "runs/1")) : undefined;
  const inspection = await inspectRun(runDir, repository, ordinal, variant, runDir, baselineDir);
  console.log(JSON.stringify(inspection));
}
await performanceFinished();
