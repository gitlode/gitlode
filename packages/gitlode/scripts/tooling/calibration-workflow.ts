import {
  classifyCalibrationMedian,
  mad,
  median,
  planCalibration,
  type CalibrationPlannerAction,
  type CalibrationPlannerAttempt,
} from "../../test/support/performance-harness.js";

export type CalibrationWorkflowStatus = "complete" | "failed" | "inconclusive";
export type CalibrationPilotEvidence = {
  readonly warmupRuns: readonly unknown[];
  readonly measuredRuns: readonly unknown[];
  readonly behaviorEvidence: readonly unknown[];
};
export type CalibrationPilot = {
  readonly measuredMs: readonly number[];
  readonly childErrors?: readonly string[];
  readonly behaviorErrors?: readonly string[];
  readonly evidence: CalibrationPilotEvidence;
};
export type CalibrationWorkflowAttempt = CalibrationPlannerAttempt & {
  readonly ordinal: number;
  readonly madMs: number;
  readonly classification: ReturnType<typeof classifyCalibrationMedian>;
  readonly warmupRuns: readonly unknown[];
  readonly measuredRuns: readonly unknown[];
  readonly childValidation: readonly string[];
  readonly behavioralValidation: readonly string[];
  readonly behaviorEvidence: readonly unknown[];
  readonly calibrationTargetRecipeHash: string;
};
type ArtifactBase = {
  readonly schemaVersion: 3;
  readonly fixture: string;
  readonly adapter: string;
  readonly legacyRevision: string;
  readonly benchmarkScriptRevision: string;
  readonly initialQuantity: number;
  readonly attempts: readonly CalibrationWorkflowAttempt[];
  readonly action: CalibrationPlannerAction;
};
export type CalibrationProgressArtifact = ArtifactBase & {
  readonly kind: "calibration-progress";
  readonly status: "in-progress" | "complete" | "failed" | "inconclusive";
};
export type CalibrationFailureArtifact = ArtifactBase & {
  readonly kind: "calibration-failure";
  readonly status: "fail" | "inconclusive";
  readonly failureStage: string;
  readonly reason: string;
  readonly failedQuantity?: number;
  readonly failedQuantityRecipeHash?: string;
};
export type CalibrationEnvironmentArtifact = ArtifactBase & {
  readonly kind: "calibration-environment";
  readonly status: "complete";
  readonly selectedQuantity: number;
};
export type CalibrationSuccessArtifact = ArtifactBase & {
  readonly kind: "calibration";
  readonly status: "complete";
  readonly selectedQuantity: number;
  readonly calibrationTargetRecipeHash: string;
};
export interface CalibrationWorkflowDependencies<Manifest> {
  readonly executePilot: (quantity: number) => Promise<CalibrationPilot>;
  readonly writeProgress: (value: CalibrationProgressArtifact) => Promise<void>;
  readonly writeFailure: (value: CalibrationFailureArtifact) => Promise<void>;
  readonly writeEnvironment: (value: CalibrationEnvironmentArtifact) => Promise<void>;
  readonly writeSuccess: (value: CalibrationSuccessArtifact) => Promise<void>;
  readonly writeManifest: (manifest: Manifest) => Promise<void>;
  readonly updateManifest: (selectedQuantity: number) => Manifest;
  readonly recipeHash: (quantity: number) => string;
  readonly revisions: () => Promise<{
    readonly legacyRevision: string;
    readonly benchmarkScriptRevision: string;
  }>;
}
export interface CalibrationWorkflowInput<Manifest> {
  readonly initialQuantity: number;
  readonly fixture: string;
  readonly adapter: string;
  readonly manifest: Manifest;
  readonly dependencies: CalibrationWorkflowDependencies<Manifest>;
}
export type CalibrationWorkflowResult<Manifest> = {
  readonly status: CalibrationWorkflowStatus;
  readonly exitCode: 0 | 2;
  readonly attempts: readonly CalibrationWorkflowAttempt[];
  readonly action: CalibrationPlannerAction;
  readonly manifest?: Manifest;
};

