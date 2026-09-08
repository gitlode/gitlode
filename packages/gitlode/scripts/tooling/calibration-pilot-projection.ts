/** Converts completed production child runs into artifact-safe calibration pilot evidence. */
export function projectCalibrationPilot<
  Run extends {
    readonly phase: "warmup" | "measured";
    readonly elapsedMs: number;
    readonly exit: { readonly code: number | null; readonly signal: string | null };
  },
>(input: {
  readonly runs: readonly Run[];
  readonly artifactRun: (run: Run) => unknown;
  readonly behaviorEvidence: (run: Run) => unknown;
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
      warmupRuns: warmup.map(input.artifactRun),
      measuredRuns: measured.map(input.artifactRun),
      behaviorEvidence: measured.map(input.behaviorEvidence),
    },
  };
}
