import { fileURLToPath } from "node:url";

import { WorkerTelemetrySession } from "../src/execution/telemetry/worker-telemetry-session.js";
import { createFileChangeFactExpanderMetricRecorder } from "../src/extraction/file-change-fact-expander-metric-recorder.js";

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
  const recorder = createFileChangeFactExpanderMetricRecorder(
    session.getMeter("gitlode.extraction"),
  );
  for (const item of aggregationRecipe(scale)) {
    const span = tracer.startSpan("gitlode.performance.aggregation.operation", {
      attributes: {
        "aggregation.identity": item.identity,
        "aggregation.outcome": item.attributes.outcome,
      },
    });
    span.end();
    const token = recorder.startExpansion();
    recorder.completeExpansion(token, {
      outcome: item.attributes.outcome === "success" ? "success" : "binary",
      ...(item.attributes.outcome === "success" ? { size: item.value } : {}),
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
