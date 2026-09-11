import {
  performanceBehaviorEvidence,
  type PerformanceBehavior,
} from "../../test/support/performance-equivalence.js";
import type { RawRun } from "../../test/support/performance-harness.js";

/** Artifact-safe production RawRun projection. */
export function calibrationArtifactRun(run: RawRun) {
  const { outputDirectory: _outputDirectory, checkpointPath: _checkpointPath, ...safeRun } = run;
  return safeRun;
}

/** Converts completed production child runs to calibration evidence without test callbacks. */
export function projectCalibrationPilot(input: {
  readonly runs: readonly RawRun[];
  readonly behavior: ReadonlyMap<string, PerformanceBehavior>;
  readonly repositoryPath: string;
  readonly behavioralValidation: readonly string[];
}) {
  const warmup = input.runs.filter((run) => run.phase === "warmup");
  const measured = input.runs.filter((run) => run.phase === "measured");
  return {
    measuredMs: measured.map((run) => run.elapsedMs),
    childErrors: measured.some((run) => run.exit.code !== 0 || run.exit.signal !== null)
      ? ["calibration child failed"]
      : [],
    behaviorErrors: [...input.behavioralValidation],
    evidence: {
      warmupRuns: warmup.map(calibrationArtifactRun),
      measuredRuns: measured.map(calibrationArtifactRun),
      behaviorEvidence: measured.map((run) =>
        performanceBehaviorEvidence(
          input.behavior.get(run.runId) as PerformanceBehavior,
          input.repositoryPath,
        ),
      ),
    },
  };
}
