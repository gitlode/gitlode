import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createPerformanceRepository } from "../test/support/performance-fixtures.js";
import {
  canonicalManifest,
  evaluateComparison,
  fingerprint,
  launchMeasuredChild,
  manifestHash,
  median,
  nextCalibrationQuantity,
  pairPlan,
  verifyMeasuredBehavior,
  type FixtureManifest,
  type ProfileState,
  type RawRun,
} from "../test/support/performance-harness.js";
import { readJsonlArtifacts } from "../test/support/profile-equivalence.js";

const exec = promisify(execFile);
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = join(packageDirectory, "test/fixtures/performance/manifest.json");
function option(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`missing --${name}`);
  return value;
}
const mode = process.argv[2];
if (mode !== "calibrate" && mode !== "measure")
  throw new Error("usage: telemetry-performance.ts <calibrate|measure> [options]");
const manifestPath = resolve(option("manifest", defaultManifest));
const family = option("fixture", "commit_heavy_repository");
const adapter = option("adapter", "isomorphic-git") as "isomorphic-git" | "git-cli";
const baselineCli = resolve(option("baseline-cli", join(packageDirectory, "dist/index.js")));
const candidateCli = resolve(option("candidate-cli", baselineCli));
const artifactsDirectory = resolve(
  option("artifacts", join(packageDirectory, ".benchmark-artifacts")),
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FixtureManifest;
const originalManifestBytes = await readFile(manifestPath);
function fixtureQuantities() {
  const quantities = manifest.fixtures[family];
  if (!quantities) throw new Error(`fixture is absent from manifest: ${family}`);
  return quantities;
}

async function commandVersion(command: string, args: string[]): Promise<string> {
  return (await exec(command, args)).stdout.trim();
}
async function runSet(
  quantity: number,
  cli: string,
  state: ProfileState,
): Promise<{ runs: RawRun[]; repository: string }> {
  const root = await mkdtemp(join(tmpdir(), "gitlode-performance-"));
  const repository = join(root, "repository");
  const quantities = { ...fixtureQuantities(), commits: quantity };
  await createPerformanceRepository(
    repository,
    family as "commit_heavy_repository" | "file_heavy_repository",
    quantities,
  );
  const config = join(root, "config.json");
  await writeFile(config, `${JSON.stringify({ runtime: { gitAdapter: adapter } })}\n`);
  const runs: RawRun[] = [];
  for (const planned of pairPlan()) {
    const output = join(root, `output-${runs.length}`);
    await mkdir(output);
    runs.push(
      await launchMeasuredChild({
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
          "--config",
          config,
          ...(family === "file_heavy_repository"
            ? [
                "--per-file",
                "--rotate-lines",
                String(
                  Math.max(1, Math.ceil(quantities.files / Math.max(1, quantities.rotations))),
                ),
              ]
            : []),
        ],
        outputDirectory: output,
        state,
        ...planned,
      }),
    );
  }
  return { runs, repository };
}
async function runComparison(
  candidateState: ProfileState,
): Promise<{ baseline: RawRun[]; candidate: RawRun[]; repository: string }> {
  const root = await mkdtemp(join(tmpdir(), "gitlode-performance-comparison-"));
  const repository = join(root, "repository");
  const quantities = fixtureQuantities();
  await createPerformanceRepository(
    repository,
    family as "commit_heavy_repository" | "file_heavy_repository",
    quantities,
  );
  const config = join(root, "config.json");
  await writeFile(config, `${JSON.stringify({ runtime: { gitAdapter: adapter } })}\n`);
  const baseline: RawRun[] = [],
    candidate: RawRun[] = [];
  let ordinal = 0;
  for (const planned of pairPlan()) {
    const states =
      planned.order === "A-B"
        ? ([
            ["legacy_off", baselineCli, baseline],
            [candidateState, candidateCli, candidate],
          ] as const)
        : ([
            [candidateState, candidateCli, candidate],
            ["legacy_off", baselineCli, baseline],
          ] as const);
    for (const [state, cli, destination] of states) {
      const output = join(root, `output-${ordinal++}`);
      await mkdir(output);
      destination.push(
        await launchMeasuredChild({
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
            "--config",
            config,
            ...(family === "file_heavy_repository"
              ? [
                  "--per-file",
                  "--rotate-lines",
                  String(
                    Math.max(1, Math.ceil(quantities.files / Math.max(1, quantities.rotations))),
                  ),
                ]
              : []),
          ],
          outputDirectory: output,
          state,
          ...planned,
        }),
      );
    }
  }
  return { baseline, candidate, repository };
}

