import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  calibrationComplete,
  calibrationTargetRecipeHash,
  requiredCalibrationTargets,
  sealedManifestHash,
  validateCalibrationMatrix,
  type FixtureManifest,
  type RawRun,
} from "../support/performance-harness.js";
import {
  calibrationKey,
  parseAdapter,
  parseComparison,
  parseFixture,
  parseState,
  requireTarget,
  rotationLinesFor,
  validateFixtureManifest,
} from "../support/performance-workflow.js";

const quantities = { commits: 5, files: 1, plugins: 0, rotations: 1, scale: 0 };
const quantitiesFor = (key: string) =>
  key.startsWith("plugin_heavy_projection/")
    ? { commits: 5, files: 1, plugins: 2, rotations: 1, scale: 0 }
    : quantities;
const temporary: string[] = [];
afterEach(async () =>
  Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);
const manifest = (status: "complete" | "incomplete"): FixtureManifest => ({
  schemaVersion: 2,
  recipeRevision: "test",
  aggregationScale: {
    status: "fixed-recipe",
    integration: "implemented-target-collector",
    quantities: { scale: 4 },
  },
  calibrationTargets: Object.fromEntries(
    requiredCalibrationTargets.map((key) => [
      key,
      {
        status,
        quantities: quantitiesFor(key),
        ...(status === "incomplete"
          ? { reason: "pending" }
          : { environmentRef: "environment.json", artifactRef: "calibration.json" }),
      },
    ]),
  ) as FixtureManifest["calibrationTargets"],
});
describe("performance workflow routing", () => {
  it("validates fixture, adapter, state and preserves aggregation identity", () => {
    expect(parseFixture("aggregation_scale")).toBe("aggregation_scale");
    expect(parseAdapter("git-cli")).toBe("git-cli");
    expect(parseState("target_on")).toBe("target_on");
    expect(parseComparison("profile_overhead")).toBe("profile_overhead");
    expect(() => parseFixture("unknown")).toThrow();
    expect(() => parseAdapter("unknown")).toThrow();
    expect(() => parseState("legacy_off")).toThrow();
  });
  it("models target calibration independently and rejects incomplete formal measurement", () => {
    expect(calibrationKey("commit_heavy_repository", "isomorphic-git")).toBe(
      "commit_heavy_repository/isomorphic-git",
    );
    expect(calibrationComplete(manifest("complete"))).toBe(true);
    expect(calibrationComplete(manifest("incomplete"))).toBe(false);
    expect(() =>
      requireTarget(manifest("incomplete"), "commit_heavy_repository", "isomorphic-git", true),
    ).toThrow(/completed calibration/);
    expect(
      requireTarget(manifest("complete"), "commit_heavy_repository", "isomorphic-git", true).status,
    ).toBe("complete");
  });
  it("fixes plugin projection routing to isomorphic-git", () => {
    const value = manifest("complete");
    const plugin = {
      ...value,
      calibrationTargets: {
        "plugin_heavy_projection/isomorphic-git": { status: "complete" as const, quantities },
      },
    };
    expect(() => requireTarget(plugin, "plugin_heavy_projection", "git-cli")).toThrow(
      /requires isomorphic-git/,
    );
  });
  it("rejects missing and extra calibration matrix targets", () => {
    const complete = manifest("complete");
    const missing = { ...complete, calibrationTargets: { ...complete.calibrationTargets } };
    delete (missing.calibrationTargets as Record<string, unknown>)[requiredCalibrationTargets[0]];
    expect(calibrationComplete(missing)).toBe(false);
    expect(validateCalibrationMatrix(missing)[0]).toMatch(/missing calibration target/);
    const extra = {
      ...complete,
      calibrationTargets: {
        ...complete.calibrationTargets,
        "plugin_heavy_projection/git-cli": { status: "complete" as const, quantities },
      },
    };
    expect(validateCalibrationMatrix(extra)).toContain(
      "invalid calibration target: plugin_heavy_projection/git-cli",
    );
  });
  it("runs capture-legacy, applies rotation/size options, preserves evidence and manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "performance-workflow-"));
    temporary.push(root);
    const artifacts = join(root, "artifacts"),
      manifestPath = join(root, "manifest.json"),
      cli = join(root, "fake-cli.cjs");
    const complete = manifest("complete");
    complete.calibrationTargets["file_heavy_repository/isomorphic-git"] = {
      status: "complete",
      quantities: { ...quantities, files: 4, rotations: 2 },
      environmentRef: "environment.json",
      artifactRef: "calibration.json",
    };
    await writeFile(manifestPath, `${JSON.stringify(complete, undefined, 2)}\n`);
    const before = await readFile(manifestPath, "utf8");
    await writeFile(
      cli,
      `const fs=require('node:fs'),a=process.argv.slice(2),value=(n)=>a[a.indexOf(n)+1]; if(!a.includes('--rotate-lines')||value('--max-diff-size')!=='16')process.exit(9); const out=value('--output-dir'),repo=a[0],state=value('--state'); fs.mkdirSync(out,{recursive:true}); const rows=Array.from({length:5},(_,i)=>JSON.stringify({oid:String(i),file:{path:String(i),additions:null,deletions:null}})); fs.writeFileSync(out+'/performance-20240101T000000Z-000001.jsonl',rows.slice(0,3).join('\\n')+'\\n'); fs.writeFileSync(out+'/performance-20240101T000000Z-000002.jsonl',rows.slice(3).join('\\n')+'\\n'); fs.writeFileSync(state,JSON.stringify({repositoryPath:repo,generatedAt:'2024-01-01T00:00:00.000Z',refs:[]}));`,
    );
    await mkdir(artifacts);
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    await promisify(execFile)(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
        resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"),
        "capture-legacy",
        "--manifest",
        manifestPath,
        "--fixture",
        "file_heavy_repository",
        "--adapter",
        "isomorphic-git",
        "--baseline-cli",
        cli,
        "--legacy-revision",
        "legacy-test",
        "--artifacts",
        artifacts,
      ],
      { cwd: repositoryRoot, timeout: 30_000 },
    );
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    const artifactText = await readFile(
      join(artifacts, "file_heavy_repository-isomorphic-git-capture-legacy.json"),
      "utf8",
    );
    const artifact = JSON.parse(artifactText);
    expect(artifact.revisions.baseline).toBe("legacy-test");
    expect(artifact.behavioralValidation.passed).toBe(true);
    expect(artifact.behaviorEvidence.baseline[0].derived).toMatchObject({
      files: 2,
      skippedDiffs: 5,
    });
    expect(
      artifact.behaviorEvidence.baseline[0].files.map((file: { name: string }) => file.name),
    ).toEqual(["performance-<session>-000001.jsonl", "performance-<session>-000002.jsonl"]);
  }, 30_000);
  it("saves malformed legacy failure evidence before returning nonzero", async () => {
    const root = await mkdtemp(join(tmpdir(), "performance-empty-"));
    temporary.push(root);
    const artifacts = join(root, "artifacts"),
      manifestPath = join(root, "manifest.json"),
      cli = join(root, "empty-cli.cjs");
    await mkdir(artifacts);
    await writeFile(manifestPath, `${JSON.stringify(manifest("complete"))}\n`);
    await writeFile(
      cli,
      `const fs=require('node:fs'),a=process.argv.slice(2),value=(n)=>a[a.indexOf(n)+1]; fs.writeFileSync(value('--state'),JSON.stringify({repositoryPath:a[0],generatedAt:'2024-01-01T00:00:00.000Z',refs:[]}));`,
    );
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
          resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"),
          "capture-legacy",
          "--manifest",
          manifestPath,
          "--fixture",
          "commit_heavy_repository",
          "--adapter",
          "isomorphic-git",
          "--baseline-cli",
          cli,
          "--legacy-revision",
          "legacy-empty",
          "--artifacts",
          artifacts,
        ],
        { cwd: repositoryRoot, timeout: 30_000 },
      ),
    ).rejects.toMatchObject({ code: 2 });
    const artifact = JSON.parse(
      await readFile(
        join(artifacts, "commit_heavy_repository-isomorphic-git-capture-legacy.json"),
        "utf8",
      ),
    );
    expect(artifact.behavioralValidation).toMatchObject({
      passed: false,
      errors: expect.arrayContaining(["legacy output is empty or unavailable"]),
    });
    expect(artifact.revisions.baseline).toBe("legacy-empty");
  }, 30_000);
  it("structures invalid filename, JSONL, generatedAt, and repository path failures", async () => {
    const root = await mkdtemp(join(tmpdir(), "performance-capture-errors-"));
    temporary.push(root);
    const repositoryRoot = resolve(import.meta.dirname, "../../../.."),
      artifacts = join(root, "artifacts"),
      manifestPath = join(root, "manifest.json"),
      cli = join(root, "bad-cli.cjs");
    await mkdir(artifacts);
    await writeFile(manifestPath, JSON.stringify(manifest("complete")));
    await writeFile(
      cli,
      `const fs=require('node:fs'),a=process.argv.slice(2),value=(n)=>a[a.indexOf(n)+1];fs.writeFileSync(value('--output-dir')+'/invalid.jsonl','{bad json}\\n');fs.writeFileSync(value('--state'),JSON.stringify({repositoryPath:'/wrong'}));`,
    );
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
          resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"),
          "capture-legacy",
          "--manifest",
          manifestPath,
          "--fixture",
          "commit_heavy_repository",
          "--adapter",
          "isomorphic-git",
          "--baseline-cli",
          cli,
          "--legacy-revision",
          "legacy-bad",
          "--artifacts",
          artifacts,
        ],
        { cwd: repositoryRoot, timeout: 30_000 },
      ),
    ).rejects.toMatchObject({ code: 2 });
    const artifact = JSON.parse(
      await readFile(
        join(artifacts, "commit_heavy_repository-isomorphic-git-capture-legacy.json"),
        "utf8",
      ),
    );
    expect(artifact.behavioralValidation.errors).toEqual(
      expect.arrayContaining([
        "unreadable JSONL record",
        "checkpoint generatedAt unavailable",
        "checkpoint repositoryPath differs from harness repository",
      ]),
    );
    expect(artifact.behaviorEvidence.baseline[0].captureErrors).toEqual(
      expect.arrayContaining([
        "unreadable JSONL record",
        "checkpoint generatedAt unavailable",
        "checkpoint repositoryPath differs from harness repository",
        "invalid gitlode output filename: invalid.jsonl",
      ]),
    );
  }, 30_000);
  it("saves plugin malformed JSONL and unreadable output capture failures", async () => {
    const root = await mkdtemp(join(tmpdir(), "performance-plugin-errors-"));
    temporary.push(root);
    const repositoryRoot = resolve(import.meta.dirname, "../../../.."),
      artifacts = join(root, "artifacts"),
      manifestPath = join(root, "manifest.json"),
      cli = join(root, "plugin-bad.cjs");
    await mkdir(artifacts);
    await writeFile(manifestPath, JSON.stringify(manifest("complete")));
    await writeFile(
      cli,
      `const fs=require('node:fs'),a=process.argv.slice(2),value=(n)=>a[a.indexOf(n)+1],out=value('--output-dir');fs.writeFileSync(out+'/performance-20240101T000000Z-000001.jsonl','{bad plugin json}\\n');fs.mkdirSync(out+'/unreadable.jsonl');fs.writeFileSync(value('--state'),JSON.stringify({repositoryPath:a[0],generatedAt:'2024-01-01T00:00:00.000Z'}));`,
    );
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
          resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"),
          "capture-legacy",
          "--manifest",
          manifestPath,
          "--fixture",
          "plugin_heavy_projection",
          "--adapter",
          "isomorphic-git",
          "--baseline-cli",
          cli,
          "--legacy-revision",
          "legacy-plugin-bad",
          "--artifacts",
          artifacts,
        ],
        { cwd: repositoryRoot, timeout: 30_000 },
      ),
    ).rejects.toMatchObject({ code: 2 });
    const artifact = JSON.parse(
      await readFile(
        join(artifacts, "plugin_heavy_projection-isomorphic-git-capture-legacy.json"),
        "utf8",
      ),
    );
    expect(artifact.behavioralValidation.errors).toEqual(
      expect.arrayContaining([
        "unreadable JSONL record",
        "output artifacts are unreadable",
        "plugin-heavy JSONL record is malformed",
      ]),
    );
    expect(artifact.failureStage ?? "behavior-validation").toBe("behavior-validation");
  }, 30_000);
  it("rejects malformed calibrate and incomplete measure commands at script level", async () => {
    const root = await mkdtemp(join(tmpdir(), "performance-command-reject-"));
    temporary.push(root);
    const repositoryRoot = resolve(import.meta.dirname, "../../../.."),
      script = resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"),
      tsx = resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
      malformed = join(root, "malformed.json"),
      incomplete = join(root, "incomplete.json");
    const missing = manifest("complete");
    delete (missing.calibrationTargets as Record<string, unknown>)[requiredCalibrationTargets[0]];
    await writeFile(malformed, JSON.stringify(missing));
    await writeFile(incomplete, JSON.stringify(manifest("incomplete")));
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          tsx,
          script,
          "calibrate",
          "--manifest",
          malformed,
          "--fixture",
          "commit_heavy_repository",
          "--adapter",
          "isomorphic-git",
        ],
        { cwd: repositoryRoot },
      ),
    ).rejects.toMatchObject({ code: 1 });
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          tsx,
          script,
          "measure",
          "--manifest",
          incomplete,
          "--fixture",
          "commit_heavy_repository",
          "--adapter",
          "isomorphic-git",
        ],
        { cwd: repositoryRoot },
      ),
    ).rejects.toMatchObject({ code: 1 });
  });
  it("validates manifest fields and exact rotation recipes across doubled volumes", () => {
    expect(validateFixtureManifest(manifest("complete"))).toEqual([]);
    const malformed = {
      ...manifest("complete"),
      schemaVersion: 1,
      aggregationScale: { status: "wrong" },
    };
    expect(validateFixtureManifest(malformed)).toEqual(
      expect.arrayContaining([
        "manifest schemaVersion must be 2",
        "aggregationScale recipe is invalid",
      ]),
    );
    expect(rotationLinesFor(8, 4)).toBe(2);
    expect(rotationLinesFor(16, 4)).toBe(4);
    expect(() => rotationLinesFor(2, 3)).toThrow(/cannot produce exactly/);
  });
  it("rejects fixture-specific invalid quantities before repository generation", () => {
    const invalid = manifest("complete");
    invalid.calibrationTargets["commit_heavy_repository/isomorphic-git"] = {
      status: "complete",
      quantities: { commits: 4, files: 2, plugins: 1, rotations: 2, scale: 1 },
      environmentRef: "e",
      artifactRef: "a",
    };
    invalid.calibrationTargets["file_heavy_repository/git-cli"] = {
      status: "complete",
      quantities: { commits: 5, files: 0, plugins: 1, rotations: 11, scale: 1 },
      environmentRef: "e",
      artifactRef: "a",
    };
    invalid.calibrationTargets["plugin_heavy_projection/isomorphic-git"] = {
      status: "complete",
      quantities: { commits: 5, files: 0, plugins: 1, rotations: 1, scale: 1 },
      environmentRef: "e",
      artifactRef: "a",
    };
    expect(validateFixtureManifest(invalid)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("commits must be a final total of at least 5"),
        expect.stringContaining("commit-heavy files and rotations must be 1"),
        expect.stringContaining("file-heavy files and rotations must be positive"),
        expect.stringContaining("file-heavy rotations exceed"),
        expect.stringContaining("plugin-heavy requires files and at least two plugins"),
      ]),
    );
  });
  it("keeps target calibration hashes verifiable across sequential target updates", () => {
    const initial = manifest("incomplete"),
      key = requiredCalibrationTargets[0];
    const firstHash = calibrationTargetRecipeHash(initial, key);
    const later = {
      ...initial,
      calibrationTargets: {
        ...initial.calibrationTargets,
        [requiredCalibrationTargets[1]]: {
          ...initial.calibrationTargets[requiredCalibrationTargets[1]]!,
          quantities: { ...quantities, commits: 20 },
        },
      },
    };
    expect(calibrationTargetRecipeHash(later, key)).toBe(firstHash);
    expect(calibrationTargetRecipeHash(later, requiredCalibrationTargets[1])).not.toBe(
      calibrationTargetRecipeHash(initial, requiredCalibrationTargets[1]),
    );
    expect(sealedManifestHash(initial)).toBeUndefined();
    expect(sealedManifestHash(manifest("complete"))).toMatch(/^[0-9a-f]{64}$/);
  });
  it("executes disabled and profile comparison matrices with matching profile flags and states", async () => {
    const root = await mkdtemp(join(tmpdir(), "performance-comparisons-"));
    temporary.push(root);
    const repositoryRoot = resolve(import.meta.dirname, "../../../.."),
      script = resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"),
      tsx = resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
      manifestPath = join(root, "manifest.json"),
      cli = join(root, "fake-cli.cjs"),
      log = join(root, "flags.log"),
      artifacts = join(root, "artifacts");
    await mkdir(artifacts);
    await writeFile(manifestPath, JSON.stringify(manifest("complete")));
    await writeFile(
      cli,
      `const fs=require('node:fs'),a=process.argv.slice(2),value=(n)=>a[a.indexOf(n)+1];fs.appendFileSync(process.env.PERF_LOG,a.includes('--profile')?'on\\n':'off\\n');const out=value('--output-dir'),state=value('--state');fs.writeFileSync(out+'/performance-20240101T000000Z-000001.jsonl',Array.from({length:5},(_,i)=>JSON.stringify({oid:String(i)})).join('\\n')+'\\n');fs.writeFileSync(state,JSON.stringify({repositoryPath:a[0],generatedAt:'2024-01-01T00:00:00.000Z',refs:[]}));`,
    );
    const common = [
      tsx,
      script,
      "measure",
      "--manifest",
      manifestPath,
      "--fixture",
      "commit_heavy_repository",
      "--adapter",
      "isomorphic-git",
      "--candidate-cli",
      cli,
      "--candidate-revision",
      "target-rev",
      "--artifacts",
      artifacts,
    ];
    await expect(
      promisify(execFile)(
        process.execPath,
        [
          ...common,
          "--comparison",
          "disabled_overhead",
          "--baseline-cli",
          cli,
          "--legacy-revision",
          "legacy-rev",
        ],
        { cwd: repositoryRoot, env: { ...process.env, PERF_LOG: log }, timeout: 30_000 },
      ),
    ).rejects.toMatchObject({ code: 2 });
    const disabled = JSON.parse(
      await readFile(
        join(artifacts, "commit_heavy_repository-isomorphic-git-measure.json"),
        "utf8",
      ),
    );
    expect(disabled.comparison).toBe("disabled_overhead");
    expect(new Set(disabled.runs.baseline.map((run: RawRun) => run.state))).toEqual(
      new Set(["legacy_off"]),
    );
    expect(new Set(disabled.runs.candidate.map((run: RawRun) => run.state))).toEqual(
      new Set(["target_off"]),
    );
    await writeFile(log, "");
    await expect(
      promisify(execFile)(process.execPath, [...common, "--comparison", "profile_overhead"], {
        cwd: repositoryRoot,
        env: { ...process.env, PERF_LOG: log },
        timeout: 30_000,
      }),
    ).rejects.toMatchObject({ code: 2 });
    const profile = JSON.parse(
      await readFile(
        join(artifacts, "commit_heavy_repository-isomorphic-git-measure.json"),
        "utf8",
      ),
    );
    expect(new Set(profile.runs.baseline.map((run: RawRun) => run.state))).toEqual(
      new Set(["target_off"]),
    );
    expect(new Set(profile.runs.candidate.map((run: RawRun) => run.state))).toEqual(
      new Set(["target_on"]),
    );
    const flags = (await readFile(log, "utf8")).trim().split("\n");
    expect(flags.filter((flag) => flag === "off")).toHaveLength(9);
    expect(flags.filter((flag) => flag === "on")).toHaveLength(9);
    expect(profile.behaviorEvidence.baseline).toHaveLength(7);
    expect(profile.behaviorEvidence.candidate).toHaveLength(7);
    expect(profile.formalEvaluation.behavior.reasons).toEqual([]);
    expect(profile.formalEvaluation.sidecar.status).toBe("inconclusive");
    expect(profile.sidecarEvaluation.status).toBe("inconclusive");
    expect(profile.formalEvaluation.status).toBe(profile.sidecarEvaluation.status);
    expect(profile.sidecars.candidate).toHaveLength(9);
    expect(
      profile.sidecars.candidate.every(
        (sidecar: { provenance: { runId: string } }, index: number) =>
          sidecar.provenance.runId === profile.runs.candidate[index].runId,
      ),
    ).toBe(true);
    expect(
      profile.sidecars.candidate.every(
        (sidecar: { isolationEvidence: Record<string, boolean> }) =>
          sidecar.isolationEvidence.outputPathsDiffer &&
          sidecar.isolationEvidence.checkpointPathsDiffer &&
          sidecar.isolationEvidence.crossPathsDiffer,
      ),
    ).toBe(true);
    expect(JSON.stringify(profile)).not.toContain("gitlode-performance-");
    expect(JSON.stringify(profile)).not.toContain("gitlode-profile-sidecar-");
  }, 30_000);
});
