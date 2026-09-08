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
      },
      {
        phase: "measured" as const,
        elapsedMs: 7,
        exit: { code: 1, signal: null },
        outputDirectory: "C:/sentinel/output",
        checkpointPath: "C:/sentinel/checkpoint",
      },
    ];
    const projected = projectCalibrationPilot({
      runs,
      artifactRun: ({ outputDirectory: _output, checkpointPath: _checkpoint, ...safe }) => safe,
      behavioralValidation: ["behavior failed"],
      behaviorEvidence: () => ({ normalizedRepository: "<repository>", result: "same" }),
    });
    expect(projected).toEqual({
      measuredMs: [7],
      childErrors: ["calibration child failed"],
      behaviorErrors: ["behavior failed"],
      evidence: {
        warmupRuns: [{ phase: "warmup", elapsedMs: 3, exit: { code: 0, signal: null } }],
        measuredRuns: [{ phase: "measured", elapsedMs: 7, exit: { code: 1, signal: null } }],
        behaviorEvidence: [{ normalizedRepository: "<repository>", result: "same" }],
      },
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain(repository);
    expect(serialized).not.toContain("sentinel/output");
    expect(JSON.parse(serialized).measuredMs).toEqual([7]);
  });
});
