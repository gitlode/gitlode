import { describe, expect, it } from "vitest";

import { projectCalibrationPilot } from "../../scripts/tooling/calibration-pilot-projection.js";

describe("production calibration pilot projection", () => {
  it("separates phases and retains only artifact-safe normalized evidence", () => {
    const repository = "C:/sentinel/repository";
    const runs = [
      {
        phase: "warmup" as const,
        elapsedMs: 3,
        exit: { code: 0, signal: null },
        outputDirectory: "C:/sentinel/output",
        checkpointPath: "C:/sentinel/checkpoint",
        runId: "warmup",
      },
      {
        phase: "measured" as const,
        elapsedMs: 7,
        exit: { code: 1, signal: null },
        outputDirectory: "C:/sentinel/output",
        checkpointPath: "C:/sentinel/checkpoint",
        runId: "measured",
      },
    ];
    const projected = projectCalibrationPilot({
      runs,
      behavioralValidation: ["behavior failed"],
      repositoryPath: repository,
      behavior: new Map([
        [
          "measured",
          {
            exit: { code: 1, signal: null },
            checkpoint: { repositoryPath: repository, generatedAt: "now" },
            jsonl: [],
            derived: { records: 1, commits: 1, skippedDiffs: 0, files: 1, bytes: 1 },
            captureErrors: [],
          },
        ],
      ]),
    });
    expect(projected).toEqual({
      measuredMs: [7],
      childErrors: ["calibration child failed"],
      behaviorErrors: ["behavior failed"],
      evidence: {
        warmupRuns: [
          { phase: "warmup", elapsedMs: 3, exit: { code: 0, signal: null }, runId: "warmup" },
        ],
        measuredRuns: [
          { phase: "measured", elapsedMs: 7, exit: { code: 1, signal: null }, runId: "measured" },
        ],
        behaviorEvidence: [
          {
            exit: { code: 1, signal: null },
            checkpoint: { repositoryPath: "<repository>", generatedAt: "<session>" },
            files: [],
            derived: { records: 1, commits: 1, skippedDiffs: 0, files: 1, bytes: 1 },
            captureErrors: [],
          },
        ],
      },
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain(repository);
    expect(serialized).not.toContain("sentinel/output");
    expect(JSON.parse(serialized).measuredMs).toEqual([7]);
  });
});
