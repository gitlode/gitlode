import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  comparePerformanceBehavior,
  performanceBehaviorEvidence,
  type DerivedOutput,
  type PerformanceBehavior,
} from "../test/support/performance-equivalence.js";
import {
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../test/support/performance-fixtures.js";
import {
  calibrationComplete,
  calibrationTargetRecipeHash,
  canonicalManifest,
  environmentCompatibility,
  evaluateComparison,
  fingerprint,
  fixtureRecipeHash,
  launchMeasuredChild,
  median,
  nextCalibrationQuantity,
  pairPlan,
  sealedManifestHash,
  type CalibrationTarget,
  type EnvironmentFingerprint,
  type FixtureManifest,
  type FixtureQuantities,
  type ProfileState,
  type RawRun,
} from "../test/support/performance-harness.js";
import {
  calibrationKey,
  parseAdapter,
  parseComparison,
  parseFixture,
  requireTarget,
  rotationLinesFor,
  validateFixtureManifest,
  type RepositoryFixture,
} from "../test/support/performance-workflow.js";
import { readJsonlArtifacts } from "../test/support/profile-equivalence.js";
import { resolveSourceRevision } from "./source-revision.js";
import { collectAggregationScale } from "./telemetry-aggregation.js";

const exec = promisify(execFile);
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function option(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`missing --${name}`);
  return value;
}
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();

