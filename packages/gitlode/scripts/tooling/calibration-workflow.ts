import {
  classifyCalibrationMedian,
  mad,
  median,
  planCalibration,
  type CalibrationPlannerAction,
  type CalibrationPlannerAttempt,
} from "../../test/support/performance-harness.js";

export type CalibrationWorkflowStatus = "complete" | "failed" | "inconclusive";
export type CalibrationFailureReason =
  | "planner-initialization-failed"
  | "revision-resolution-failed"
  | "preparation-or-capture-failed"
  | "attempt-processing-failed"
  | "progress-persistence-failed"
  | "environment-persistence-failed"
  | "success-persistence-failed"
  | "manifest-persistence-failed"
  | CalibrationPlannerAction["code"];
export type CalibrationArtifactAction =
  | CalibrationPlannerAction
  | { readonly kind: "planner-initialization-unavailable" };
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
export type CalibrationFailedPilotEvidence = {
  readonly quantity: number;
  readonly warmupRuns: readonly unknown[];
  readonly measuredRuns: readonly unknown[];
  readonly childValidation: readonly string[];
  readonly behavioralValidation: readonly string[];
  readonly behaviorEvidence: readonly unknown[];
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
  readonly action: CalibrationArtifactAction;
  /** Omitted only before a quantity can be safely determined. */
  readonly calibrationTargetRecipeHash?: string;
};
export type CalibrationProgressArtifact = ArtifactBase & {
  readonly kind: "calibration-progress";
  readonly status: "in-progress" | "complete" | "failed" | "inconclusive";
};
export type CalibrationFailureArtifact = ArtifactBase & {
  readonly kind: "calibration-failure";
  readonly status: "fail" | "inconclusive";
  readonly failureStage: string;
  readonly reason: CalibrationFailureReason;
  readonly failedQuantity?: number;
  readonly failedQuantityRecipeHash?: string;
  readonly failedPilotEvidence?: CalibrationFailedPilotEvidence;
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
  readonly action: CalibrationArtifactAction;
  readonly manifest?: Manifest;
};

