import { describe, expect, it } from "vitest";

import { runCalibrationWorkflow } from "../support/calibration-workflow.js";

describe("calibration workflow", () => {
  it("persists bracketed attempts and separates initial from selected provenance", async () => {
    const artifacts: { kind: string; value: Record<string, unknown> }[] = [];
    let manifestWrites = 0;
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
        executePilot: async (quantity) => ({ measuredMs: Array(7).fill(values.get(quantity)) }),
        writeArtifact: async (kind, value) => {
          artifacts.push({ kind, value });
        },
        writeManifest: async () => {
          manifestWrites++;
        },
        updateManifest: (selectedQuantity) => ({ complete: true, selectedQuantity }),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    expect(result).toMatchObject({ status: "complete", exitCode: 0 });
    expect(result.attempts.map((attempt) => attempt.quantity)).toEqual([8, 16, 12, 14, 13]);
    expect(result.attempts.map((attempt) => attempt.calibrationTargetRecipeHash)).toEqual([
      "hash-8",
      "hash-16",
      "hash-12",
      "hash-14",
      "hash-13",
    ]);
    const success = artifacts.find((entry) => entry.kind === "success")!.value;
    expect(success).toMatchObject({
      initialQuantity: 8,
      selectedQuantity: 14,
      calibrationTargetRecipeHash: "hash-14",
      status: "complete",
    });
    expect(artifacts.filter((entry) => entry.kind === "progress").at(-1)!.value.status).toBe(
      "complete",
    );
    expect(manifestWrites).toBe(1);
  });
  it.each([
    ["initial upper", new Map([[8, 30_001]]), "failed"],
    [
      "adjacent gap",
      new Map([
        [8, 9_999],
        [16, 30_001],
        [12, 30_001],
        [10, 30_001],
        [9, 30_001],
      ]),
      "failed",
    ],
    ["child", new Map([[8, 10_000]]), "inconclusive"],
  ])("preserves terminal evidence for %s", async (_name, values, expected) => {
    const artifacts: Record<string, unknown>[] = [];
    const result = await runCalibrationWorkflow({
      initialQuantity: 8,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: {},
      dependencies: {
        executePilot: async (quantity) => ({
          measuredMs: Array(7).fill(values.get(quantity)),
          ...(expected === "inconclusive" ? { childErrors: ["nonzero"] } : {}),
        }),
        writeArtifact: async (_kind, value) => {
          artifacts.push(value);
        },
        writeManifest: async () => {
          throw new Error("must not write");
        },
        updateManifest: () => ({}),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    expect(result.status).toBe(expected);
    expect(result.exitCode).toBe(2);
    expect(artifacts.at(-1)).toMatchObject({
      status: expected,
      initialQuantity: 8,
      legacyRevision: "legacy",
      benchmarkScriptRevision: "script",
    });
  });
});
