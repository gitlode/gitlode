import { describe, expect, it } from "vitest";

import { runCalibrationWorkflow } from "../../scripts/tooling/calibration-workflow.js";
import { createProductionCalibrationArtifactAdapter } from "../../scripts/tooling/production-calibration-artifacts.js";

describe("production calibration artifact adapter", () => {
  it("persists the production success sequence with exact filenames and final manifest", async () => {
    const writes: { name: string; value: Record<string, unknown> }[] = [];
    const manifests: unknown[] = [];
    const quantities: number[] = [];
    const adapter = createProductionCalibrationArtifactAdapter({
      artifacts: "ignored",
      safeKey: "fixture-git-cli",
      quantities: (commits) => ({ commits, files: 2 }),
      environmentRef: "fixture-git-cli-environment.json",
      updateManifest: (commits) => ({ complete: true, commits }),
      recipeHash: (manifest) => `selected-${manifest.commits}`,
      sealedManifestHash: () => "sealed",
      makeEnvironment: async (manifest) => ({ fingerprint: manifest.commits }),
      writeJson: async (name, value) =>
        writes.push({ name, value: value as Record<string, unknown> }),
      writeManifest: async (manifest) => manifests.push(manifest),
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
      manifest: { complete: false },
      dependencies: {
        executePilot: async (quantity) => {
          quantities.push(quantity);
          return {
            measuredMs: Array(7).fill(values.get(quantity)),
            evidence: {
              warmupRuns: [{ elapsedMs: 1 }],
              measuredRuns: [{ elapsedMs: 2 }],
              behaviorEvidence: [{ normalized: true }],
            },
          };
        },
        ...adapter,
        updateManifest: (commits) => ({ complete: true, commits }),
        recipeHash: (quantity) => `attempt-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    expect(result).toMatchObject({ status: "complete", exitCode: 0 });
    expect(quantities).toEqual([8, 16, 12, 14, 13]);
    expect(new Set(quantities).size).toBe(quantities.length);
    expect(writes.map((entry) => entry.name)).toEqual([
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-calibration-progress.json",
      "fixture-git-cli-environment.json",
      "fixture-git-cli-calibration.json",
      "fixture-git-cli-calibration-progress.json",
    ]);
    const success = writes.at(-2)!.value;
    expect(success).toMatchObject({
      schemaVersion: 3,
      kind: "calibration",
      status: "complete",
      initialQuantity: 8,
      selectedQuantity: 14,
      quantities: { commits: 14, files: 2 },
      environmentRef: "fixture-git-cli-environment.json",
      sealedManifestHash: "sealed",
      calibrationTargetRecipeHash: "selected-14",
    });
    expect(
      (success.attempts as Record<string, unknown>[]).map(
        (attempt) => attempt.calibrationTargetRecipeHash,
      ),
    ).toEqual(["attempt-8", "attempt-16", "attempt-12", "attempt-14", "attempt-13"]);
    expect(
      (success.attempts as Record<string, unknown>[]).every((attempt) => !("evidence" in attempt)),
    ).toBe(true);
    expect(manifests).toEqual([{ complete: true, commits: 14 }]);
  });
});