if (mode === "calibrate") {
  let quantity = fixtureQuantities().commits;
  for (;;) {
    const pilot = await runSet(quantity, baselineCli, "legacy_off");
    const measured = pilot.runs.filter((run) => run.phase === "measured");
    if (measured.some((run) => run.exit.code !== 0)) throw new Error("calibration child failed");
    const decision = nextCalibrationQuantity(
      quantity,
      median(measured.map((run) => run.elapsedMs)),
    );
    await rm(dirname(pilot.repository), { recursive: true, force: true });
    if (decision.complete) break;
    quantity = decision.quantity;
  }
  const calibrated: FixtureManifest = {
    ...manifest,
    calibration: { status: "complete" },
    fixtures: {
      ...manifest.fixtures,
      [family]: { ...fixtureQuantities(), commits: quantity },
    },
  };
  await writeFile(manifestPath, canonicalManifest(calibrated));
  process.stdout.write(`calibrated ${family}: commits=${quantity}\n`);
} else {
  const candidateState = option("candidate-state", "target_off") as ProfileState;
  const comparison = await runComparison(candidateState);
  const baselineMeasured = comparison.baseline.filter((run) => run.phase === "measured");
  const candidateMeasured = comparison.candidate.filter((run) => run.phase === "measured");
  const behavioralErrors: string[] = [];
  for (let index = 0; index < baselineMeasured.length; index++) {
    const left = baselineMeasured[index],
      right = candidateMeasured[index];
    if (!left || !right) throw new Error(`measured pair ${index} is incomplete`);
    behavioralErrors.push(
      ...verifyMeasuredBehavior(
        {
          result: { exit: left.exit },
          checkpoint: null,
          jsonl: await readJsonlArtifacts(left.outputDirectory),
        },
        {
          result: { exit: right.exit },
          checkpoint: null,
          jsonl: await readJsonlArtifacts(right.outputDirectory),
        },
        comparison.repository,
      ),
    );
  }
  const repositoryRoot = resolve(packageDirectory, "../..");
  const repositoryRevision = await commandVersion("git", [
    "-C",
    repositoryRoot,
    "rev-parse",
    "HEAD",
  ]);
  const common = {
    npmVersion: await commandVersion("npm", ["--version"]),
    gitVersion: await commandVersion("git", ["--version"]),
    gitAdapter: adapter,
    buildMode: "release-bundled" as const,
    repositoryRevision,
    fixtureManifestHash: manifestHash(manifest),
    benchmarkScriptRevision: repositoryRevision,
    warmupCount: 2,
    measuredPairCount: 7,
  };
  const baselineFingerprint = await fingerprint({ ...common, profileState: "legacy_off" });
  const candidateFingerprint = await fingerprint({ ...common, profileState: candidateState });
  const evaluation = evaluateComparison({
    kind: candidateState === "target_on" ? "profile_overhead" : "disabled_overhead",
    baseline: baselineMeasured,
    candidate: candidateMeasured,
    behavioralErrors,
  });
  const artifact = {
    schemaVersion: 1,
    fixture: family,
    adapter,
    fixtureHash: manifestHash(manifest),
    baselineRevision: repositoryRevision,
    frozenBehavioralBaseline: {
      recipeRevision: manifest.recipeRevision,
      manifestHash: manifestHash(manifest),
      expectedQuantities: manifest.fixtures[family],
    },
    pairOrder: pairPlan(),
    environment: { baseline: baselineFingerprint, candidate: candidateFingerprint },
    behavioralEquivalence: { passed: behavioralErrors.length === 0, errors: behavioralErrors },
    runs: { baseline: comparison.baseline, candidate: comparison.candidate },
    evaluation,
  };
  await mkdir(artifactsDirectory, { recursive: true });
  const artifactPath = join(artifactsDirectory, `${family}-${adapter}-${candidateState}.json`);
  await writeFile(artifactPath, `${JSON.stringify(artifact, undefined, 2)}\n`);
  if (!Buffer.from(await readFile(manifestPath)).equals(originalManifestBytes))
    throw new Error("measurement changed the fixture manifest");
  await rm(dirname(comparison.repository), { recursive: true, force: true });
  process.stdout.write(`${artifactPath}\n${evaluation.status}\n`);
}
