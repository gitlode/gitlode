import { describe, expect, it } from "vitest";

import { runCalibrationWorkflow } from "../../scripts/tooling/calibration-workflow.js";
import { createProductionCalibrationArtifactAdapter } from "../../scripts/tooling/production-calibration-artifacts.js";

type JsonRecord = Record<string, unknown>;

function expectJsonSafe(value: unknown): void {
  expect(value).not.toBeUndefined();
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
  } else if (Array.isArray(value)) {
    for (const item of value) expectJsonSafe(item);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) expectJsonSafe(item);
  }
}

describe("production calibration artifact adapter", () => {
  it("persists the exact bracketed success sequence without mutating the input manifest", async () => {
    const events: { name: string; value: JsonRecord }[] = [];
    const environmentCalls: { manifest: JsonRecord; artifact: JsonRecord }[] = [];
    const quantities: number[] = [];
    const inputManifest = {
      target: { quantity: 8, status: "pending", thresholdMs: 10_000 },
      rawRepositoryPath: "C:/sentinel/repository",
    };
    const updateManifest = (commits: number) => ({
      target: inputManifest.target,
      calibration: { status: "complete", selectedQuantity: commits },
    });
    const adapter = createProductionCalibrationArtifactAdapter({
      safeKey: "fixture-git-cli",
      quantities: (commits) => ({ commits, files: 2 }),
      environmentRef: "fixture-git-cli-environment.json",
      updateManifest,
      recipeHash: (manifest) => `selected-${manifest.calibration.selectedQuantity}`,
      sealedManifestHash: () => "sealed",
      makeEnvironment: async (manifest, artifact) => {
        environmentCalls.push({ manifest, artifact });
        return {
          schemaVersion: 1,
          kind: "environment-fingerprint",
          selectedQuantity: manifest.calibration.selectedQuantity,
          artifact: {
            kind: artifact.kind,
            selectedQuantity: artifact.selectedQuantity,
            calibrationTargetRecipeHash: artifact.calibrationTargetRecipeHash,
          },
        };
      },
      writeJson: async (name, value) => events.push({ name, value: value as JsonRecord }),
      writeManifest: async (manifest) => events.push({ name: "manifest", value: manifest }),
    });
    const values = new Map([
      [8, 9_000],
      [16, 31_000],
      [12, 9_500],
      [14, 10_000],
      [13, 9_999],
    ]);
    const result = await runCalibrationWorkflow({
      initialQuantity: 8,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: inputManifest,
      dependencies: {
        executePilot: async (quantity) => {
          quantities.push(quantity);
          return {
            measuredMs: Array(7).fill(values.get(quantity)),
            evidence: {
              warmupRuns: [{ phase: "warmup", quantity, elapsedMs: 1 }],
              measuredRuns: [{ phase: "measured", quantity, elapsedMs: 2 }],
              behaviorEvidence: [{ quantity, normalized: true }],
            },
          };
        },
        ...adapter,
        updateManifest,
        recipeHash: (quantity) => `attempt-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });

    const attempt = (
      ordinal: number,
      quantity: number,
      medianMs: number,
      classification: "lower" | "accepted" | "upper",
    ) => ({
      ordinal,
      quantity,
      medianMs,
      madMs: 0,
      madRatio: 0,
      classification,
      childValid: true,
      behaviorValid: true,
      childValidation: [],
      behavioralValidation: [],
      warmupRuns: [{ phase: "warmup", quantity, elapsedMs: 1 }],
      measuredRuns: [{ phase: "measured", quantity, elapsedMs: 2 }],
      behaviorEvidence: [{ quantity, normalized: true }],
      calibrationTargetRecipeHash: `attempt-${quantity}`,
    });
    const attempts = [
      attempt(1, 8, 9_000, "lower"),
      attempt(2, 16, 31_000, "upper"),
      attempt(3, 12, 9_500, "lower"),
      attempt(4, 14, 10_000, "accepted"),
      attempt(5, 13, 9_999, "lower"),
    ];
    const base = (currentAttempts: readonly JsonRecord[], action: JsonRecord, hash: string) => ({
      schemaVersion: 3,
      fixture: "fixture",
      adapter: "git-cli",
      legacyRevision: "legacy",
      benchmarkScriptRevision: "script",
      initialQuantity: 8,
      attempts: currentAttempts,
      action,
      calibrationTargetRecipeHash: hash,
    });
    const progress = [
      {
        ...base(attempts.slice(0, 1), { kind: "expand-upper", quantity: 16 }, "attempt-8"),
        kind: "calibration-progress",
        status: "in-progress",
      },
      {
        ...base(
          attempts.slice(0, 2),
          { kind: "refine-bracket", quantity: 12, lower: 8, upper: 16 },
          "attempt-16",
        ),
        kind: "calibration-progress",
        status: "in-progress",
      },
      {
        ...base(
          attempts.slice(0, 3),
          { kind: "refine-bracket", quantity: 14, lower: 12, upper: 16 },
          "attempt-12",
        ),
        kind: "calibration-progress",
        status: "in-progress",
      },
      {
        ...base(
          attempts.slice(0, 4),
          { kind: "refine-bracket", quantity: 13, lower: 12, upper: 14 },
          "attempt-14",
        ),
        kind: "calibration-progress",
        status: "in-progress",
      },
      {
        ...base(attempts, { kind: "complete", quantity: 14 }, "attempt-13"),
        kind: "calibration-progress",
        status: "complete",
      },
      {
        ...base(attempts, { kind: "complete", quantity: 14 }, "attempt-14"),
        kind: "calibration-progress",
        status: "complete",
      },
    ];
    const environmentArtifact = {
      ...base(attempts, { kind: "complete", quantity: 14 }, "attempt-14"),
      kind: "calibration-environment",
      status: "complete",
      selectedQuantity: 14,
    };
    const success = {
      ...base(attempts, { kind: "complete", quantity: 14 }, "selected-14"),
      kind: "calibration",
      status: "complete",
      selectedQuantity: 14,
      quantities: { commits: 14, files: 2 },
      environmentRef: "fixture-git-cli-environment.json",
      sealedManifestHash: "sealed",
    };

    expect(result).toEqual({
      status: "complete",
      exitCode: 0,
      attempts,
      action: { kind: "complete", quantity: 14 },
      manifest: updateManifest(14),
    });
    expect(quantities).toEqual([8, 16, 12, 14, 13]);
    expect(new Set(quantities).size).toBe(quantities.length);
    expect(events).toEqual([
      { name: "fixture-git-cli-calibration-progress.json", value: progress[0] },
      { name: "fixture-git-cli-calibration-progress.json", value: progress[1] },
      { name: "fixture-git-cli-calibration-progress.json", value: progress[2] },
      { name: "fixture-git-cli-calibration-progress.json", value: progress[3] },
      { name: "fixture-git-cli-calibration-progress.json", value: progress[4] },
      {
        name: "fixture-git-cli-environment.json",
        value: {
          schemaVersion: 1,
          kind: "environment-fingerprint",
          selectedQuantity: 14,
          artifact: {
            kind: "calibration-environment",
            selectedQuantity: 14,
            calibrationTargetRecipeHash: "attempt-14",
          },
        },
      },
      { name: "fixture-git-cli-calibration.json", value: success },
      { name: "fixture-git-cli-calibration-progress.json", value: progress[5] },
      { name: "manifest", value: updateManifest(14) },
    ]);
    expect(environmentCalls).toEqual([
      { manifest: updateManifest(14), artifact: environmentArtifact },
    ]);
    expect(inputManifest).toEqual({
      target: { quantity: 8, status: "pending", thresholdMs: 10_000 },
      rawRepositoryPath: "C:/sentinel/repository",
    });

    const eventNames = events.map(({ name }) => name);
    expect(eventNames).toEqual([
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-environment.json",
      "fixture-git-cli-calibration.json",
      "fixture-git-cli-calibration-progress.json",
      "manifest",
    ]);
    expect(eventNames.filter((name) => name === "manifest")).toHaveLength(1);
    expect(eventNames.at(-1)).toBe("manifest");

    for (const artifact of [...events.map(({ value }) => value), environmentArtifact]) {
      const serialized = JSON.stringify(artifact);
      expect(serialized).not.toContain("C:/sentinel");
      expect(serialized).not.toContain("rawRepositoryPath");
      const restored = JSON.parse(serialized) as JsonRecord;
      expect(restored).toEqual(artifact);
      expectJsonSafe(restored);
      expect(JSON.stringify(restored)).not.toContain('"evidence"');
    }
  });
});
