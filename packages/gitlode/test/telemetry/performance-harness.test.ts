import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  comparePerformanceBehavior,
  normalizePerformanceFilename,
} from "../support/performance-equivalence.js";
import {
  createAggregationFixture,
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../support/performance-fixtures.js";
import {
  canonicalManifest,
  environmentCompatibility,
  evaluateComparison,
  evaluateVolume,
  launchMeasuredChild,
  mad,
  manifestHash,
  median,
  nextCalibrationQuantity,
  pairPlan,
  sampleChildRss,
  unavailableTargetTelemetry,
  type EnvironmentFingerprint,
  type FixtureManifest,
  type RawRun,
} from "../support/performance-harness.js";

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))),
);
const manifest: FixtureManifest = {
  schemaVersion: 2,
  recipeRevision: "performance-v1",
  aggregationScale: {
    status: "fixed-recipe",
    integration: "pending-target-collector",
    quantities: { commits: 0, files: 0, plugins: 0, rotations: 0, scale: 4 },
  },
  calibrationTargets: {
    "commit_heavy_repository/git-cli": {
      status: "incomplete",
      reason: "pending",
      quantities: { commits: 8, files: 1, plugins: 0, rotations: 1, scale: 0 },
    },
  },
  fixtures: {
    commit_heavy_repository: { commits: 8, files: 1, plugins: 0, rotations: 1, scale: 0 },
  },
};
const fingerprint = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
  os: { name: "linux", version: "x" },
  architecture: "x64",
  cpu: { model: "cpu", logicalCount: 8 },
  totalMemoryBytes: 1,
  nodeVersion: "v22.1.0",
  npmVersion: "10",
  gitVersion: "2.45",
  gitAdapter: "git-cli",
  buildMode: "release-bundled",
  repositoryRevision: "abc",
  fixtureManifestHash: manifestHash(manifest),
  benchmarkScriptRevision: "def",
  profileState: "legacy_off",
  warmupCount: 2,
  measuredPairCount: 7,
  ...overrides,
});
const run = (elapsedMs: number, rss = 100 * 1024 ** 2, code = 0, pairIndex = 0): RawRun => ({
  state: "legacy_off",
  phase: "measured",
  pairIndex,
  order: "A-B",
  elapsedMs,
  exit: { code, signal: null },
  peakRss: {
    status: "supported",
    platform: "linux",
    intervalMs: 20,
    peakBytes: rss,
    samples: [{ elapsedMs: 1.25, rssBytes: rss }],
  },
  outputBytes: 1.5,
  outputFiles: ["x.jsonl"],
  records: { status: "available", value: 1 },
  commits: { status: "unavailable", reason: "test" },
  skippedDiffs: { status: "unavailable", reason: "test" },
  telemetry: unavailableTargetTelemetry("legacy_off"),
  runId: `measured-${pairIndex}-legacy_off`,
});