async function main() {
  const mode = process.argv[2];
  if (mode !== "calibrate" && mode !== "capture-legacy" && mode !== "measure")
    throw new Error("mode must be calibrate, capture-legacy, or measure");
  const manifestPath = resolve(
    option("manifest", join(packageDirectory, "test/fixtures/performance/manifest.json")),
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FixtureManifest;
  const matrixErrors = validateFixtureManifest(manifest);
  if (matrixErrors.length) throw new Error(matrixErrors.join("; "));
  const fixture = parseFixture(option("fixture"));
  if (fixture === "aggregation_scale") {
    const scale = manifest.aggregationScale.quantities.scale;
    const output = await collectAggregationScale(scale);
    const artifact = {
      schemaVersion: 2,
      kind: "aggregation-scale",
      fixture,
      scale,
      source: "development-only WorkerTelemetrySession collector",
      evidence: output,
    };
    await mkdir(option("artifacts"), { recursive: true });
    await writeFile(
      join(option("artifacts"), "aggregation-scale.json"),
      `${JSON.stringify(artifact, undefined, 2)}\n`,
    );
    process.stdout.write(`captured aggregation_scale at N=${scale}\n`);
    return;
  }
  const adapter = parseAdapter(option("adapter"));
  const target = requireTarget(manifest, fixture, adapter, mode !== "calibrate");
  const comparison = mode === "measure" ? parseComparison(option("comparison")) : undefined;
  const legacyCli =
    mode !== "measure" || comparison === "disabled_overhead"
      ? resolve(option("baseline-cli"))
      : undefined;
  const legacyRevision =
    mode !== "measure" || comparison === "disabled_overhead"
      ? option("legacy-revision")
      : undefined;
  const targetCli = mode === "measure" ? resolve(option("candidate-cli")) : undefined;
  const candidateRevision = mode === "measure" ? option("candidate-revision") : undefined;
  const artifacts = resolve(option("artifacts", join(packageDirectory, ".benchmark-artifacts")));
  const originalManifest = await readFile(manifestPath);
  if (mode === "calibrate") {
    let quantity = target.quantities.commits;
    let calibrationRuns: readonly RawRun[] = [];
    for (;;) {
      let pilot: Execution;
      try {
        pilot = await executeSingle(
          manifest,
          fixture,
          adapter,
          legacyCli as string,
          "legacy_off",
          quantity,
        );
      } catch (error) {
        await writeWorkflowFailureArtifact(
          artifacts,
          `${calibrationKey(fixture, adapter).replace("/", "-")}-calibration-failure.json`,
          {
            kind: "calibration-failure",
            failureStage: "preparation-or-capture",
            fixture,
            adapter,
            revisions: { baseline: legacyRevision },
            calibrationTargetRecipeHash: calibrationTargetRecipeHash(
              manifest,
              calibrationKey(fixture, adapter),
              { ...target.quantities, commits: quantity },
            ),
            quantities: { ...target.quantities, commits: quantity },
            error,
          },
        );
        throw error;
      }
      try {
        const measured = pilot.baseline.filter((run) => run.phase === "measured");
        const pilotErrors = await validateLegacy(
          pilot,
          { ...target.quantities, commits: quantity },
          fixture,
        );
        if (measured.some((run) => run.exit.code !== 0))
          pilotErrors.push("calibration child failed");
        if (pilotErrors.length) {
          await mkdir(artifacts, { recursive: true });
          await writeFile(
            join(
              artifacts,
              `${calibrationKey(fixture, adapter).replace("/", "-")}-calibration-failure.json`,
            ),
            `${JSON.stringify({ schemaVersion: 2, kind: "calibration-failure", fixture, adapter, legacyRevision, quantities: { ...target.quantities, commits: quantity }, calibrationTargetRecipeHash: calibrationTargetRecipeHash(manifest, calibrationKey(fixture, adapter), { ...target.quantities, commits: quantity }), errors: [...new Set(pilotErrors)], runs: pilot.baseline, behaviorEvidence: pilot.baseline.filter((run) => run.phase === "measured").map((run) => performanceBehaviorEvidence(pilot.behavior.get(run.runId) as PerformanceBehavior, pilot.repositoryPath)) }, undefined, 2)}\n`,
          );
          throw new Error(`calibration behavior validation failed: ${pilotErrors.join("; ")}`);
        }
        const decision = nextCalibrationQuantity(
          quantity,
          median(measured.map((run) => run.elapsedMs)),
        );
        if (decision.complete) {
          calibrationRuns = pilot.baseline;
          break;
        }
        quantity = decision.quantity;
      } finally {
        await pilot.cleanup();
      }
    }
    const key = calibrationKey(fixture, adapter);
    const safeKey = key.replace("/", "-");
    const environmentRef = `${safeKey}-environment.json`;
    const artifactRef = `${safeKey}-calibration.json`;
    const scriptRevision = await resolveSourceRevision(resolve(packageDirectory, "../.."));
    const updated: FixtureManifest = {
      ...manifest,
      calibrationTargets: {
        ...manifest.calibrationTargets,
        [key]: {
          status: "complete",
          quantities: { ...target.quantities, commits: quantity },
          environmentRef,
          artifactRef,
        },
      },
    };
    const targetRecipeHash = calibrationTargetRecipeHash(updated, key);
    const calibrationEnvironment = await makeFingerprint(
      updated,
      adapter,
      "legacy_off",
      legacyRevision as string,
      scriptRevision,
      targetRecipeHash,
    );
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(artifacts, environmentRef),
      `${JSON.stringify(calibrationEnvironment, undefined, 2)}\n`,
    );
    await writeFile(
      join(artifacts, artifactRef),
      `${JSON.stringify({ schemaVersion: 2, fixture, adapter, legacyRevision, benchmarkScriptRevision: scriptRevision, calibrationTargetRecipeHash: targetRecipeHash, sealedManifestHash: sealedManifestHash(updated), quantities: { ...target.quantities, commits: quantity }, environmentRef, runs: calibrationRuns }, undefined, 2)}\n`,
    );
    await writeFile(manifestPath, canonicalManifest(updated));
    process.stdout.write(`calibrated ${key}; allComplete=${calibrationComplete(updated)}\n`);
    return;
  }
  const benchmarkScriptRevision = await resolveSourceRevision(resolve(packageDirectory, "../.."));
  const baselineSpec =
    mode === "capture-legacy"
      ? {
          cli: legacyCli as string,
          state: "legacy_off" as const,
          revision: legacyRevision as string,
        }
      : comparison === "disabled_overhead"
        ? {
            cli: legacyCli as string,
            state: "legacy_off" as const,
            revision: legacyRevision as string,
          }
        : {
            cli: targetCli as string,
            state: "target_off" as const,
            revision: candidateRevision as string,
          };
  const candidate =
    mode === "measure"
      ? {
          cli: targetCli as string,
          state:
            comparison === "disabled_overhead" ? ("target_off" as const) : ("target_on" as const),
          revision: candidateRevision as string,
        }
      : undefined;
  let workflow: Execution;
  try {
    workflow = await executePaired(manifest, fixture, adapter, baselineSpec, candidate);
  } catch (error) {
    await writeWorkflowFailureArtifact(artifacts, `${fixture}-${adapter}-${mode}.json`, {
      kind: mode === "capture-legacy" ? "legacy-baseline-failure" : "comparison-failure",
      failureStage: "preparation-or-capture",
      fixture,
      adapter,
      comparison,
      revisions: { baseline: baselineSpec.revision, candidate: candidate?.revision },
      calibrationTargetRecipeHash: calibrationTargetRecipeHash(
        manifest,
        calibrationKey(fixture, adapter),
      ),
      sealedManifestHash: sealedManifestHash(manifest),
      expectedQuantities: target.quantities,
      runs: { baseline: [], candidate: [] },
      error,
    });
    process.exitCode = 2;
    return;
  }
  try {
    const formalTargetRecipeHash = calibrationTargetRecipeHash(
      manifest,
      calibrationKey(fixture, adapter),
    );
    const environment = await makeFingerprint(
      manifest,
      adapter,
      baselineSpec.state,
      baselineSpec.revision,
      benchmarkScriptRevision,
      formalTargetRecipeHash,
    );
    const candidateEnvironment = candidate
      ? await makeFingerprint(
          manifest,
          adapter,
          candidate.state,
          candidate.revision,
          benchmarkScriptRevision,
          formalTargetRecipeHash,
        )
      : undefined;
    const behaviorErrors = candidate
      ? await compareAll(workflow, target.quantities, fixture)
      : await validateLegacy(workflow, target.quantities, fixture);
    const evaluation = candidate
      ? evaluateComparison({
          kind: comparison as "disabled_overhead" | "profile_overhead",
          baseline: workflow.baseline.filter((r) => r.phase === "measured"),
          candidate: workflow.candidate.filter((r) => r.phase === "measured"),
          environmentErrors: environmentCompatibility(
            environment,
            candidateEnvironment as EnvironmentFingerprint,
          ),
          behavioralErrors: behaviorErrors,
        })
      : undefined;
    const measuredEvidence = workflow.baseline
      .filter((run) => run.phase === "measured")
      .map((run) =>
        performanceBehaviorEvidence(
          workflow.behavior.get(run.runId) as PerformanceBehavior,
          workflow.repositoryPath,
        ),
      );
    const artifact = {
      schemaVersion: 2,
      kind: mode === "capture-legacy" ? "legacy-baseline" : "comparison",
      fixture,
      adapter,
      manifest,
      calibrationTargetRecipeHash: calibrationTargetRecipeHash(
        manifest,
        calibrationKey(fixture, adapter),
      ),
      sealedManifestHash: sealedManifestHash(manifest),
      calibrationProvenance: target,
      comparison,
      revisions: {
        baseline: baselineSpec.revision,
        candidate: candidate?.revision,
        benchmarkScript: benchmarkScriptRevision,
      },
      environment: { baseline: environment, candidate: candidateEnvironment },
      pairOrder: pairPlan(),
      behavioralValidation: { passed: behaviorErrors.length === 0, errors: behaviorErrors },
      failureStage: behaviorErrors.length ? "behavior-validation" : undefined,
      behaviorEvidence: {
        baseline: measuredEvidence,
        candidate: candidate
          ? workflow.candidate
              .filter((run) => run.phase === "measured")
              .map((run) =>
                performanceBehaviorEvidence(
                  workflow.behavior.get(run.runId) as PerformanceBehavior,
                  workflow.repositoryPath,
                ),
              )
          : undefined,
      },
      expectedQuantities: target.quantities,
      runs: { baseline: workflow.baseline, candidate: candidate ? workflow.candidate : undefined },
      evaluation,
    };
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(artifacts, `${fixture}-${adapter}-${mode}.json`),
      `${JSON.stringify(artifact, undefined, 2)}\n`,
    );
    if (!Buffer.from(await readFile(manifestPath)).equals(originalManifest))
      throw new Error("formal workflow changed manifest");
    if (behaviorErrors.length || (evaluation && evaluation.status !== "pass")) process.exitCode = 2;
  } finally {
    await workflow.cleanup();
  }
}

