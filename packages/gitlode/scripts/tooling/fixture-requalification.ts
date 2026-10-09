import {
  validateFixtureLinks,
  type FixtureLifecycle,
  type FixtureLink,
  FIXTURE_LIFECYCLE_PROTOCOL,
} from "../../test/support/fixture-lifecycle.js";
import {
  mad,
  median,
  fixtureOperationFor,
  type RawRun,
  type EnvironmentFingerprint,
} from "../../test/support/performance-harness.js";

export type HistoricalSelection = {
  readonly quantity: number;
  readonly calibrationSha256: string;
  readonly manifestSha256: string;
  readonly protocol: string;
  readonly legacyRevision: string;
};

export function validateHistoricalSelection(
  selection: HistoricalSelection,
  quantity: number,
  legacyRevision: string,
): string[] {
  const sha = /^[a-f0-9]{64}$/;
  return !selection ||
    selection.quantity !== quantity ||
    !Number.isSafeInteger(quantity) ||
    quantity < 5 ||
    !sha.test(selection.calibrationSha256) ||
    !sha.test(selection.manifestSha256) ||
    !selection.protocol ||
    selection.protocol === FIXTURE_LIFECYCLE_PROTOCOL ||
    selection.legacyRevision !== legacyRevision ||
    !/^[a-f0-9]{40}$/.test(legacyRevision)
    ? ["historical selection provenance is missing or mismatched"]
    : [];
}

/** Eligibility only: never searches, changes the manifest, retries, or adopts the quantity. */
export function validateRequalification(input: {
  readonly selection: HistoricalSelection;
  readonly quantity: number;
  readonly legacyRevision: string;
  readonly runtimeSha256: string;
  readonly environment: unknown;
  readonly runs: readonly RawRun[];
  readonly behaviorErrors: readonly string[];
  readonly lifecycle: ReturnType<FixtureLifecycle["evidence"]>;
}) {
  const errors = [...input.behaviorErrors];
  const sha = /^[a-f0-9]{64}$/;
  errors.push(
    ...validateHistoricalSelection(input.selection, input.quantity, input.legacyRevision),
  );
  const env = input.environment as Partial<EnvironmentFingerprint> | null;
  if (
    !sha.test(input.runtimeSha256) ||
    !env ||
    !env.os?.name ||
    !env.os.version ||
    !env.architecture ||
    !env.cpu?.model ||
    !(env.cpu.logicalCount > 0) ||
    !(typeof env.totalMemoryBytes === "number" && env.totalMemoryBytes > 0) ||
    !env.nodeVersion ||
    !env.npmVersion ||
    !env.gitVersion ||
    !["isomorphic-git", "git-cli"].includes(env.gitAdapter ?? "") ||
    !["release-bundled", "release-installed"].includes(env.buildMode ?? "") ||
    env.repositoryRevision !== input.legacyRevision ||
    !sha.test(env.calibrationTargetRecipeHash ?? "") ||
    !/^[a-f0-9]{40}$/.test(env.benchmarkScriptRevision ?? "") ||
    env.profileState !== "legacy_off" ||
    env.warmupCount !== 2 ||
    env.measuredPairCount !== 7
  )
    errors.push("new runtime/environment identity is missing or mismatched");
  const warmups = input.runs.filter((run) => run.phase === "warmup");
  const measured = input.runs.filter((run) => run.phase === "measured");
  if (warmups.length !== 2 || measured.length !== 7 || input.runs.length !== 9)
    errors.push("requalification requires exactly two warmups and seven measured children");
  if (
    input.runs.some(
      (run) =>
        run.state !== "legacy_off" ||
        run.exit.code !== 0 ||
        run.exit.signal !== null ||
        run.captureErrors.length,
    )
  )
    errors.push("requalification legacy child validation failed");
  errors.push(
    ...validateFixtureLinks(
      input.runs.map((run): FixtureLink | undefined => run.fixtureLink),
      input.lifecycle,
      input.runs.map((run) => fixtureOperationFor(run, "legacy_off")),
    ),
  );
  const values = measured.map((run) => run.elapsedMs);
  const finite = values.length > 0 && values.every((value) => Number.isFinite(value) && value >= 0);
  const medianMs = finite ? median(values) : undefined;
  const madMs = finite ? mad(values) : undefined;
  if (medianMs === undefined || medianMs < 10_000 || medianMs > 30_000)
    errors.push("requalification median is outside the unchanged window");
  const madRatio =
    medianMs !== undefined && medianMs > 0 && madMs !== undefined ? madMs / medianMs : undefined;
  if (madRatio === undefined || madRatio > 0.05)
    errors.push("requalification wall time is unstable or unavailable");
  return {
    status: errors.length
      ? ("inconclusive" as const)
      : ("eligible-pending-trunk-adoption" as const),
    exitCode: errors.length ? 2 : 0,
    errors: [...new Set(errors)],
    medianMs,
    madMs,
    madRatio,
    renewedMinimality: false,
    runtimeSha256: input.runtimeSha256,
    supervision: "requires-completed-cleanup-confirmed-supervisor-evidence",
  };
}