/** Production calibration orchestration. Raw failures never become artifact metadata. */
export async function runCalibrationWorkflow<Manifest>(
  input: CalibrationWorkflowInput<Manifest>,
): Promise<CalibrationWorkflowResult<Manifest>> {
  const { dependencies, initialQuantity } = input;
  const attempts: CalibrationWorkflowAttempt[] = [];
  let action: CalibrationPlannerAction;
  let revisions = { legacyRevision: "unavailable", benchmarkScriptRevision: "unavailable" };
  try {
    action = planCalibration(initialQuantity, []);
  } catch {
    return persistTerminal(
      "inconclusive",
      "planner-initialization",
      "planner-initialization-failed",
      { kind: "planner-initialization-unavailable" },
    );
  }
  try {
    revisions = await dependencies.revisions();
  } catch {
    return persistTerminal(
      "inconclusive",
      "revision-resolution",
      "revision-resolution-failed",
      action,
    );
  }
  for (;;) {
    if (action.kind === "complete") break;
    if (action.kind.startsWith("fail-") || action.kind.startsWith("inconclusive-"))
      return persistTerminal(
        action.kind.startsWith("inconclusive-") ? "inconclusive" : "failed",
        "planner",
        action.code,
        action,
        attempts.at(-1)?.quantity,
      );
    const planned = action;
    let pilot: CalibrationPilot;
    try {
      pilot = await dependencies.executePilot(planned.quantity);
    } catch {
      return persistTerminal(
        "inconclusive",
        "preparation-or-capture",
        "preparation-or-capture-failed",
        planned,
        planned.quantity,
      );
    }
    try {
      if (!pilot.measuredMs.length) throw new Error("empty measured runs");
      const medianMs = median(pilot.measuredMs);
      const madMs = mad(pilot.measuredMs);
      const madRatio = medianMs === 0 ? Number.POSITIVE_INFINITY : madMs / medianMs;
      const childValidation = pilot.childErrors ?? [];
      const behavioralValidation = pilot.behaviorErrors ?? [];
      const candidate: CalibrationWorkflowAttempt = {
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
      };
      const next = planCalibration(initialQuantity, [...attempts, candidate]);
      attempts.push(candidate);
      action = next;
    } catch {
      return persistTerminal(
        "inconclusive",
        "attempt-processing",
        "attempt-processing-failed",
        planned,
        planned.quantity,
        safePilotEvidence(planned.quantity, pilot),
      );
    }
    try {
      await dependencies.writeProgress(progress(statusFor(action), action, planned.quantity));
    } catch {
      return persistTerminal(
        "inconclusive",
        "progress-persistence",
        "progress-persistence-failed",
        action,
        planned.quantity,
      );
    }
  }
  const selectedQuantity = action.quantity;
  const updated = dependencies.updateManifest(selectedQuantity);
  try {
    await dependencies.writeEnvironment(environment(action));
  } catch {
    return persistTerminal(
      "inconclusive",
      "environment-persistence",
      "environment-persistence-failed",
      action,
      selectedQuantity,
    );
  }
  try {
    await dependencies.writeSuccess(success(action));
  } catch {
    return persistTerminal(
      "inconclusive",
      "success-persistence",
      "success-persistence-failed",
      action,
      selectedQuantity,
    );
  }
  try {
    await dependencies.writeProgress(progress("complete", action, selectedQuantity));
  } catch {
    return persistTerminal(
      "inconclusive",
      "progress-persistence",
      "progress-persistence-failed",
      action,
      selectedQuantity,
    );
  }
  try {
    await dependencies.writeManifest(updated);
  } catch {
    return persistTerminal(
      "inconclusive",
      "manifest-persistence",
      "manifest-persistence-failed",
      action,
      selectedQuantity,
    );
  }
  return { status: "complete", exitCode: 0, attempts, action, manifest: updated };

  function base(current: CalibrationArtifactAction, quantity?: number): ArtifactBase {
    return {
      schemaVersion: 3,
      fixture: input.fixture,
      adapter: input.adapter,
      legacyRevision: revisions.legacyRevision,
      benchmarkScriptRevision: revisions.benchmarkScriptRevision,
      initialQuantity,
      attempts: [...attempts],
      action: current,
      calibrationTargetRecipeHash:
        quantity === undefined ? undefined : dependencies.recipeHash(quantity),
    };
  }
  function progress(
    status: CalibrationProgressArtifact["status"],
    current: CalibrationArtifactAction,
    quantity?: number,
  ): CalibrationProgressArtifact {
    return { ...base(current, quantity), kind: "calibration-progress", status };
  }
  function environment(current: CalibrationPlannerAction): CalibrationEnvironmentArtifact {
    return {
      ...base(current, current.quantity),
      kind: "calibration-environment",
      status: "complete",
      selectedQuantity: current.quantity,
    };
  }
  function success(current: CalibrationPlannerAction): CalibrationSuccessArtifact {
    return {
      ...base(current, current.quantity),
      kind: "calibration",
      status: "complete",
      selectedQuantity: current.quantity,
      calibrationTargetRecipeHash: dependencies.recipeHash(current.quantity),
    };
  }
  async function persistTerminal(
    status: "failed" | "inconclusive",
    failureStage: string,
    reason: CalibrationFailureReason,
    current: CalibrationArtifactAction,
    failedQuantity?: number,
    failedPilotEvidence?: CalibrationFailedPilotEvidence,
  ): Promise<CalibrationWorkflowResult<Manifest>> {
    const provenanceQuantity = failedQuantity ?? attempts.at(-1)?.quantity;
    const failure: CalibrationFailureArtifact = {
      ...base(current, provenanceQuantity),
      kind: "calibration-failure",
      status: status === "failed" ? "fail" : "inconclusive",
      failureStage,
      reason,
      ...(provenanceQuantity === undefined
        ? {}
        : {
            failedQuantity: provenanceQuantity,
            failedQuantityRecipeHash: dependencies.recipeHash(provenanceQuantity),
          }),
      ...(failedPilotEvidence === undefined ? {} : { failedPilotEvidence }),
    };
    await dependencies
      .writeProgress(progress(status, current, provenanceQuantity))
      .catch(() => undefined);
    await dependencies.writeFailure(failure).catch(() => undefined);
    return { status, exitCode: 2, attempts, action: current };
  }
  function safePilotEvidence(
    quantity: number,
    pilot: CalibrationPilot,
  ): CalibrationFailedPilotEvidence {
    return {
      quantity,
      warmupRuns: pilot.evidence.warmupRuns,
      measuredRuns: pilot.evidence.measuredRuns,
      childValidation: pilot.childErrors ?? [],
      behavioralValidation: pilot.behaviorErrors ?? [],
      behaviorEvidence: pilot.evidence.behaviorEvidence,
    };
  }
}
function statusFor(action: CalibrationPlannerAction): CalibrationProgressArtifact["status"] {
  if (action.kind === "complete") return "complete";
  if (action.kind.startsWith("fail-")) return "failed";
  if (action.kind.startsWith("inconclusive-")) return "inconclusive";
  return "in-progress";
}
