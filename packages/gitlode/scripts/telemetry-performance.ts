import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  comparePerformanceBehavior,
  type DerivedOutput,
  type PerformanceBehavior,
} from "../test/support/performance-equivalence.js";
import {
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../test/support/performance-fixtures.js";
import {
  calibrationComplete,
  canonicalManifest,
  environmentCompatibility,
  evaluateComparison,
  fingerprint,
  launchMeasuredChild,
  manifestHash,
  median,
  nextCalibrationQuantity,
  pairPlan,
  type CalibrationTarget,
  type EnvironmentFingerprint,
  type FixtureManifest,
  type ProfileState,
  type RawRun,
} from "../test/support/performance-harness.js";
import {
  calibrationKey,
  parseAdapter,
  parseFixture,
  parseState,
  requireTarget,
  type RepositoryFixture,
} from "../test/support/performance-workflow.js";
import { readJsonlArtifacts } from "../test/support/profile-equivalence.js";

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
  const fixture = parseFixture(option("fixture"));
  if (fixture === "aggregation_scale")
    throw new Error(
      "aggregation_scale is a fixed recipe pending the T13 target collector child runner; repository measurement is unavailable",
    );
  const adapter = parseAdapter(option("adapter"));
  const target = requireTarget(manifest, fixture, adapter, mode !== "calibrate");
  const cli = resolve(option("baseline-cli"));
  const legacyRevision = option("legacy-revision");
  const candidateState = mode === "measure" ? parseState(option("candidate-state")) : undefined;
  const candidateCli = mode === "measure" ? resolve(option("candidate-cli")) : undefined;
  const candidateRevision = mode === "measure" ? option("candidate-revision") : undefined;
  const artifacts = resolve(option("artifacts", join(packageDirectory, ".benchmark-artifacts")));
  const originalManifest = await readFile(manifestPath);
  if (mode === "calibrate") {
    let quantity = target.quantities.commits;
    let calibrationRuns: readonly RawRun[] = [];
    for (;;) {
      const pilot = await executeSingle(manifest, fixture, adapter, cli, "legacy_off", quantity);
      try {
        const measured = pilot.runs.filter((run) => run.phase === "measured");
        if (measured.some((run) => run.exit.code !== 0))
          throw new Error("calibration child failed");
        const decision = nextCalibrationQuantity(
          quantity,
          median(measured.map((run) => run.elapsedMs)),
        );
        if (decision.complete) {
          calibrationRuns = pilot.runs;
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
    const scriptRevision = (
      await exec("git", ["-C", resolve(packageDirectory, "../.."), "rev-parse", "HEAD"])
    ).stdout.trim();
    const calibrationEnvironment = await makeFingerprint(
      manifest,
      adapter,
      "legacy_off",
      legacyRevision,
      scriptRevision,
    );
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(artifacts, environmentRef),
      `${JSON.stringify(calibrationEnvironment, undefined, 2)}\n`,
    );
    await writeFile(
      join(artifacts, artifactRef),
      `${JSON.stringify({ schemaVersion: 1, fixture, adapter, legacyRevision, benchmarkScriptRevision: scriptRevision, quantities: { ...target.quantities, commits: quantity }, runs: calibrationRuns }, undefined, 2)}\n`,
    );
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
      fixtures: { ...manifest.fixtures, [fixture]: { ...target.quantities, commits: quantity } },
    };
    await writeFile(manifestPath, canonicalManifest(updated));
    process.stdout.write(`calibrated ${key}; allComplete=${calibrationComplete(updated)}\n`);
    return;
  }
  const benchmarkScriptRevision = (
    await exec("git", ["-C", resolve(packageDirectory, "../.."), "rev-parse", "HEAD"])
  ).stdout.trim();
  const candidate =
    mode === "measure"
      ? {
          cli: candidateCli as string,
          state: candidateState as ProfileState,
          revision: candidateRevision as string,
        }
      : undefined;
  const workflow = await executePaired(manifest, fixture, adapter, cli, candidate);
  try {
    const environment = await makeFingerprint(
      manifest,
      adapter,
      "legacy_off",
      legacyRevision,
      benchmarkScriptRevision,
    );
    const candidateEnvironment = candidate
      ? await makeFingerprint(
          manifest,
          adapter,
          candidate.state,
          candidate.revision,
          benchmarkScriptRevision,
        )
      : undefined;
    const behaviorErrors = candidate ? await compareAll(workflow) : await validateLegacy(workflow);
    const evaluation = candidate
      ? evaluateComparison({
          kind: candidate.state === "target_on" ? "profile_overhead" : "disabled_overhead",
          baseline: workflow.baseline.filter((r) => r.phase === "measured"),
          candidate: workflow.candidate.filter((r) => r.phase === "measured"),
          environmentErrors: environmentCompatibility(
            environment,
            candidateEnvironment as EnvironmentFingerprint,
          ),
          behavioralErrors: behaviorErrors,
        })
      : undefined;
    const artifact = {
      schemaVersion: 1,
      kind: mode === "capture-legacy" ? "legacy-baseline" : "comparison",
      fixture,
      adapter,
      manifest,
      fixtureHash: manifestHash(manifest),
      calibrationProvenance: target,
      revisions: {
        legacy: legacyRevision,
        candidate: candidate?.revision,
        benchmarkScript: benchmarkScriptRevision,
      },
      environment: { baseline: environment, candidate: candidateEnvironment },
      pairOrder: pairPlan(),
      behavioralValidation: { passed: behaviorErrors.length === 0, errors: behaviorErrors },
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

async function makeFingerprint(
  manifest: FixtureManifest,
  adapter: "isomorphic-git" | "git-cli",
  state: ProfileState,
  revision: string,
  script: string,
) {
  return await fingerprint({
    npmVersion: (await exec("npm", ["--version"])).stdout.trim(),
    gitVersion: (await exec("git", ["--version"])).stdout.trim(),
    gitAdapter: adapter,
    buildMode: "release-bundled",
    repositoryRevision: revision,
    fixtureManifestHash: manifestHash(manifest),
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
  cleanup(): Promise<void>;
};
async function executePaired(
  manifest: FixtureManifest,
  fixture: RepositoryFixture,
  adapter: "isomorphic-git" | "git-cli",
  baselineCli: string,
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
    const baseline: RawRun[] = [],
      candidates: RawRun[] = [],
      behavior = new Map<string, PerformanceBehavior>();
    let ordinal = 0;
    for (const planned of pairPlan()) {
      const states = candidate
        ? planned.order === "A-B"
          ? [
              ["legacy_off", baselineCli, baseline],
              [candidate.state, candidate.cli, candidates],
            ]
          : [
              [candidate.state, candidate.cli, candidates],
              ["legacy_off", baselineCli, baseline],
            ]
        : [["legacy_off", baselineCli, baseline]];
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
  const execution = await executePaired(temporary, fixture, adapter, cli);
  return { runs: execution.baseline, cleanup: execution.cleanup };
}
async function behaviorFor(
  run: RawRun,
  output: string,
  checkpointPath: string,
): Promise<PerformanceBehavior> {
  const jsonl = await readJsonlArtifacts(output);
  const checkpoint =
    run.exit.code === 0 ? JSON.parse(await readFile(checkpointPath, "utf8")) : null;
  const derived: DerivedOutput = {
    records: run.records.status === "available" ? run.records.value : 0,
    commits: run.commits.status === "available" ? run.commits.value : 0,
    skippedDiffs: run.skippedDiffs.status === "available" ? run.skippedDiffs.value : 0,
    files: run.outputFiles.length,
    bytes: run.outputBytes,
  };
  return { exit: run.exit, checkpoint, jsonl, derived };
}
function generatedAt(behavior: PerformanceBehavior): string {
  const value = behavior.checkpoint as { generatedAt?: unknown };
  if (typeof value?.generatedAt !== "string") throw new Error("checkpoint generatedAt unavailable");
  return value.generatedAt;
}
async function compareAll(workflow: Execution) {
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
      ...comparePerformanceBehavior(left, right, {
        repositoryPath: (left.checkpoint as { repositoryPath: string }).repositoryPath,
        baselineGeneratedAt: generatedAt(left),
        candidateGeneratedAt: generatedAt(right),
      }),
    );
  }
  return errors;
}
async function validateLegacy(workflow: Execution) {
  return workflow.baseline.some((run) => run.exit.code !== 0)
    ? ["legacy child process failure"]
    : [];
}
