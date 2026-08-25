import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { compareBehavioralArtifacts, type BehavioralArtifacts } from "./profile-equivalence.js";

export type ProfileState = "legacy_off" | "target_off" | "target_on";
export type Availability<T> =
  | { readonly status: "available"; readonly value: T }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "not-applicable"; readonly reason: string };

export interface FixtureQuantities {
  readonly commits: number;
  readonly files: number;
  readonly plugins: number;
  readonly rotations: number;
  readonly scale: number;
}
export interface FixtureManifest {
  readonly schemaVersion: 1;
  readonly calibration: { readonly status: "complete" | "incomplete"; readonly reason?: string };
  readonly recipeRevision: string;
  readonly fixtures: Readonly<Record<string, FixtureQuantities>>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function canonicalManifest(manifest: FixtureManifest): string {
  return `${JSON.stringify(canonical(manifest), undefined, 2)}\n`;
}
export function manifestHash(manifest: FixtureManifest): string {
  return createHash("sha256").update(canonicalManifest(manifest)).digest("hex");
}

export interface EnvironmentFingerprint {
  readonly os: { readonly name: string; readonly version: string };
  readonly architecture: string;
  readonly cpu: { readonly model: string; readonly logicalCount: number };
  readonly totalMemoryBytes: number;
  readonly nodeVersion: string;
  readonly npmVersion: string;
  readonly gitVersion: string;
  readonly gitAdapter: "isomorphic-git" | "git-cli" | "none";
  readonly buildMode: "release-bundled" | "release-installed";
  readonly repositoryRevision: string;
  readonly fixtureManifestHash: string;
  readonly benchmarkScriptRevision: string;
  readonly profileState: ProfileState;
  readonly warmupCount: number;
  readonly measuredPairCount: number;
}
const major = (version: string) => version.replace(/^v/, "").split(".")[0];
export function environmentCompatibility(
  baseline: EnvironmentFingerprint,
  candidate: EnvironmentFingerprint,
): string[] {
  const errors: string[] = [];
  if (major(baseline.nodeVersion) !== major(candidate.nodeVersion))
    errors.push("Node major differs");
  if (baseline.os.name !== candidate.os.name) errors.push("operating system differs");
  if (baseline.architecture !== candidate.architecture) errors.push("architecture differs");
  if (
    (baseline.gitAdapter === "git-cli" || candidate.gitAdapter === "git-cli") &&
    baseline.gitVersion !== candidate.gitVersion
  )
    errors.push("Git version differs for git-cli comparison");
  return errors;
}
export async function fingerprint(
  input: Omit<
    EnvironmentFingerprint,
    "os" | "architecture" | "cpu" | "totalMemoryBytes" | "nodeVersion"
  >,
): Promise<EnvironmentFingerprint> {
  return {
    ...input,
    os: { name: process.platform, version: release() },
    architecture: process.arch,
    cpu: { model: cpus()[0]?.model ?? "unknown", logicalCount: cpus().length },
    totalMemoryBytes: totalmem(),
    nodeVersion: process.version,
  };
}

export interface RssSample {
  readonly elapsedMs: number;
  readonly rssBytes: number;
}
export interface RssMeasurement {
  readonly status: "supported" | "unsupported";
  readonly platform: string;
  readonly intervalMs: number;
  readonly peakBytes?: number;
  readonly samples?: readonly RssSample[];
  readonly reason?: string;
}
export interface RssReader {
  (pid: number): Promise<number | undefined>;
}
async function linuxRss(pid: number): Promise<number | undefined> {
  try {
    const status = await readFile(`/proc/${pid}/status`, "utf8");
    const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
    return match ? Number(match[1]) * 1024 : undefined;
  } catch {
    return undefined;
  }
}
export function sampleChildRss(
  child: Pick<ChildProcess, "pid" | "once">,
  options: {
    readonly platform?: string;
    readonly intervalMs?: number;
    readonly reader?: RssReader;
    readonly now?: () => number;
  } = {},
): Promise<RssMeasurement> {
  const platform = options.platform ?? process.platform;
  const intervalMs = options.intervalMs ?? 20;
  if (intervalMs > 25) throw new Error("RSS sampling interval must not exceed 25ms");
  if (platform !== "linux" || !child.pid)
    return Promise.resolve({
      status: "unsupported",
      platform,
      intervalMs,
      reason: "external child RSS sampling is unsupported",
    });
  const reader = options.reader ?? linuxRss;
  const now = options.now ?? performance.now.bind(performance);
  const started = now();
  const samples: RssSample[] = [];
  return new Promise((resolve) => {
    let active = false;
    let finished = false;
    const poll = async () => {
      if (active || finished) return;
      active = true;
      const rss = await reader(child.pid as number);
      if (rss !== undefined) samples.push({ elapsedMs: now() - started, rssBytes: rss });
      active = false;
    };
    void poll();
    const timer = setInterval(() => void poll(), intervalMs);
    child.once("exit", () => {
      finished = true;
      clearInterval(timer);
      const peakBytes = samples.length
        ? Math.max(...samples.map((sample) => sample.rssBytes))
        : undefined;
      // The exit listener is registered once and owns the sampler's only resolution.
      // oxlint-disable-next-line promise/no-multiple-resolved
      resolve(
        peakBytes === undefined
          ? {
              status: "unsupported",
              platform,
              intervalMs,
              reason: "no child RSS sample was readable",
            }
          : { status: "supported", platform, intervalMs, peakBytes, samples },
      );
    });
  });
}

export interface TargetTelemetryMeasurements {
  readonly reportJsonBytes: Availability<number>;
  readonly spanAggregateGroupCount: Availability<number>;
  readonly totalEndedSpanCount: Availability<number>;
  readonly counterDatapointCount: Availability<number>;
  readonly histogramDatapointCount: Availability<number>;
  readonly diagnosticCount: Availability<number>;
}
export const unavailableTargetTelemetry = (state: ProfileState): TargetTelemetryMeasurements => {
  const value: Availability<number> =
    state === "legacy_off"
      ? {
          status: "not-applicable",
          reason: "target ProfileReport does not exist at the legacy revision",
        }
      : {
          status: "unavailable",
          reason: "target ProfileReport observation seam is not implemented yet",
        };
  return {
    reportJsonBytes: value,
    spanAggregateGroupCount: value,
    totalEndedSpanCount: value,
    counterDatapointCount: value,
    histogramDatapointCount: value,
    diagnosticCount: value,
  };
};

export interface RawRun {
  readonly state: ProfileState;
  readonly phase: "warmup" | "measured";
  readonly pairIndex?: number;
  readonly order: "A-B" | "B-A";
  readonly elapsedMs: number;
  readonly exit: { readonly code: number | null; readonly signal: NodeJS.Signals | null };
  readonly peakRss: RssMeasurement;
  readonly outputBytes: number;
  readonly outputFiles: readonly string[];
  readonly records: Availability<number>;
  readonly commits: Availability<number>;
  readonly skippedDiffs: Availability<number>;
  readonly telemetry: TargetTelemetryMeasurements;
  readonly outputDirectory: string;
}
export async function launchMeasuredChild(input: {
  readonly executable: string;
  readonly args: readonly string[];
  readonly outputDirectory: string;
  readonly state: ProfileState;
  readonly phase: "warmup" | "measured";
  readonly order: "A-B" | "B-A";
  readonly pairIndex?: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly rssReader?: RssReader;
}): Promise<RawRun> {
  const args = [...input.args, "--quiet", ...(input.state === "target_on" ? ["--profile"] : [])];
  const start = performance.now();
  const child = spawn(input.executable, args, { env: input.env, stdio: "ignore" });
  const rss = sampleChildRss(child, { reader: input.rssReader });
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    },
  );
  const elapsedMs = performance.now() - start;
  const outputFiles = (await readdir(input.outputDirectory))
    .filter((name) => name.endsWith(".jsonl"))
    .sort();
  const sizes = await Promise.all(
    outputFiles.map(async (name) => (await stat(join(input.outputDirectory, name))).size),
  );
  const contents = await Promise.all(
    outputFiles.map(async (name) => await readFile(join(input.outputDirectory, name), "utf8")),
  );
  const records = contents.flatMap((content) =>
    content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>),
  );
  const commitOids = new Set(
    records.map((record) => record.oid).filter((oid): oid is string => typeof oid === "string"),
  );
  const skippedDiffs = records.filter(
    (record) => "additions" in record && record.additions === null && record.deletions === null,
  ).length;
  return {
    state: input.state,
    phase: input.phase,
    pairIndex: input.pairIndex,
    order: input.order,
    elapsedMs,
    exit,
    peakRss: await rss,
    outputBytes: sizes.reduce((sum, size) => sum + size, 0),
    outputFiles,
    records: { status: "available", value: records.length },
    commits: { status: "available", value: commitOids.size },
    skippedDiffs: { status: "available", value: skippedDiffs },
    telemetry: unavailableTargetTelemetry(input.state),
    outputDirectory: input.outputDirectory,
  };
}