/** Production calibration orchestration. All terminal outcomes retain safe evidence. */
export async function runCalibrationWorkflow<Manifest>(
  input: CalibrationWorkflowInput<Manifest>,
): Promise<CalibrationWorkflowResult<Manifest>> {
  const { dependencies, initialQuantity } = input;
  const attempts: CalibrationWorkflowAttempt[] = [];
  let action: CalibrationPlannerAction;
  let revisions = { legacyRevision: "unavailable", benchmarkScriptRevision: "unavailable" };
  try {
    action = planCalibration(initialQuantity, []);
    revisions = await dependencies.revisions();
  } catch {
    return persistTerminal("inconclusive", "revision-resolution", {
      kind: "inconclusive-evidence",
      code: "behavior-validation-failed",
    });
  }
  for (;;) {
    if (action.kind === "complete") break;
    if (action.kind.startsWith("fail-") || action.kind.startsWith("inconclusive-"))
      return persistTerminal(
        action.kind.startsWith("inconclusive-") ? "inconclusive" : "failed",
        "planner",
        action,
      );
    const planned = action;
    let pilot: CalibrationPilot;
    try {
      pilot = await dependencies.executePilot(planned.quantity);
    } catch {
      return persistTerminal("inconclusive", "preparation-or-capture", planned, planned.quantity);
    }
    try {
      if (!pilot.measuredMs.length) throw new Error("empty measured runs");
      const medianMs = median(pilot.measuredMs);
      const madMs = mad(pilot.measuredMs);
      const madRatio = medianMs === 0 ? Number.POSITIVE_INFINITY : madMs / medianMs;
      const childValidation = pilot.childErrors ?? [];
      const behavioralValidation = pilot.behaviorErrors ?? [];
      attempts.push({
        ordinal: attempts.length + 1,
        quantity: planned.quantity,
        medianMs,
        madMs,
        madRatio,
        childValid: !childValidation.length,
        behaviorValid: !behavioralValidation.length,
        classification: classifyCalibrationMedian(medianMs),
        childValidation,
        behavioralValidation,
        warmupRuns: pilot.evidence.warmupRuns,
        measuredRuns: pilot.evidence.measuredRuns,
        behaviorEvidence: pilot.evidence.behaviorEvidence,
        calibrationTargetRecipeHash: dependencies.recipeHash(planned.quantity),
      });
      action = planCalibration(initialQuantity, attempts);
      await dependencies.writeProgress(progress(statusFor(action), action));
    } catch {
      return persistTerminal("inconclusive", "attempt-processing", planned, planned.quantity);
    }
  }
  const selectedQuantity = action.quantity;
  const updated = dependencies.updateManifest(selectedQuantity);
  try {
    await dependencies.writeEnvironment(environment(action));
  } catch {
    return persistTerminal("inconclusive", "environment-persistence", action, selectedQuantity);
  }
  try {
    await dependencies.writeSuccess(success(action));
  } catch {
    return persistTerminal("inconclusive", "success-persistence", action, selectedQuantity);
  }
  try {
    await dependencies.writeProgress(progress("complete", action));
  } catch {
    return persistTerminal("inconclusive", "progress-persistence", action, selectedQuantity);
  }
  try {
    await dependencies.writeManifest(updated);
  } catch {
    return persistTerminal("inconclusive", "manifest-persistence", action, selectedQuantity);
  }
  return { status: "complete", exitCode: 0, attempts, action, manifest: updated };

  function base(current: CalibrationPlannerAction): ArtifactBase {
    return {
      schemaVersion: 3,
      fixture: input.fixture,
      adapter: input.adapter,
      legacyRevision: revisions.legacyRevision,
      benchmarkScriptRevision: revisions.benchmarkScriptRevision,
      initialQuantity,
      attempts: [...attempts],
      action: current,
    };
  }
  function progress(
    status: CalibrationProgressArtifact["status"],
    current: CalibrationPlannerAction,
  ): CalibrationProgressArtifact {
    return { ...base(current), kind: "calibration-progress", status };
  }
  function environment(current: CalibrationPlannerAction): CalibrationEnvironmentArtifact {
    return {
      ...base(current),
      kind: "calibration-environment",
      status: "complete",
      selectedQuantity: current.quantity,
    };
  }
  function success(current: CalibrationPlannerAction): CalibrationSuccessArtifact {
    return {
      ...base(current),
      kind: "calibration",
      status: "complete",
      selectedQuantity: current.quantity,
      calibrationTargetRecipeHash: dependencies.recipeHash(current.quantity),
    };
  }
  async function persistTerminal(
    status: "failed" | "inconclusive",
    failureStage: string,
    current: CalibrationPlannerAction,
    failedQuantity?: number,
  ): Promise<CalibrationWorkflowResult<Manifest>> {
    const failure: CalibrationFailureArtifact = {
      ...base(current),
      kind: "calibration-failure",
      status: status === "failed" ? "fail" : "inconclusive",
      failureStage,
      reason: "code" in current ? current.code : current.kind,
      failedQuantity,
      failedQuantityRecipeHash:
        failedQuantity === undefined ? undefined : dependencies.recipeHash(failedQuantity),
    };
    // A failed progress write must not prevent an independent terminal failure attempt.
    await dependencies.writeProgress(progress(status, current)).catch(() => undefined);
    await dependencies.writeFailure(failure).catch(() => undefined);
    return { status, exitCode: 2, attempts, action: current };
  }
}
function statusFor(action: CalibrationPlannerAction): CalibrationProgressArtifact["status"] {
  if (action.kind === "complete") return "complete";
  if (action.kind.startsWith("fail-")) return "failed";
  if (action.kind.startsWith("inconclusive-")) return "inconclusive";
  return "in-progress";
}
