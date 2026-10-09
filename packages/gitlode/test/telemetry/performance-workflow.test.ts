import { execFile } from "node:child_process";
import { writeSync } from "node:fs";
import { cp, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { FIXTURE_LIFECYCLE_PROTOCOL, validateFixtureLinks } from "../support/fixture-lifecycle.js";
import {
  calibrationComplete,
  calibrationTargetRecipeHash,
  requiredCalibrationTargets,
  sealedManifestHash,
  validateCalibrationMatrix,
  type FixtureManifest,
  type CalibrationTarget,
  type RawRun,
  fixtureOperationFor,
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
// Test-local seam: never enqueue a stream error or let reporting replace the failure.
function rethrowWorkflowFailure(
  error: unknown,
  locations: { root: string; outside: string },
  write: (fd: number, message: string) => number = writeSync,
): never {
  try {
    write(2, "Retained supervised workflow diagnostics: " + JSON.stringify(locations) + "\n");
  } catch {
    // Unavailable stderr can leave retained locations unannounced.
  }
  throw error;
}
afterEach(async () =>
  Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);
const manifest = (
  status: "complete" | "incomplete",
): Omit<FixtureManifest, "calibrationTargets"> & {
  calibrationTargets: Record<string, CalibrationTarget>;
} => ({
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
        fixtureLifecycleProtocol: FIXTURE_LIFECYCLE_PROTOCOL,
        quantities: quantitiesFor(key),
        ...(status === "incomplete"
          ? { reason: "pending" }
          : { environmentRef: "environment.json", artifactRef: "calibration.json" }),
      },
    ]),
  ) as Record<string, CalibrationTarget>,
});
describe("C3 workflow primary failure", () => {
  it.each([
    "usable",
    "lifecycle-unavailable",
    "all-unavailable",
    "secondary-cleanup",
    "notification",
  ])(
    "preserves final-boundary cause: %s",
    async (mode) => {
      const unavailable = mode === "lifecycle-unavailable" || mode === "all-unavailable";
      const root = await mkdtemp(join(tmpdir(), "gitlode-c3-"));
      temporary.push(root);
      const repositoryRoot = resolve(import.meta.dirname, "../../../..");
      const artifacts = join(root, "artifacts"),
        cli = join(root, "cli.cjs"),
        manifestPath = join(root, "manifest.json");
      await mkdir(artifacts);
      await writeFile(manifestPath, JSON.stringify(manifest("complete")));
      await writeFile(
        cli,
        `const fs=require('node:fs'),a=process.argv.slice(2),v=n=>a[a.indexOf(n)+1];fs.writeFileSync(v('--output-dir')+'/performance-20240101T000000Z-000001.jsonl','{}\\n');fs.writeFileSync(v('--state'),JSON.stringify({repositoryPath:a[0],generatedAt:'2024-01-01T00:00:00.000Z',refs:[]}));`,
      );
      const selection = join(root, "selection.json");
      await writeFile(
        selection,
        JSON.stringify({
          quantity: 5,
          calibrationSha256: "a".repeat(64),
          manifestSha256: "b".repeat(64),
          protocol: "historical",
          legacyRevision: "c".repeat(40),
        }),
      );
      const wrapper = join(
        repositoryRoot,
        "packages/gitlode/test",
        `c3-hook-${Date.now()}-${mode}.mts`,
      );
      try {
        await writeFile(
          wrapper,
          `import {FixtureLifecycle} from './support/fixture-lifecycle.ts';
import {writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const boundary=FixtureLifecycle.prototype.boundary;let finals=0,primaryError;
FixtureLifecycle.prototype.boundary=async function(label){if(label==='final-pre-destruction'){finals++;await writeFile(join(this.repository,'.git/index.lock'),'C3');${unavailable ? "await rm(this.evidenceDirectory,{recursive:true,force:true});await writeFile(this.evidenceDirectory,'unavailable');" : ""}}
try{return await boundary.call(this,label)}catch(error){primaryError=error;if(label==='final-pre-destruction'){${mode === "all-unavailable" ? `await rm(${JSON.stringify(artifacts)},{recursive:true});await writeFile(${JSON.stringify(artifacts)},'unavailable');` : ""}${mode === "secondary-cleanup" ? `process.env.GITLODE_PERFORMANCE_SUPERVISED='1';Object.defineProperty(process,'connected',{value:true,configurable:true});process.send=()=>{throw new Error('C3 secondary cleanup notification')};` : ""}${mode === "notification" ? `fs.writeSync=()=>{throw new Error('C3 secondary stderr')};syncBuiltinESMExports();` : ""}await writeFile(${JSON.stringify(join(root, "primary.json"))},JSON.stringify({message:error.message,finals,repository:this.repository,evidence:this.evidenceDirectory}));}throw error}};
process.argv[1]=${JSON.stringify(join(repositoryRoot, "packages/gitlode/scripts/telemetry-performance.ts"))};try{await import('../scripts/telemetry-performance.ts')}catch(error){await writeFile(${JSON.stringify(join(root, "identity.json"))},JSON.stringify({same:error===primaryError}));process.exitCode=2;}`,
        );
        const execution = promisify(execFile)(
          process.execPath,
          [
            resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
            wrapper,
            "requalify",
            "--manifest",
            manifestPath,
            "--fixture",
            "commit_heavy_repository",
            "--adapter",
            "isomorphic-git",
            "--baseline-cli",
            cli,
            "--legacy-revision",
            "c".repeat(40),
            "--artifacts",
            artifacts,
            "--historical-selection",
            selection,
          ],
          { cwd: repositoryRoot, timeout: 60_000 },
        );
        await expect(execution).rejects.toMatchObject({ code: 2 });
        if (mode === "all-unavailable") {
          const stderr = await execution.then(
            () => "",
            (error: { stderr: string }) => error.stderr,
          );
          expect(stderr).toContain("fixture writer marker: .git/index.lock");
          expect(stderr).toContain("failure artifact unavailable");
          expect(stderr.length).toBeLessThan(3000);
        }
        const primary = JSON.parse(await readFile(join(root, "primary.json"), "utf8"));
        temporary.push(dirname(primary.repository));
        const failure =
          mode === "all-unavailable"
            ? undefined
            : JSON.parse(
                await readFile(
                  join(
                    artifacts,
                    "commit_heavy_repository-isomorphic-git-requalification-failure.json",
                  ),
                  "utf8",
                ),
              );
        if (failure) expect(failure.error).toBe("fixture writer marker: .git/index.lock");
        else
          expect(JSON.parse(await readFile(join(root, "identity.json"), "utf8")).same).toBe(true);
        if (mode === "secondary-cleanup" || mode === "notification")
          expect(
            JSON.parse(await readFile(join(primary.evidence, "cleanup-failure.json"), "utf8"))
              .cleanupErrors[0],
          ).toContain("C3 secondary");
        expect(primary.finals).toBe(1);
        expect(await readFile(join(primary.repository, ".git/index.lock"), "utf8")).toBe("C3");
        if (!unavailable)
          expect(
            JSON.parse(await readFile(join(primary.evidence, "failure.json"), "utf8")).error,
          ).toBe(failure.error);
      } finally {
        await rm(wrapper, { force: true });
      }
    },
    90_000,
  );
});
describe.skipIf(process.platform !== "linux")("supervised workflow integration", () => {
  it("reports entrypoint setup failures as bounded supervision failures", async () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    const root = await mkdtemp(join(tmpdir(), "gitlode-supervision-entrypoint-"));
    temporary.push(root);
    const artifactFile = join(root, "not-a-directory");
    await writeFile(artifactFile, "occupied");
    const execution = promisify(execFile)(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
        resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance-supervised.ts"),
        "capture-legacy",
        "--artifacts",
        artifactFile,
      ],
      { cwd: repositoryRoot, timeout: 10_000 },
    );
    await expect(execution).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/supervision failed before terminal evidence/),
    });
    try {
      await execution;
    } catch (error) {
      expect(String((error as { stderr?: string }).stderr).length).toBeLessThan(500);
    }
  }, 10_000);
  it.each([false, true])(
    "preserves completed runs when a later child stalls: %s",
    async (stall) => {
      const root = await mkdtemp(join(tmpdir(), "gitlode-supervised-workflow-"));
      // Neither diagnostic location is registered until every assertion succeeds.
      const fixtureParent = join(root, "workflow-temp");
      await mkdir(fixtureParent);
      const outside = await mkdtemp(join(tmpdir(), "gitlode-workflow-sentinel-"));
      try {
        const sentinel = join(outside, "sentinel");
        await writeFile(sentinel, "protected outside fixture");
        const fixtureLog = join(root, "fixture-paths.jsonl");
        const artifacts = join(root, "artifacts");
        const manifestPath = join(root, "manifest.json");
        const cli = join(root, "cli.cjs");
        await writeFile(manifestPath, JSON.stringify(manifest("complete")));
        await writeFile(
          cli,
          `const fs=require('node:fs'),a=process.argv.slice(2),value=n=>a[a.indexOf(n)+1];
const counter=${JSON.stringify(join(root, "counter"))};
fs.appendFileSync(${JSON.stringify(fixtureLog)},JSON.stringify(fs.realpathSync(require('node:path').dirname(value('--output-dir'))))+'\\n');
const count=fs.existsSync(counter)?Number(fs.readFileSync(counter,'utf8'))+1:1;fs.writeFileSync(counter,String(count));
if(${stall} && count===2){setInterval(()=>{},1000)}else{
fs.writeFileSync(value('--output-dir')+'/performance-20240101T000000Z-000001.jsonl',Array.from({length:5},(_,i)=>JSON.stringify({oid:String(i)})).join('\\n')+'\\n');
fs.writeFileSync(value('--state'),JSON.stringify({repositoryPath:a[0],generatedAt:'2024-01-01T00:00:00.000Z',refs:[]}));}`,
        );
        const repositoryRoot = resolve(import.meta.dirname, "../../../..");
        const execution = promisify(execFile)(
          process.execPath,
          [
            resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
            resolve(repositoryRoot, "packages/gitlode/scripts/telemetry-performance-supervised.ts"),
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
            "legacy-test",
            "--artifacts",
            artifacts,
            "--execution-timeout-ms",
            "1000",
          ],
          {
            cwd: repositoryRoot,
            env: { ...process.env, TMPDIR: fixtureParent, TMP: fixtureParent, TEMP: fixtureParent },
            timeout: 25_000,
          },
        );
        if (stall) await expect(execution).rejects.toMatchObject({ code: 2 });
        else await execution;
        const evidence = await Promise.all(
          (await readdir(artifacts))
            .filter((name) => name.endsWith(".json"))
            .map(async (name) => JSON.parse(await readFile(join(artifacts, name), "utf8"))),
        );
        const supervision = evidence.find((value) => value.kind === "performance-supervision");
        expect(supervision.cleanupConfirmed).toBe(true);
        expect(supervision.cleanupErrors).toEqual([]);
        const ownedParent = await realpath(fixtureParent);
        expect(await realpath(root)).toBe(dirname(ownedParent));
        if (process.env.GITLODE_RETENTION_PROBE === "before-removal") {
          expect(supervision.status).toBe("injected assertion failure");
        }
        expect(supervision.status).toBe(stall ? "inconclusive" : "completed");
        expect(supervision.failure).toBe(stall ? "execution-deadline-exceeded" : undefined);
        expect(evidence.filter((value) => value.kind === "completed-performance-run")).toHaveLength(
          stall ? 1 : 9,
        );
        expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual(manifest("complete"));
        const generatedRoots = (await readFile(fixtureLog, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as string);
        expect(generatedRoots).toHaveLength(stall ? 2 : 9);
        for (const generatedRoot of generatedRoots) {
          const contained = relative(ownedParent, generatedRoot);
          expect(contained).not.toBe("");
          expect(contained.startsWith("..")).toBe(false);
          expect(isAbsolute(contained)).toBe(false);
          expect(dirname(generatedRoot)).toBe(ownedParent);
        }
        const remaining = await readdir(fixtureParent);
        expect(remaining.filter((name) => name.startsWith("gitlode-performance-"))).toHaveLength(
          stall ? 1 : 0,
        );
        // Preserve evidence outside the owned root before exercising outer teardown.
        const retainedEvidence = join(outside, "completed-evidence.json");
        await writeFile(retainedEvidence, JSON.stringify(evidence));
        await cp(root, join(outside, "diagnostics"), { recursive: true });
        await rm(root, { recursive: true });
        await expect(realpath(fixtureParent)).rejects.toMatchObject({ code: "ENOENT" });
        if (process.env.GITLODE_RETENTION_PROBE === "after-removal") {
          expect(supervision.status).toBe("injected assertion failure");
        }
        expect(JSON.parse(await readFile(retainedEvidence, "utf8"))).toEqual(evidence);
        expect(await readFile(sentinel, "utf8")).toBe("protected outside fixture");
        temporary.push(root, outside);
      } catch (error) {
        rethrowWorkflowFailure(error, { root, outside });
      }
    },
    30_000,
  );
  it.each(["before-removal", "after-removal"])(
    "retains diagnostics after actual failed-test teardown: %s",
    async (phase) => {
      const repositoryRoot = resolve(import.meta.dirname, "../../../..");
      let output = "";
      try {
        await promisify(execFile)(
          process.execPath,
          [
            resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"),
            "run",
            "packages/gitlode/test/telemetry/performance-workflow.test.ts",
            "-t",
            "preserves completed runs when a later child stalls: true",
          ],
          {
            cwd: repositoryRoot,
            env: { ...process.env, GITLODE_RETENTION_PROBE: phase },
            timeout: 45_000,
          },
        );
        throw new Error("Retention probe unexpectedly passed");
      } catch (error) {
        const failure = error as { code?: number; stdout?: string; stderr?: string };
        expect(failure.code).toBe(1);
        output = `${failure.stdout}\n${failure.stderr}`;
      }
      expect(output).toContain("injected assertion failure");
      process.stderr.write(output + "\n");
      const match = /Retained supervised workflow diagnostics: (\{[^\n]+\})/.exec(output);
      expect(match).not.toBeNull();
      const locations = JSON.parse(match![1]!) as { root: string; outside: string };
      process.stderr.write(
        "Observed retention after Vitest teardown: " +
          JSON.stringify({ phase, ...locations }) +
          "\n",
      );
      const diagnostics =
        phase === "before-removal" ? locations.root : join(locations.outside, "diagnostics");
      expect(await realpath(diagnostics)).toBe(diagnostics);
      const fixturePaths = (await readFile(join(diagnostics, "fixture-paths.jsonl"), "utf8"))
        .trim()
        .split("\n");
      expect(fixturePaths).toHaveLength(2);
      expect(JSON.parse(await readFile(join(diagnostics, "manifest.json"), "utf8"))).toEqual(
        manifest("complete"),
      );
      expect(await readFile(join(diagnostics, "counter"), "utf8")).toBe("2");
      expect(await readFile(join(diagnostics, "cli.cjs"), "utf8")).toContain("setInterval");
      const artifacts = join(diagnostics, "artifacts");
      const evidence = await Promise.all(
        (await readdir(artifacts))
          .filter((name) => name.endsWith(".json"))
          .map(async (name) => JSON.parse(await readFile(join(artifacts, name), "utf8"))),
      );
      const supervision = evidence.find((value) => value.kind === "performance-supervision");
      expect(supervision.cleanupConfirmed).toBe(true);
      expect(supervision.cleanupErrors).toEqual([]);
      expect(evidence.filter((value) => value.kind === "completed-performance-run")).toHaveLength(
        1,
      );
      for (const line of fixturePaths)
        expect(dirname(JSON.parse(line))).toBe(join(locations.root, "workflow-temp"));
      expect(await readFile(join(locations.outside, "sentinel"), "utf8")).toBe(
        "protected outside fixture",
      );
      if (phase === "after-removal") {
        await expect(realpath(locations.root)).rejects.toMatchObject({ code: "ENOENT" });
        expect(
          JSON.parse(await readFile(join(locations.outside, "completed-evidence.json"), "utf8")),
        ).toEqual(evidence);
      }
      // Dispose only this probe's observed, contained fixtures after confirmed process cleanup.
      for (const [path, prefix] of [
        [locations.root, "gitlode-supervised-workflow-"],
        [locations.outside, "gitlode-workflow-sentinel-"],
      ] as const) {
        expect(dirname(path)).toBe(await realpath(tmpdir()));
        expect(relative(await realpath(tmpdir()), path).startsWith(prefix)).toBe(true);
      }
      temporary.push(locations.root, locations.outside);
    },
    60_000,
  );
});
describe("performance workflow routing", () => {
  it.each([false, true])(
    "preserves the original failure when diagnostic writing fails: %s",
    async (fail) => {
      const root = await mkdtemp(join(tmpdir(), "gitlode-reporting-probe-"));
      temporary.push(root);
      const retained = join(root, "evidence");
      await writeFile(retained, "retained evidence");
      const original = new Error("original workflow failure");
      const locations = { root, outside: join(root, "outside") };
      let output = "";
      let caught: unknown;
      let calls = 0;
      try {
        rethrowWorkflowFailure(original, locations, (fd, message) => {
          calls++;
          expect(fd).toBe(2);
          if (fail) throw new Error("diagnostic write failure");
          output += message;
          return Buffer.byteLength(message);
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(calls).toBe(1);
      expect(output).toBe(
        fail ? "" : "Retained supervised workflow diagnostics: " + JSON.stringify(locations) + "\n",
      );
      expect(await readFile(retained, "utf8")).toBe("retained evidence");
    },
  );
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
  it("keeps historical targets readable but rejects them for new-protocol comparisons", () => {
    const value = manifest("complete");
    const key = "commit_heavy_repository/isomorphic-git";
    value.calibrationTargets[key] = {
      ...value.calibrationTargets[key]!,
      fixtureLifecycleProtocol: undefined,
    };
    expect(requireTarget(value, "commit_heavy_repository", "isomorphic-git", true).status).toBe(
      "complete",
    );
    expect(() =>
      requireTarget(value, "commit_heavy_repository", "isomorphic-git", true, true),
    ).toThrow(/new-protocol/);
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
      fixtureLifecycleProtocol: FIXTURE_LIFECYCLE_PROTOCOL,
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
    const storedRuns = artifact.runs.baseline as RawRun[];
    const operations = storedRuns.map((run) => fixtureOperationFor(run, "legacy_off"));
    expect(
      validateFixtureLinks(
        storedRuns.map((run) => run.fixtureLink),
        artifact.fixtureLifecycle,
        operations,
      ),
    ).toEqual([]);
    const substituted = storedRuns.map((run) => run.fixtureLink);
    substituted[0] = substituted[1];
    expect(validateFixtureLinks(substituted, artifact.fixtureLifecycle, operations)).toContain(
      "fixture child boundary order is invalid",
    );
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
      fixtureLifecycleProtocol: FIXTURE_LIFECYCLE_PROTOCOL,
      quantities: { commits: 4, files: 2, plugins: 1, rotations: 2, scale: 1 },
      environmentRef: "e",
      artifactRef: "a",
    };
    invalid.calibrationTargets["file_heavy_repository/git-cli"] = {
      status: "complete",
      fixtureLifecycleProtocol: FIXTURE_LIFECYCLE_PROTOCOL,
      quantities: { commits: 5, files: 0, plugins: 1, rotations: 11, scale: 1 },
      environmentRef: "e",
      artifactRef: "a",
    };
    invalid.calibrationTargets["plugin_heavy_projection/isomorphic-git"] = {
      status: "complete",
      fixtureLifecycleProtocol: FIXTURE_LIFECYCLE_PROTOCOL,
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
        { cwd: repositoryRoot, env: { ...process.env, PERF_LOG: log }, timeout: 60_000 },
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
        timeout: 60_000,
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
    const sidecarLinks = profile.sidecars.candidate.map(
      (sidecar: { fixtureLink?: RawRun["fixtureLink"] }) => sidecar.fixtureLink,
    );
    const sidecarOperations = (profile.runs.candidate as RawRun[]).map((run) =>
      fixtureOperationFor(run, "target_off", "target_on", "sidecar"),
    );
    expect(validateFixtureLinks(sidecarLinks, profile.fixtureLifecycle, sidecarOperations)).toEqual(
      [],
    );
    sidecarLinks[0] = sidecarLinks[1];
    expect(
      validateFixtureLinks(sidecarLinks, profile.fixtureLifecycle, sidecarOperations),
    ).toContain("fixture child boundary order is invalid");
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
  }, 120_000);
});