export function pairPlan(
  warmups = 2,
  pairs = 7,
): readonly { phase: "warmup" | "measured"; pairIndex?: number; order: "A-B" | "B-A" }[] {
  return [
    ...Array.from({ length: warmups }, (_, index) => ({
      phase: "warmup" as const,
      order: (index % 2 ? "B-A" : "A-B") as "A-B" | "B-A",
    })),
    ...Array.from({ length: pairs }, (_, pairIndex) => ({
      phase: "measured" as const,
      pairIndex,
      order: (pairIndex % 2 ? "B-A" : "A-B") as "A-B" | "B-A",
    })),
  ];
}
export const median = (values: readonly number[]): number => {
  if (!values.length) throw new Error("median requires values");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
export const mad = (values: readonly number[]): number => {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
};
export interface Evaluation {
  readonly status: "pass" | "fail" | "inconclusive";
  readonly pairedRatios: readonly number[];
  readonly baselineMedian: number;
  readonly candidateMedian: number;
  readonly baselineMad: number;
  readonly candidateMad: number;
  readonly wallClockOverhead: number;
  readonly peakRssIncreaseBytes?: number;
  readonly reasons: readonly string[];
}
export function evaluateComparison(input: {
  readonly kind: "disabled_overhead" | "profile_overhead";
  readonly baseline: readonly RawRun[];
  readonly candidate: readonly RawRun[];
  readonly environmentErrors?: readonly string[];
  readonly behavioralErrors?: readonly string[];
  readonly environmentalInterference?: string;
}): Evaluation {
  const b = input.baseline.map((run) => run.elapsedMs),
    c = input.candidate.map((run) => run.elapsedMs);
  const pairedRatios = c.map((value, index) => value / b[index]!);
  const baselineMedian = median(b),
    candidateMedian = median(c),
    baselineMad = mad(b),
    candidateMad = mad(c);
  const reasons = [...(input.environmentErrors ?? []), ...(input.behavioralErrors ?? [])];
  if (input.environmentalInterference) reasons.push(input.environmentalInterference);
  if ([...input.baseline, ...input.candidate].some((run) => run.exit.code !== 0))
    reasons.push("child process failure");
  if (baselineMad > baselineMedian * 0.05) reasons.push("baseline MAD exceeds 5 percent");
  if (candidateMad > candidateMedian * 0.05) reasons.push("candidate MAD exceeds 5 percent");
  const baselinePeaks = input.baseline
    .map((r) => r.peakRss.peakBytes)
    .filter((v): v is number => v !== undefined);
  const candidatePeaks = input.candidate
    .map((r) => r.peakRss.peakBytes)
    .filter((v): v is number => v !== undefined);
  if (baselinePeaks.length !== b.length || candidatePeaks.length !== c.length)
    reasons.push("peak RSS unsupported or incomplete");
  const peakRssIncreaseBytes = reasons.includes("peak RSS unsupported or incomplete")
    ? undefined
    : median(candidatePeaks) - median(baselinePeaks);
  const maximumRatio = input.kind === "disabled_overhead" ? 1.05 : 1.15;
  const allowedBytes = Math.max(
    (input.kind === "disabled_overhead" ? 8 : 32) * 1024 ** 2,
    median(baselinePeaks) * (input.kind === "disabled_overhead" ? 0.05 : 0.15),
  );
  const wallClockOverhead = median(pairedRatios) - 1;
  return {
    status: reasons.length
      ? "inconclusive"
      : median(pairedRatios) <= maximumRatio && peakRssIncreaseBytes! <= allowedBytes
        ? "pass"
        : "fail",
    pairedRatios,
    baselineMedian,
    candidateMedian,
    baselineMad,
    candidateMad,
    wallClockOverhead,
    peakRssIncreaseBytes,
    reasons,
  };
}

export function verifyMeasuredBehavior(
  baseline: BehavioralArtifacts,
  candidate: BehavioralArtifacts,
  repositoryPath: string,
): string[] {
  return compareBehavioralArtifacts(baseline, candidate, "same-adapter", repositoryPath);
}
export function nextCalibrationQuantity(
  current: number,
  legacyMedianMs: number,
): { quantity: number; complete: boolean } {
  if (legacyMedianMs >= 10_000 && legacyMedianMs <= 30_000)
    return { quantity: current, complete: true };
  if (legacyMedianMs > 30_000)
    throw new Error("candidate skipped the accepted 10-30 second calibration window");
  return { quantity: current * 2, complete: false };
}

export interface VolumeObservation {
  readonly scale: number;
  readonly spanGroups: number;
  readonly metricDatapoints: number;
  readonly histogramBuckets: number;
  readonly profileRssDeltaBytes: number;
  readonly prohibitedScalingSpanCount: number;
  readonly gitCommandSpans: number;
  readonly gitCommandStarts: number;
  readonly pluginSpans: number;
  readonly reportBytes: number;
}
export function evaluateVolume(n: VolumeObservation, fourN: VolumeObservation) {
  const reasons: string[] = [];
  if (fourN.spanGroups !== n.spanGroups) reasons.push("span aggregate groups grew");
  if (fourN.metricDatapoints !== n.metricDatapoints) reasons.push("metric datapoints grew");
  if (fourN.histogramBuckets !== n.histogramBuckets) reasons.push("histogram buckets grew");
  if (fourN.profileRssDeltaBytes - n.profileRssDeltaBytes > 8 * 1024 ** 2)
    reasons.push("profile RSS delta grew by more than 8 MiB");
  if (fourN.prohibitedScalingSpanCount || n.prohibitedScalingSpanCount)
    reasons.push("prohibited scaling spans observed");
  if (fourN.gitCommandSpans !== fourN.gitCommandStarts || n.gitCommandSpans !== n.gitCommandStarts)
    reasons.push("Git command span/start mismatch");
  if (n.reportBytes > 1_048_576 || fourN.reportBytes > 1_048_576)
    reasons.push("ProfileReport exceeds 1 MiB");
  return {
    status: reasons.length ? ("fail" as const) : ("pass" as const),
    reasons,
    pluginSpans: { n: n.pluginSpans, fourN: fourN.pluginSpans },
  };
}