describe("performance harness contracts", () => {
  it("separates two warmups from seven alternating measured pairs", () => {
    const plan = pairPlan();
    expect(plan.slice(0, 2).every((p) => p.phase === "warmup")).toBe(true);
    expect(plan.slice(2)).toHaveLength(7);
    expect(plan.slice(2).map((p) => p.order)).toEqual([
      "A-B",
      "B-A",
      "A-B",
      "B-A",
      "A-B",
      "B-A",
      "A-B",
    ]);
  });
  it("calculates paired ratios, median, MAD, and exact threshold boundaries", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(mad([1, 2, 3])).toBe(1);
    const baseline = Array.from({ length: 7 }, (_, index) =>
      run(20_000, 100 * 1024 ** 2, 0, index),
    );
    const atBoundary = evaluateComparison({
      kind: "disabled_overhead",
      baseline,
      candidate: Array.from({ length: 7 }, (_, index) => run(21_000, 108 * 1024 ** 2, 0, index)),
    });
    expect(atBoundary.status).toBe("pass");
    expect(atBoundary.wallClockOverhead).toBeCloseTo(0.05);
    expect(atBoundary.pairedRatios).toEqual(Array(7).fill(1.05));
    expect(
      evaluateComparison({
        kind: "disabled_overhead",
        baseline,
        candidate: Array.from({ length: 7 }, (_, index) =>
          run(21_001, 108 * 1024 ** 2 + 1, 0, index),
        ),
      }).status,
    ).toBe("fail");
  });
  it("makes noise, environment, child, behavior, and interference inconclusive", () => {
    const noisy = [10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000].map((value, index) =>
      run(value, 100 * 1024 ** 2, 0, index),
    );
    const candidate = Array.from({ length: 7 }, (_, index) =>
      run(20_000, 100 * 1024 ** 2, 0, index),
    );
    expect(
      evaluateComparison({ kind: "disabled_overhead", baseline: noisy, candidate }).status,
    ).toBe("inconclusive");
    expect(
      evaluateComparison({
        kind: "disabled_overhead",
        baseline: candidate,
        candidate,
        environmentErrors: ["OS"],
        behavioralErrors: ["JSONL"],
        environmentalInterference: "antivirus",
      }).reasons,
    ).toEqual(expect.arrayContaining(["OS", "JSONL", "antivirus"]));
    expect(
      evaluateComparison({
        kind: "disabled_overhead",
        baseline: candidate,
        candidate: [...candidate.slice(0, 6), run(20_000, 1, 1, 6)],
      }).reasons,
    ).toContain("child process failure");
  });
  it("applies fingerprint compatibility rules", () => {
    expect(
      environmentCompatibility(
        fingerprint(),
        fingerprint({ nodeVersion: "v23.0.0", architecture: "arm64", gitVersion: "2.46" }),
      ),
    ).toEqual(
      expect.arrayContaining([
        "Node major differs",
        "architecture differs",
        "Git version differs for git-cli comparison",
      ]),
    );
    expect(
      environmentCompatibility(
        fingerprint({ gitAdapter: "isomorphic-git" }),
        fingerprint({ gitAdapter: "isomorphic-git", gitVersion: "other" }),
      ),
    ).toEqual([]);
  });
  it("has stable canonical manifest hashing and normal serialization does not mutate it", async () => {
    const reordered = { ...manifest, calibrationTargets: { ...manifest.calibrationTargets } };
    expect(manifestHash(reordered)).toBe(manifestHash(manifest));
    const directory = await mkdtemp(join(tmpdir(), "manifest-"));
    dirs.push(directory);
    const path = join(directory, "manifest.json");
    await writeFile(path, canonicalManifest(manifest));
    const before = await readFile(path, "utf8");
    JSON.parse(before);
    expect(await readFile(path, "utf8")).toBe(before);
    expect(JSON.parse(before)).toEqual(manifest);
  });
  it("doubles calibration candidates and stops only in the window", () => {
    expect(nextCalibrationQuantity(8, 9_999)).toEqual({ quantity: 16, complete: false });
    expect(nextCalibrationQuantity(16, 10_000)).toEqual({ quantity: 16, complete: true });
    expect(nextCalibrationQuantity(16, 30_000)).toEqual({ quantity: 16, complete: true });
    expect(() => nextCalibrationQuantity(16, 30_001)).toThrow();
  });
  it("samples only injected child RSS and cleans up after exit", async () => {
    const child = new EventEmitter() as EventEmitter & { pid: number };
    child.pid = 42;
    let reads = 0;
    const promise = sampleChildRss(child, {
      platform: "linux",
      intervalMs: 5,
      reader: async (pid) => {
        expect(pid).toBe(42);
        reads++;
        return 1000 + reads;
      },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 12);
    });
    child.emit("close", 0, null);
    const result = await promise;
    const after = reads;
    await new Promise((resolve) => {
      setTimeout(resolve, 12);
    });
    expect(result.status).toBe("supported");
    expect(reads).toBe(after);
    expect(() => sampleChildRss(child, { intervalMs: 26 })).toThrow();
  });
  it("round-trips artifacts without rounding and marks legacy telemetry not applicable", () => {
    const artifact = { schemaVersion: 1, runs: [run(10.125, 123_456_789)], value: 1.23456789 };
    const roundTrip = JSON.parse(JSON.stringify(artifact));
    expect(roundTrip).toEqual(artifact);
    expect(roundTrip.value).toBe(1.23456789);
    expect(artifact.runs[0].telemetry.reportJsonBytes.status).toBe("not-applicable");
    expect(unavailableTargetTelemetry("target_on").reportJsonBytes.status).toBe("unavailable");
  });
  it("marks unsupported platforms and empty RSS readers inconclusive", async () => {
    const child = new EventEmitter() as EventEmitter & { pid: number };
    child.pid = 9;
    await expect(sampleChildRss(child, { platform: "darwin" })).resolves.toMatchObject({
      status: "unsupported",
    });
    const pending = sampleChildRss(child, { platform: "linux", reader: async () => undefined });
    child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ status: "unsupported" });
    const baseline = Array.from({ length: 7 }, (_, index) => run(20_000, 100, 0, index));
    baseline[0] = {
      ...baseline[0]!,
      peakRss: { status: "unsupported", platform: "darwin", intervalMs: 20, reason: "unsupported" },
    };
    const result = evaluateComparison({
      kind: "disabled_overhead",
      baseline,
      candidate: Array.from({ length: 7 }, (_, index) => run(20_000, 100, 0, index)),
    });
    expect(result.status).toBe("inconclusive");
    expect(result.peakRssIncreaseBytes).toBeUndefined();
    expect(result.reasons).toContain("peak RSS unsupported or incomplete");
  });
  it("rejects empty, mismatched, and duplicate measured pair structures", () => {
    expect(
      evaluateComparison({ kind: "disabled_overhead", baseline: [], candidate: [] }).status,
    ).toBe("inconclusive");
    const valid = [run(1, 1, 0, 0), run(1, 1, 0, 1)];
    expect(
      evaluateComparison({
        kind: "disabled_overhead",
        baseline: valid,
        candidate: valid.slice(0, 1),
      }).reasons,
    ).toContain("baseline and candidate measured pair counts differ");
    expect(
      evaluateComparison({
        kind: "disabled_overhead",
        baseline: valid,
        candidate: [run(1, 1, 0, 0), run(1, 1, 0, 0)],
      }).reasons,
    ).toContain("candidate measured pair indexes are missing or duplicated");
  });
  it("normalizes only filename session timestamps and exact checkpoint timestamps", () => {
    expect(normalizePerformanceFilename("prefix-20240101T010203Z-000001.jsonl")).toBe(
      "prefix-<session>-000001.jsonl",
    );
    const artifact = (name: string, bytes = "same", generatedAt = "2024-01-01T01:02:03.000Z") => ({
      exit: { code: 0, signal: null },
      checkpoint: { repositoryPath: "/repo", generatedAt },
      jsonl: [{ name, bytes: Buffer.from(bytes) }],
      derived: { records: 1, commits: 1, skippedDiffs: 0, files: 1, bytes: 4 },
    });
    const left = artifact("prefix-20240101T010203Z-000001.jsonl");
    const input = {
      repositoryPath: "/repo",
      baselineGeneratedAt: "2024-01-01T01:02:03.000Z",
      candidateGeneratedAt: "2024-02-01T01:02:03.000Z",
    };
    expect(
      comparePerformanceBehavior(
        left,
        artifact("prefix-20240201T010203Z-000001.jsonl", "same", input.candidateGeneratedAt),
        input,
      ),
    ).toEqual([]);
    expect(
      comparePerformanceBehavior(
        left,
        artifact("other-20240201T010203Z-000001.jsonl", "same", input.candidateGeneratedAt),
        input,
      ),
    ).toContain("JSONL prefix, sequence, or extension differs");
    expect(
      comparePerformanceBehavior(
        left,
        artifact("prefix-20240201T010203Z-000002.jsonl", "same", input.candidateGeneratedAt),
        input,
      ),
    ).toContain("JSONL prefix, sequence, or extension differs");
    expect(
      comparePerformanceBehavior(
        left,
        artifact("prefix-20240201T010203Z-000001.jsonl", "changed", input.candidateGeneratedAt),
        input,
      ),
    ).toContain("JSONL bytes or ordering differs");
  });
  it("evaluates bounded growth, trace volume, report size, and separates plugin spans", () => {
    const base = {
      scale: 10,
      spanGroups: 4,
      metricDatapoints: 8,
      histogramBuckets: 12,
      profileRssDeltaBytes: 100,
      prohibitedScalingSpanCount: 0,
      gitCommandSpans: 2,
      gitCommandStarts: 2,
      pluginSpans: 3,
      reportBytes: 1_048_576,
    };
    expect(evaluateVolume(base, { ...base, scale: 40, pluginSpans: 12 }).status).toBe("pass");
    expect(
      evaluateVolume(base, {
        ...base,
        scale: 40,
        spanGroups: 5,
        reportBytes: 1_048_577,
        gitCommandSpans: 3,
      }).reasons,
    ).toEqual(
      expect.arrayContaining([
        "span aggregate groups grew",
        "ProfileReport exceeds 1 MiB",
        "Git command span/start mismatch",
      ]),
    );
  });
  it("generates deterministic Git-independent aggregation and plugin inputs", async () => {
    expect(createAggregationFixture(4)).toEqual(createAggregationFixture(4));
    const directory = await mkdtemp(join(tmpdir(), "plugins-"));
    dirs.push(directory);
    const quantities = { commits: 0, files: 0, plugins: 4, rotations: 0, scale: 0 };
    const pluginFixture = await createPluginProjectionFixture(directory, quantities);
    expect(pluginFixture.registrations).toHaveLength(4);
    const factory = (await import(`file://${join(directory, "deterministic-plugin/index.js")}`))
      .default;
    const success = await factory({ outcome: "success", ordinal: 1 });
    const skip = await factory({ outcome: "skip", ordinal: 2 });
    const context = { fact: { type: "file-change" } };
    await expect(success.project(context)).resolves.toMatchObject({ type: "success" });
    await expect(skip.project(context)).resolves.toEqual({ type: "skip" });
    expect(await readFile(join(directory, "plugin-input.json"), "utf8")).not.toContain("http");
  });
  it("treats manifest commits as the final repository total", async () => {
    const directory = await mkdtemp(join(tmpdir(), "performance-repository-"));
    dirs.push(directory);
    await createPerformanceRepository(directory, "commit_heavy_repository", {
      commits: 7,
      files: 1,
      plugins: 0,
      rotations: 1,
      scale: 0,
    });
    const count = await new Promise<string>((resolve, reject) => {
      execFile("git", ["rev-list", "--count", "--all"], { cwd: directory }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
    expect(count).toBe("7");
  });
  it("derives nested file skipped diffs and handles spawn failure without hanging", async () => {
    const directory = await mkdtemp(join(tmpdir(), "performance-child-"));
    dirs.push(directory);
    const script = join(directory, "child.cjs");
    await writeFile(
      script,
      `require('node:fs').writeFileSync(${JSON.stringify(join(directory, "performance-20240101T000000Z-000001.jsonl"))}, JSON.stringify({oid:'a',file:{additions:null,deletions:null}})+'\\n')`,
    );
    const result = await launchMeasuredChild({
      executable: process.execPath,
      args: [script],
      outputDirectory: directory,
      state: "legacy_off",
      phase: "measured",
      pairIndex: 0,
      order: "A-B",
    });
    expect(result.skippedDiffs).toEqual({ status: "available", value: 1 });
    const empty = await mkdtemp(join(tmpdir(), "performance-spawn-"));
    dirs.push(empty);
    await expect(
      launchMeasuredChild({
        executable: join(empty, "absent"),
        args: [],
        outputDirectory: empty,
        state: "legacy_off",
        phase: "measured",
        pairIndex: 0,
        order: "A-B",
      }),
    ).resolves.toMatchObject({ exit: { code: null } });
  });
});
