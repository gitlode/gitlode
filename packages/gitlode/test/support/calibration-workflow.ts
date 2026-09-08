import {
  classifyCalibrationMedian,
  mad,
  median,
  planCalibration,
  type CalibrationPlannerAction,
  type CalibrationPlannerAttempt,
} from "./performance-harness.js";

export type CalibrationWorkflowStatus = "complete" | "failed" | "inconclusive";
export type CalibrationPilot = {
  readonly measuredMs: readonly number[];
  readonly childErrors?: readonly string[];
  readonly behaviorErrors?: readonly string[];
  readonly evidence?: unknown;
};
export type CalibrationWorkflowAttempt = CalibrationPlannerAttempt & {
  readonly ordinal: number;
  readonly madMs: number;
  readonly classification: ReturnType<typeof classifyCalibrationMedian>;
  readonly calibrationTargetRecipeHash: string;
  readonly evidence?: unknown;
};
export interface CalibrationWorkflowDependencies<Manifest> {
  readonly executePilot: (quantity: number) => Promise<CalibrationPilot>;
  readonly writeArtifact: (
    kind: "progress" | "failure" | "environment" | "success",
    value: unknown,
  ) => Promise<void>;
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

/** Internal calibration orchestration: every expected outcome is represented as evidence, never a raw exception. */
export async function runCalibrationWorkflow<Manifest>(
  input: CalibrationWorkflowInput<Manifest>,
): Promise<CalibrationWorkflowResult<Manifest>> {
  const { dependencies, initialQuantity } = input;
  const attempts: CalibrationWorkflowAttempt[] = [];
  let action: CalibrationPlannerAction;
  let revisions: { legacyRevision: string; benchmarkScriptRevision: string };
  try {
    action = planCalibration(initialQuantity, []);
    revisions = await dependencies.revisions();
  } catch {
    return terminal("inconclusive", "preparation", {
      kind: "inconclusive-evidence",
      code: "behavior-validation-failed",
    });
  }
  for (;;) {
    if (action.kind === "complete") break;
    if (action.kind.startsWith("fail-") || action.kind.startsWith("inconclusive-"))
      return await persistTerminal(
        action.kind.startsWith("inconclusive-") ? "inconclusive" : "failed",
        "planner",
        action,
      );
    const plannedAction = action;
    let pilot: CalibrationPilot;
    try {
      pilot = await dependencies.executePilot(action.quantity);
    } catch {
      return await persistTerminal(
        "inconclusive",
        "preparation-or-capture",
        plannedAction,
        action.quantity,
      );
    }
    try {
      if (!pilot.measuredMs.length) throw new Error("empty");
      const medianMs = median(pilot.measuredMs);
      const madMs = mad(pilot.measuredMs);
      const madRatio = medianMs === 0 ? Number.POSITIVE_INFINITY : madMs / medianMs;
      const attempt: CalibrationWorkflowAttempt = {
        ordinal: attempts.length + 1,
        quantity: action.quantity,
        medianMs,
        madMs,
        madRatio,
        childValid: !pilot.childErrors?.length,
        behaviorValid: !pilot.behaviorErrors?.length,
        classification: classifyCalibrationMedian(medianMs),
        calibrationTargetRecipeHash: dependencies.recipeHash(action.quantity),
        evidence: pilot.evidence,
      };
      attempts.push(attempt);
      action = planCalibration(initialQuantity, attempts);
      await dependencies.writeArtifact(
        "progress",
        artifact(
          action.kind === "complete"
            ? "complete"
            : action.kind.startsWith("fail-")
              ? "failed"
              : action.kind.startsWith("inconclusive-")
                ? "inconclusive"
                : "in-progress",
          "progress",
          action,
        ),
      );
    } catch {
      return await persistTerminal(
        "inconclusive",
        "attempt-processing",
        plannedAction,
        plannedAction.quantity,
      );
    }
  }
  try {
    const selectedQuantity = action.quantity;
    const updated = dependencies.updateManifest(selectedQuantity);
    await dependencies.writeArtifact("environment", artifact("complete", "environment", action));
    await dependencies.writeArtifact("success", {
      ...artifact("complete", "success", action),
      selectedQuantity,
      calibrationTargetRecipeHash: dependencies.recipeHash(selectedQuantity),
    });
    await dependencies.writeArtifact("progress", artifact("complete", "progress", action));
    await dependencies.writeManifest(updated);
    return { status: "complete", exitCode: 0, attempts, action, manifest: updated };
  } catch {
    return await persistTerminal("inconclusive", "success-finalization", action, action.quantity);
  }

  function artifact(
    status: CalibrationWorkflowStatus | "in-progress",
    failureStage: string,
    current: CalibrationPlannerAction,
    failedQuantity?: number,
  ) {
    return {
      schemaVersion: 3,
      kind: "calibration",
      status,
      failureStage,
      reason: "code" in current ? current.code : current.kind,
      fixture: input.fixture,
      adapter: input.adapter,
      legacyRevision: revisions.legacyRevision,
      benchmarkScriptRevision: revisions.benchmarkScriptRevision,
      initialQuantity,
      attempts: [...attempts],
      action: current,
      failedQuantity,
      failedQuantityRecipeHash:
        failedQuantity === undefined ? undefined : dependencies.recipeHash(failedQuantity),
    };
  }
  async function persistTerminal(
    status: "failed" | "inconclusive",
    failureStage: string,
    current: CalibrationPlannerAction,
    failedQuantity?: number,
  ): Promise<CalibrationWorkflowResult<Manifest>> {
    try {
      await dependencies.writeArtifact(
        "progress",
        artifact(status, failureStage, current, failedQuantity),
      );
      await dependencies.writeArtifact(
        "failure",
        artifact(status, failureStage, current, failedQuantity),
      );
    } catch {
      /* the result remains deterministic when durable storage is unavailable */
    }
    return terminal(status, failureStage, current);
  }
  function terminal(
    status: "failed" | "inconclusive",
    _stage: string,
    current: CalibrationPlannerAction,
  ): CalibrationWorkflowResult<Manifest> {
    return { status, exitCode: 2, attempts, action: current };
  }
}
