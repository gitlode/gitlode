import { describe, expect, it } from "vitest";

import { runCalibrationWorkflow } from "../../scripts/tooling/calibration-workflow.js";

describe("calibration workflow", () => {
  function expectFiniteNumbers(value: unknown): void {
    if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    else if (Array.isArray(value)) value.forEach(expectFiniteNumbers);
    else if (value !== null && typeof value === "object")
      Object.values(value).forEach(expectFiniteNumbers);
  }

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

  it.each([
    {
      name: "safe integer expansion exhaustion",
      initialQuantity: Number.MAX_SAFE_INTEGER,
      measuredMs: [9_999],
      childErrors: undefined,
      behaviorErrors: undefined,
      status: "failed",
      failureStage: "planner",
      reason: "safe-integer-expansion-exhausted",
      action: { kind: "fail-safe-integer-expansion", code: "safe-integer-expansion-exhausted" },
      failedQuantity: Number.MAX_SAFE_INTEGER,
    },
    {
      name: "MAD ratio exceeds the limit",
      initialQuantity: 8,
      measuredMs: [9_000, 10_000, 11_000],
      childErrors: undefined,
      behaviorErrors: undefined,
      status: "inconclusive",
      failureStage: "planner",
      reason: "mad-ratio-exceeds-limit",
      action: { kind: "inconclusive-unstable", code: "mad-ratio-exceeds-limit" },
      failedQuantity: 8,
    },
    {
      name: "behavior validation failure",
      initialQuantity: 8,
      measuredMs: [10_000],
      childErrors: undefined,
      behaviorErrors: ["behavior sentinel"],
      status: "inconclusive",
      failureStage: "planner",
      reason: "behavior-validation-failed",
      action: { kind: "inconclusive-evidence", code: "behavior-validation-failed" },
      failedQuantity: 8,
    },
  ])("persists exact terminal planner evidence for $name", async (testCase) => {
    const artifacts: Record<string, unknown>[] = [];
    const pilots: number[] = [];
    const result = await runCalibrationWorkflow({
      initialQuantity: testCase.initialQuantity,
      fixture: "fixture",
      adapter: "git-cli",
      manifest: { preserved: true },
      dependencies: {
        executePilot: async (quantity) => {
          pilots.push(quantity);
          return {
            measuredMs: testCase.measuredMs,
            ...(testCase.childErrors === undefined ? {} : { childErrors: testCase.childErrors }),
            ...(testCase.behaviorErrors === undefined
              ? {}
              : { behaviorErrors: testCase.behaviorErrors }),
            evidence: { warmupRuns: [], measuredRuns: [], behaviorEvidence: [] },
          };
        },
        writeProgress: async (value) => artifacts.push(value),
        writeFailure: async (value) => artifacts.push(value),
        writeEnvironment: async () => {
          throw new Error("must not write");
        },
        writeSuccess: async () => {
          throw new Error("must not write");
        },
        writeManifest: async () => {
          throw new Error("must not write");
        },
        updateManifest: () => ({ changed: true }),
        recipeHash: (quantity) => `hash-${quantity}`,
        revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
      },
    });
    const failure = artifacts.at(-1)!;
    expect(result.status).toBe(testCase.status);
    expect(result.exitCode).toBe(2);
    expect(result.action).toEqual(testCase.action);
    expect(result.attempts).toHaveLength(1);
    expect(new Set(pilots).size).toBe(pilots.length);
    expect(failure).toEqual(
      expect.objectContaining({
        kind: "calibration-failure",
        status: testCase.status === "failed" ? "fail" : "inconclusive",
        failureStage: testCase.failureStage,
        reason: testCase.reason,
        action: testCase.action,
        failedQuantity: testCase.failedQuantity,
        failedQuantityRecipeHash: `hash-${testCase.failedQuantity}`,
        calibrationTargetRecipeHash: `hash-${testCase.failedQuantity}`,
      }),
    );
    expectFiniteNumbers(JSON.parse(JSON.stringify(failure)));
  });

  it.each([
    [
      "planner initialization",
      0,
      "planner-initialization",
      "planner-initialization-failed",
      undefined,
    ],
    ["revision resolution", 8, "revision-resolution", "revision-resolution-failed", undefined],
    ["preparation", 8, "preparation-or-capture", "preparation-or-capture-failed", 8],
  ] as const)(
    "preserves safe terminal artifacts for %s failure",
    async (_name, initialQuantity, stage, reason, quantity) => {
      const artifacts: Record<string, unknown>[] = [];
      const result = await runCalibrationWorkflow({
        initialQuantity,
        fixture: "fixture",
        adapter: "git-cli",
        manifest: { preserved: true },
        dependencies: {
          executePilot: async () => {
            throw new Error("C:/sentinel/temp-file");
          },
          writeProgress: async (value) => artifacts.push(value),
          writeFailure: async (value) => artifacts.push(value),
          writeEnvironment: async () => undefined,
          writeSuccess: async () => undefined,
          writeManifest: async () => undefined,
          updateManifest: () => ({ changed: true }),
          recipeHash: (value) => `hash-${value}`,
          revisions: async () => {
            if (stage === "revision-resolution") throw new Error("C:/sentinel/temp-file");
            return { legacyRevision: "legacy", benchmarkScriptRevision: "script" };
          },
        },
      });
      const failure = artifacts.at(-1)!;
      expect(result.status).toBe("inconclusive");
      expect(result.exitCode).toBe(2);
      expect(failure).toEqual(expect.objectContaining({ failureStage: stage, reason }));
      if (quantity === undefined) {
        expect(failure).not.toHaveProperty("failedQuantity");
        expect(failure).toHaveProperty("calibrationTargetRecipeHash", undefined);
        expect(JSON.parse(JSON.stringify(failure))).not.toHaveProperty(
          "calibrationTargetRecipeHash",
        );
      } else {
        expect(failure).toHaveProperty("failedQuantity", quantity);
        expect(failure).toEqual(
          expect.objectContaining({
            failedQuantityRecipeHash: "hash-8",
            calibrationTargetRecipeHash: "hash-8",
          }),
        );
      }
      expect(JSON.stringify(failure)).not.toContain("sentinel");
      expectFiniteNumbers(JSON.parse(JSON.stringify(failure)));
    },
  );

  it.each([
    [
      "environment",
      "environment-persistence",
      "environment-persistence-failed",
      ["progress:complete", "environment", "progress:inconclusive", "failure"],
    ],
    [
      "success",
      "success-persistence",
      "success-persistence-failed",
      ["progress:complete", "environment", "success", "progress:inconclusive", "failure"],
    ],
    [
      "final progress",
      "progress-persistence",
      "progress-persistence-failed",
      [
        "progress:complete",
        "environment",
        "success",
        "progress:complete",
        "progress:inconclusive",
        "failure",
      ],
    ],
    [
      "manifest",
      "manifest-persistence",
      "manifest-persistence-failed",
      [
        "progress:complete",
        "environment",
        "success",
        "progress:complete",
        "manifest",
        "progress:inconclusive",
        "failure",
      ],
    ],
  ] as const)(
    "stops success persistence after %s writer failure",
    async (failurePoint, stage, reason, expectedEvents) => {
      const events: string[] = [];
      const failures: Record<string, unknown>[] = [];
      let completeProgressWrites = 0;
      const result = await runCalibrationWorkflow({
        initialQuantity: 8,
        fixture: "fixture",
        adapter: "git-cli",
        manifest: { preserved: true },
        dependencies: {
          executePilot: async () => ({
            measuredMs: [10_000],
            evidence: { warmupRuns: [], measuredRuns: [], behaviorEvidence: [] },
          }),
          writeProgress: async (artifact) => {
            events.push(`progress:${artifact.status}`);
            if (artifact.status === "complete") completeProgressWrites++;
            if (failurePoint === "final progress" && completeProgressWrites === 2)
              throw new Error("C:/sentinel/progress.tmp");
          },
          writeFailure: async (artifact) => {
            events.push("failure");
            failures.push(artifact);
          },
          writeEnvironment: async () => {
            events.push("environment");
            if (failurePoint === "environment") throw new Error("C:/sentinel/environment.tmp");
          },
          writeSuccess: async () => {
            events.push("success");
            if (failurePoint === "success") throw new Error("C:/sentinel/success.tmp");
          },
          writeManifest: async () => {
            events.push("manifest");
            if (failurePoint === "manifest") throw new Error("C:/sentinel/manifest.tmp");
          },
          updateManifest: () => ({ selectedQuantity: 8 }),
          recipeHash: (quantity) => `hash-${quantity}`,
          revisions: async () => ({ legacyRevision: "legacy", benchmarkScriptRevision: "script" }),
        },
      });
      expect(result).toEqual({
        status: "inconclusive",
        exitCode: 2,
        attempts: expect.any(Array),
        action: { kind: "complete", quantity: 8 },
      });
      expect(events).toEqual(expectedEvents);
      expect(events.at(-1)).toBe("failure");
      expect(events.filter((event) => event === "manifest")).toHaveLength(
        failurePoint === "manifest" ? 1 : 0,
      );
      expect(events.includes("success")).toBe(failurePoint !== "environment");
      if (failurePoint !== "manifest") expect(events).not.toContain("manifest");
      expect(failures).toEqual([
        expect.objectContaining({
          failureStage: stage,
          reason,
          failedQuantity: 8,
          failedQuantityRecipeHash: "hash-8",
          calibrationTargetRecipeHash: "hash-8",
          action: { kind: "complete", quantity: 8 },
        }),
      ]);
    },
  );
});
