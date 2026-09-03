import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getTelemetryMetricMetadata } from "@gitlode/internal-contracts/telemetry";

import { WorkerTelemetrySession } from "../src/execution/telemetry/worker-telemetry-session.js";
import { sampleChildRss, type RssMeasurement } from "../test/support/performance-harness.js";

export const AGGREGATION_OBSERVATION_IDENTITIES = [
  "observation-0",
  "observation-1",
  "observation-2",
  "observation-3",
] as const;

export function aggregationRecipe(scale: number) {
  if (!Number.isSafeInteger(scale) || scale <= 0)
    throw new Error("aggregation scale must be positive");
  return Array.from({ length: scale }, (_, index) => ({
    identity: AGGREGATION_OBSERVATION_IDENTITIES[index % AGGREGATION_OBSERVATION_IDENTITIES.length],
    attributes: { outcome: index % 2 ? "success" : "skip" },
    value: index + 0.125,
  }));
}

export async function collectAggregation(scale: number, enabled: boolean) {
  const session = await WorkerTelemetrySession.create(enabled);
  const tracer = session.getTracer("gitlode.performance.aggregation");
  // Use catalogued instruments so this child exercises the same local reader and views as a worker.
  const meter = session.getMeter("gitlode.extraction");
  const counterMetadata = getTelemetryMetricMetadata("file_change_expanded");
  const histogramMetadata = getTelemetryMetricMetadata("file_change_expansion_duration");
  const counter = meter.createCounter(counterMetadata.name, {
    description: counterMetadata.description,
    unit: counterMetadata.unit,
  });
  const histogram = meter.createHistogram(histogramMetadata.name, {
    description: histogramMetadata.description,
    unit: histogramMetadata.unit,
    advice: { explicitBucketBoundaries: [...histogramMetadata.explicitBucketBoundaries] },
  });
  for (const item of aggregationRecipe(scale)) {
    const span = tracer.startSpan("gitlode.performance.aggregation.operation", {
      attributes: {
        "aggregation.identity": item.identity,
        "aggregation.outcome": item.attributes.outcome,
      },
    });
    span.end();
    counter.add(1, { "gitlode.git.file_change.type": "added" });
    histogram.record(item.value / 1000, {
      "gitlode.file_change.expansion.outcome":
        item.attributes.outcome === "success" ? "success" : "error",
    });
  }
  const finalized = await session.finalize({ kind: "success" });
  const report = finalized.profileReport;
  if (!report)
    return { scale, enabled, report: null, reportJsonBytes: null, diagnosticCount: null };
  return {
    scale,
    enabled,
    report,
    reportJsonBytes: Buffer.byteLength(JSON.stringify(report), "utf8"),
    diagnosticCount: report.diagnostics.length,
  };
}

export async function collectAggregationScale(scale: number) {
  return {
    n: await collectAggregation(scale, true),
    fourN: await collectAggregation(scale * 4, true),
    disabledN: await collectAggregation(scale, false),
    disabledFourN: await collectAggregation(scale * 4, false),
  };
}

export interface AggregationChildRun {
  readonly scale: number;
  readonly enabled: boolean;
  readonly exit: { readonly code: number | null; readonly signal: NodeJS.Signals | null };
  readonly rss: RssMeasurement;
  readonly output?: ReturnType<typeof collectAggregation> extends Promise<infer T> ? T : never;
  readonly error?: string;
}

export async function runAggregationChild(
  scriptPath: string,
  scale: number,
  enabled: boolean,
): Promise<AggregationChildRun> {
  const child = spawn(
    process.execPath,
    [scriptPath, "--scale", String(scale), ...(enabled ? ["--profile"] : [])],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const rssPromise = sampleChildRss(child);
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit) => {
      child.once("error", () => resolveExit({ code: null, signal: null }));
      child.once("close", (code, signal) => resolveExit({ code, signal }));
    },
  );
  const result: AggregationChildRun = { scale, enabled, exit, rss: await rssPromise };
  if (exit.code !== 0)
    return {
      ...result,
      error: `aggregation collector child failed${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
    };
  try {
    return { ...result, output: JSON.parse(stdout) as AggregationChildRun["output"] };
  } catch {
    return { ...result, error: "aggregation collector output is malformed" };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => args[args.indexOf(name) + 1];
  const scale = Number(value("--scale"));
  const enabled = args.includes("--profile");
  process.stdout.write(
    `${JSON.stringify(args.includes("--compare") ? await collectAggregationScale(scale) : await collectAggregation(scale, enabled))}\n`,
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) void main();
