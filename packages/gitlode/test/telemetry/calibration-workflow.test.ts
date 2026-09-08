import { describe, expect, it } from "vitest";

import { runCalibrationWorkflow } from "../../scripts/tooling/calibration-workflow.js";

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
        executePilot: async (quantity) => ({
          measuredMs: Array(7).fill(values.get(quantity)),
          evidence: { warmupRuns: [], measuredRuns: [], behaviorEvidence: [] },
        }),
        writeProgress: async (value) => artifacts.push({ kind: "progress", value }),
        writeFailure: async (value) => artifacts.push({ kind: "failure", value }),
        writeEnvironment: async (value) => artifacts.push({ kind: "environment", value }),
        writeSuccess: async (value) => artifacts.push({ kind: "success", value }),
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
          evidence: { warmupRuns: [], measuredRuns: [], behaviorEvidence: [] },
          ...(expected === "inconclusive" ? { childErrors: ["nonzero"] } : {}),
        }),
        writeProgress: async (value) => artifacts.push(value),
        writeFailure: async (value) => artifacts.push(value),
        writeEnvironment: async (value) => artifacts.push(value),
        writeSuccess: async (value) => artifacts.push(value),
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
      status: expected === "failed" ? "fail" : expected,
      initialQuantity: 8,
      legacyRevision: "legacy",
      benchmarkScriptRevision: "script",
    });
  });

  it("attempts failure persistence even when terminal progress persistence fails", async () => {
    const writes: string[] = [];
    const result = await runCalibrationWorkflow({
      initialQuantity: 8,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: {},
      dependencies: {
        executePilot: async () => ({
          measuredMs: [10_000],
          evidence: { warmupRuns: [], measuredRuns: [], behaviorEvidence: [] },
          childErrors: ["child failed"],
        }),
        writeProgress: async () => {
          writes.push("progress");
          throw new Error("storage sentinel");
        },
        writeFailure: async (artifact) => {
          writes.push("failure");
          expect(artifact).toMatchObject({
            kind: "calibration-failure",
            status: "inconclusive",
            failedQuantity: 8,
            failedQuantityRecipeHash: "hash-8",
          });
        },
        writeEnvironment: async () => undefined,
        writeSuccess: async () => undefined,
        writeManifest: async () => undefined,
        updateManifest: () => ({}),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    expect(result).toMatchObject({ status: "inconclusive", exitCode: 2 });
    expect(writes).toEqual(["progress", "progress", "failure"]);
  });

  it("uses deterministic terminal metadata and the final attempted quantity", async () => {
    const failures: Record<string, unknown>[] = [];
    const result = await runCalibrationWorkflow({
      initialQuantity: 8,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: {},
      dependencies: {
        executePilot: async (quantity) => ({
          measuredMs: Array(7).fill(quantity === 8 ? 9_999 : 30_001),
          evidence: { warmupRuns: [], measuredRuns: [], behaviorEvidence: [] },
        }),
        writeProgress: async () => undefined,
        writeFailure: async (value) => failures.push(value),
        writeEnvironment: async () => undefined,
        writeSuccess: async () => undefined,
        writeManifest: async () => undefined,
        updateManifest: () => ({}),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    expect(result).toMatchObject({ status: "failed", exitCode: 2 });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      failureStage: "planner",
      reason: "adjacent-integers-skip-window",
      failedQuantity: 9,
      failedQuantityRecipeHash: "hash-9",
      calibrationTargetRecipeHash: "hash-9",
    });
  });

  it("does not leak a revision exception or invent a quantity", async () => {
    const failures: Record<string, unknown>[] = [];
    await runCalibrationWorkflow({
      initialQuantity: 8,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: {},
      dependencies: {
        executePilot: async () => {
          throw new Error("not reached");
        },
        writeProgress: async () => undefined,
        writeFailure: async (value) => failures.push(value),
        writeEnvironment: async () => undefined,
        writeSuccess: async () => undefined,
        writeManifest: async () => undefined,
        updateManifest: () => ({}),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => {
          throw new Error("C:\\secret\\checkpoint.tmp");
        },
      },
    });
    expect(failures[0]).toMatchObject({
      failureStage: "revision-resolution",
      reason: "revision-resolution-failed",
    });
    expect(failures[0]).not.toHaveProperty("failedQuantity");
    expect(JSON.stringify(failures[0])).not.toContain("checkpoint.tmp");
  });

  it.each([
    ["empty", []],
    ["NaN", [Number.NaN]],
    ["Infinity", [Number.POSITIVE_INFINITY]],
    ["negative", [-1]],
    ["zero MAD ratio", [0]],
  ])("keeps invalid %s measurements out of completed JSON history", async (_name, measuredMs) => {
    const artifacts: Record<string, unknown>[] = [];
    const result = await runCalibrationWorkflow({
      initialQuantity: 8,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: {},
      dependencies: {
        executePilot: async () => ({
          measuredMs,
          evidence: {
            warmupRuns: [{ elapsedMs: 1 }],
            measuredRuns: [{ elapsedMs: 2 }],
            behaviorEvidence: [{ normalized: true }],
          },
        }),
        writeProgress: async (value) => artifacts.push(value),
        writeFailure: async (value) => artifacts.push(value),
        writeEnvironment: async () => undefined,
        writeSuccess: async () => undefined,
        writeManifest: async () => undefined,
        updateManifest: () => ({}),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    expect(result).toMatchObject({ status: "inconclusive", exitCode: 2, attempts: [] });
    const failure = artifacts.at(-1)!;
    expect(failure).toMatchObject({
      failureStage: "attempt-processing",
      reason: "attempt-processing-failed",
      failedQuantity: 8,
      failedQuantityRecipeHash: "hash-8",
      failedPilotEvidence: {
        quantity: 8,
        warmupRuns: [{ elapsedMs: 1 }],
        measuredRuns: [{ elapsedMs: 2 }],
        childValidation: [],
        behavioralValidation: [],
        behaviorEvidence: [{ normalized: true }],
      },
    });
    const json = JSON.stringify(failure);
    expect(json).not.toContain("null");
    expect(JSON.parse(json).attempts).toEqual([]);
  });
});
