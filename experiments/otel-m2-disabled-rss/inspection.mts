import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  performanceBehaviorEvidence,
  comparePerformanceBehavior,
  type PerformanceBehavior,
} from "../../packages/gitlode/test/support/performance-equivalence.js";

export function normalizeApplicationResult(result: any, checkpoint: any, repository: string) {
  for (const value of [checkpoint, result.checkpoint]) {
    assert.equal(
      typeof value?.generatedAt,
      "string",
      "checkpoint generatedAt must be present and string",
    );
    assert.ok(
      Number.isFinite(Date.parse(value.generatedAt)),
      "checkpoint generatedAt must be a timestamp",
    );
    assert.equal(value.repositoryPath, repository);
  }
  assert.equal(checkpoint.version, 2, "persisted checkpoint version");
  const { version, ...applicationCheckpoint } = checkpoint;
  assert.deepEqual(
    result.checkpoint,
    applicationCheckpoint,
    "application checkpoint must equal persisted checkpoint payload",
  );
  const evidence = performanceBehaviorEvidence(
    {
      exit: { code: 0, signal: null },
      checkpoint,
      jsonl: [],
      captureErrors: [],
      derived: { records: 0, commits: 0, skippedDiffs: 0, files: 0, bytes: 0 },
    },
    repository,
  );
  assert.deepEqual(evidence.captureErrors, []);
  const { version: persistedVersion, ...normalizedCheckpoint } = evidence.checkpoint as any;
  const normalized = {
    ...result,
    success: { ...result.success },
    checkpoint: normalizedCheckpoint,
  };
  delete normalized.success.elapsedMs;
  return normalized;
}

export async function inspectRun(
  runDir: string,
  repository: string,
  ordinal: number,
  variant: string,
  destination: string,
  baselineDir?: string,
) {
  await mkdir(destination, { recursive: true });
  const raw = JSON.parse(await readFile(join(runDir, "raw.json"), "utf8"));
  const output = join(runDir, "output");
  const checkpointPath = join(runDir, "state.json");
  const boundaries = join(runDir, "boundaries.jsonl");
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  const jsonl = await Promise.all(
    (await readdir(output))
      .sort()
      .map(async (name) => ({ name, bytes: await readFile(join(output, name)) })),
  );
  const value = (item: { status: string; value?: number }) => {
    assert.equal(item.status, "available");
    return item.value as number;
  };
  const behavior: PerformanceBehavior = {
    exit: raw.exit,
    checkpoint,
    jsonl,
    captureErrors: raw.captureErrors,
    derived: {
      records: value(raw.records),
      commits: value(raw.commits),
      skippedDiffs: value(raw.skippedDiffs),
      files: raw.outputFiles.length,
      bytes: raw.outputBytes,
    },
  };
  const evidence = performanceBehaviorEvidence(behavior, repository);
  await writeFile(join(destination, "behavior.json"), JSON.stringify(evidence, null, 2));
  const observations = (await readFile(boundaries, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const expected = [
    "host-after-imports-before-worker",
    "worker-after-imports-before-request",
    "worker-after-disabled-composition",
    "worker-before-extraction",
    "worker-after-extraction-before-finalization",
    "host-application-result",
    "host-after-worker-exit",
  ];
  assert.deepEqual(observations.map((item) => item.boundary).sort(), expected.sort());
  const composition = observations.find(
    (item) => item.boundary === "worker-after-disabled-composition",
  ).detail;
  assert.equal(composition.profile, false);
  assert.equal(composition.recordingEnabled, false);
  assert.equal(composition.rootRecording, false);
  assert.equal(raw.exit.code, 0);
  assert.equal(raw.exit.signal, null);
  assert.equal(raw.peakRss.status, "supported");
  assert.equal(raw.peakRss.intervalMs, 20);
  assert.equal(behavior.derived.records, 4430);
  assert.equal(behavior.derived.commits, 4430);
  assert.equal(behavior.derived.files, 1);
  assert.deepEqual(evidence.captureErrors, []);
  const result = observations.find((item) => item.boundary === "host-application-result").detail;
  assert.equal(result.kind, "success");
  assert.equal(result.success.recordsWritten, 4430);
  assert.equal(result.success.commitsTraversed, 4430);
  assert.equal(result.success.profileReport, undefined);
  const normalizedResult = normalizeApplicationResult(result, checkpoint, repository);
  await writeFile(
    join(destination, "application-result.json"),
    JSON.stringify(normalizedResult, null, 2),
  );
  let errors: string[] = [];
  if (baselineDir) {
    const baselineCheckpoint = JSON.parse(await readFile(join(baselineDir, "state.json"), "utf8"));
    const baselineEvidence = JSON.parse(await readFile(join(baselineDir, "behavior.json"), "utf8"));
    const baselineOutput = join(baselineDir, "output");
    const baselineJsonl = await Promise.all(
      (await readdir(baselineOutput))
        .sort()
        .map(async (name) => ({ name, bytes: await readFile(join(baselineOutput, name)) })),
    );
    const baseline: PerformanceBehavior = {
      exit: baselineEvidence.exit,
      checkpoint: baselineCheckpoint,
      jsonl: baselineJsonl,
      derived: baselineEvidence.derived,
      captureErrors: baselineEvidence.captureErrors,
    };
    errors = comparePerformanceBehavior(baseline, behavior, {
      repositoryPath: repository,
      baselineGeneratedAt: baselineCheckpoint.generatedAt,
      candidateGeneratedAt: checkpoint.generatedAt,
    });
    const baselineObservations = (await readFile(join(baselineDir, "boundaries.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const baselineResult = baselineObservations.find(
      (item) => item.boundary === "host-application-result",
    ).detail;
    assert.deepEqual(
      normalizedResult,
      normalizeApplicationResult(baselineResult, baselineCheckpoint, repository),
    );
  }
  await writeFile(
    join(destination, "inspection.json"),
    JSON.stringify(
      {
        variant,
        ordinal,
        errors,
        outputEquivalent: errors.length === 0,
        telemetryDisabled: true,
        boundaries: observations,
        elapsedMs: raw.elapsedMs,
        peakBytes: raw.peakRss.peakBytes,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  return {
    ordinal,
    variant,
    elapsedMs: raw.elapsedMs,
    peakBytes: raw.peakRss.peakBytes,
    outputEquivalent: true,
  };
}