async function writeWorkflowFailureArtifact(
  directory: string,
  name: string,
  value: Record<string, unknown>,
) {
  await mkdir(directory, { recursive: true });
  const error = value.error;
  await writeFile(
    join(directory, name),
    `${JSON.stringify({ schemaVersion: 2, ...value, error: error instanceof Error ? error.message : String(error) }, undefined, 2)}\n`,
  );
}

async function makeFingerprint(
  manifest: FixtureManifest,
  adapter: "isomorphic-git" | "git-cli",
  state: ProfileState,
  revision: string,
  script: string,
  recipeHash = fixtureRecipeHash(manifest),
) {
  return await fingerprint({
    npmVersion: (await exec("npm", ["--version"])).stdout.trim(),
    gitVersion: (await exec("git", ["--version"])).stdout.trim(),
    gitAdapter: adapter,
    buildMode: "release-bundled",
    repositoryRevision: revision,
    calibrationTargetRecipeHash: recipeHash,
    sealedManifestHash: sealedManifestHash(manifest),
    benchmarkScriptRevision: script,
    profileState: state,
    warmupCount: 2,
    measuredPairCount: 7,
  });
}
type Execution = {
  baseline: RawRun[];
  candidate: RawRun[];
  behavior: Map<string, PerformanceBehavior>;
  repositoryPath: string;
  cleanup(): Promise<void>;
};
async function executePaired(
  manifest: FixtureManifest,
  fixture: RepositoryFixture,
  adapter: "isomorphic-git" | "git-cli",
  baselineSpec: { cli: string; state: ProfileState; revision: string },
  candidate?: { cli: string; state: ProfileState; revision: string },
): Promise<Execution> {
  const root = await mkdtemp(join(tmpdir(), "gitlode-performance-"));
  try {
    const repository = join(root, "repository");
    const quantities = requireTarget(manifest, fixture, adapter, true).quantities;
    await createPerformanceRepository(
      repository,
      fixture === "commit_heavy_repository" ? fixture : "file_heavy_repository",
      quantities,
    );
    let config = join(root, "config.json");
    if (fixture === "plugin_heavy_projection")
      config = (await createPluginProjectionFixture(root, quantities)).configPath;
    else
      await writeFile(
        config,
        `${JSON.stringify({ version: 1, runtime: { gitAdapter: adapter } })}\n`,
      );
    const changedFiles =
      fixture === "file_heavy_repository"
        ? (await exec("git", ["-C", repository, "log", "--format=", "--name-only", "main"])).stdout
            .split("\n")
            .filter(Boolean).length
        : 0;
    const rotationLines =
      fixture === "file_heavy_repository"
        ? rotationLinesFor(changedFiles, quantities.rotations)
        : undefined;
    const baseline: RawRun[] = [],
      candidates: RawRun[] = [],
      behavior = new Map<string, PerformanceBehavior>();
    let ordinal = 0;
    for (const planned of pairPlan()) {
      const states = candidate
        ? planned.order === "A-B"
          ? [
              [baselineSpec.state, baselineSpec.cli, baseline],
              [candidate.state, candidate.cli, candidates],
            ]
          : [
              [candidate.state, candidate.cli, candidates],
              [baselineSpec.state, baselineSpec.cli, baseline],
            ]
        : [[baselineSpec.state, baselineSpec.cli, baseline]];
      for (const [state, cli, destination] of states as [ProfileState, string, RawRun[]][]) {
        const output = join(root, `output-${ordinal}`),
          checkpoint = join(root, `state-${ordinal}.json`);
        await mkdir(output);
        const raw = await launchMeasuredChild({
          executable: process.execPath,
          args: [
            cli,
            repository,
            "--ref",
            "main",
            "--output-dir",
            output,
            "--output-prefix",
            "performance",
            "--state",
            checkpoint,
            "--config",
            config,
            ...(fixture !== "commit_heavy_repository" ? ["--per-file"] : []),
            ...(fixture === "file_heavy_repository"
              ? ["--rotate-lines", String(rotationLines), "--max-diff-size", "16"]
              : []),
          ],
          outputDirectory: output,
          state,
          ...planned,
        });
        destination.push(raw);
        behavior.set(raw.runId, await behaviorFor(raw, output, checkpoint));
        ordinal++;
      }
    }
    return {
      baseline,
      candidate: candidates,
      behavior,
      repositoryPath: repository,
      cleanup: async () => {
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
async function executeSingle(
  manifest: FixtureManifest,
  fixture: RepositoryFixture,
  adapter: "isomorphic-git" | "git-cli",
  cli: string,
  state: ProfileState,
  commits: number,
) {
  const key = calibrationKey(fixture, adapter),
    original = manifest.calibrationTargets[key] as CalibrationTarget;
  const temporary = {
    ...manifest,
    calibrationTargets: {
      ...manifest.calibrationTargets,
      [key]: {
        ...original,
        status: "complete" as const,
        quantities: { ...original.quantities, commits },
      },
    },
  };
  const execution = await executePaired(temporary, fixture, adapter, {
    cli,
    state,
    revision: "calibration-pilot",
  });
  return execution;
}
async function behaviorFor(
  run: RawRun,
  output: string,
  checkpointPath: string,
): Promise<PerformanceBehavior> {
  const captureErrors = [...run.captureErrors];
  let jsonl = [] as Awaited<ReturnType<typeof readJsonlArtifacts>>;
  try {
    jsonl = await readJsonlArtifacts(output);
  } catch {
    captureErrors.push("output artifacts are unreadable");
  }
  let checkpoint: unknown = null;
  if (run.exit.code === 0)
    try {
      checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
    } catch {
      captureErrors.push("checkpoint is missing or malformed");
    }
  const derived: DerivedOutput = {
    records: run.records.status === "available" ? run.records.value : 0,
    commits: run.commits.status === "available" ? run.commits.value : 0,
    skippedDiffs: run.skippedDiffs.status === "available" ? run.skippedDiffs.value : 0,
    files: run.outputFiles.length,
    bytes: run.outputBytes,
  };
  if (typeof (checkpoint as { generatedAt?: unknown } | null)?.generatedAt !== "string")
    captureErrors.push("checkpoint generatedAt unavailable");
  return { exit: run.exit, checkpoint, jsonl, derived, captureErrors };
}
function generatedAt(behavior: PerformanceBehavior): string {
  const value = behavior.checkpoint as { generatedAt?: unknown };
  return typeof value?.generatedAt === "string" ? value.generatedAt : "<missing-generatedAt>";
}
async function compareAll(
  workflow: Execution,
  quantities: FixtureQuantities,
  fixture: RepositoryFixture,
) {
  const errors: string[] = [];
  const baseline = workflow.baseline.filter((r) => r.phase === "measured"),
    candidate = workflow.candidate.filter((r) => r.phase === "measured");
  for (let i = 0; i < baseline.length; i++) {
    const baselineRun = baseline[i],
      candidateRun = candidate[i];
    if (!baselineRun || !candidateRun) {
      errors.push("measured pair missing");
      continue;
    }
    const left = workflow.behavior.get(baselineRun.runId),
      right = workflow.behavior.get(candidateRun.runId);
    if (!left || !right) {
      errors.push("measured behavior missing");
      continue;
    }
    errors.push(
      ...fixtureInvariantErrors(fixture, quantities, left),
      ...fixtureInvariantErrors(fixture, quantities, right),
    );
    errors.push(
      ...comparePerformanceBehavior(left, right, {
        repositoryPath: workflow.repositoryPath,
        baselineGeneratedAt: generatedAt(left),
        candidateGeneratedAt: generatedAt(right),
      }),
    );
  }
  return errors;
}
async function validateLegacy(
  workflow: Execution,
  quantities: FixtureQuantities,
  fixture: RepositoryFixture,
) {
  const errors: string[] = [];
  const measured = workflow.baseline.filter((run) => run.phase === "measured");
  if (!measured.length) return ["legacy measured runs are empty"];
  const firstRun = measured[0];
  if (!firstRun) return ["legacy measured runs are empty"];
  const first = workflow.behavior.get(firstRun.runId);
  if (!first || first.derived.records === 0 || first.jsonl.length === 0)
    errors.push("legacy output is empty or unavailable");
  for (const run of measured) {
    const behavior = workflow.behavior.get(run.runId);
    if (!behavior || run.exit.code !== 0) {
      errors.push("legacy child process failure");
      continue;
    }
    if (
      (behavior.checkpoint as { repositoryPath?: unknown } | null)?.repositoryPath !==
      workflow.repositoryPath
    )
      errors.push("checkpoint repositoryPath differs from harness repository");
    errors.push(...fixtureInvariantErrors(fixture, quantities, behavior));
    if (first && behavior !== first)
      errors.push(
        ...comparePerformanceBehavior(first, behavior, {
          repositoryPath: workflow.repositoryPath,
          baselineGeneratedAt: generatedAt(first),
          candidateGeneratedAt: generatedAt(behavior),
        }),
      );
  }
  return [...new Set(errors)];
}
export function fixtureInvariantErrors(
  fixture: RepositoryFixture,
  quantities: FixtureQuantities,
  behavior: PerformanceBehavior,
): string[] {
  const errors: string[] = [];
  errors.push(...behavior.captureErrors);
  if (behavior.derived.commits !== quantities.commits)
    errors.push(`fixture commit count differs: expected ${quantities.commits}`);
  if (fixture === "commit_heavy_repository" && behavior.derived.records !== quantities.commits)
    errors.push("commit-heavy record count differs from final commit count");
  if (fixture === "file_heavy_repository") {
    if (behavior.derived.files !== quantities.rotations)
      errors.push(`file-heavy rotation count differs: expected ${quantities.rotations}`);
    if (behavior.derived.skippedDiffs < 1)
      errors.push("file-heavy required size skip was not observed");
  }
  if (fixture === "plugin_heavy_projection") {
    if (behavior.captureErrors.includes("unreadable JSONL record"))
      errors.push("plugin-heavy JSONL record is malformed");
    const values: { extensions?: Record<string, unknown> }[] = [];
    for (const { bytes } of behavior.jsonl)
      for (const line of new TextDecoder().decode(bytes).split("\n").filter(Boolean))
        try {
          values.push(JSON.parse(line) as { extensions?: Record<string, unknown> });
        } catch {
          errors.push("plugin-heavy JSONL record is malformed");
        }
    if (
      values.some(({ extensions }) => Object.keys(extensions ?? {}).length !== quantities.plugins)
    )
      errors.push("plugin-heavy namespace count differs");
    const projected = values.flatMap(({ extensions }) => Object.values(extensions ?? {}));
    if (!projected.some((value) => value === null) || !projected.some((value) => value !== null))
      errors.push("plugin-heavy success and skip outcomes were not both observed");
  }
  return errors;
}
