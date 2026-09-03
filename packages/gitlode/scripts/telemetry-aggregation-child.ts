import { getTelemetryMetricMetadata } from "@gitlode/internal-contracts/telemetry";

import { WorkerTelemetrySession } from "../src/execution/telemetry/worker-telemetry-session.js";

const args = process.argv.slice(2);
const value = (name: string) => args[args.indexOf(name) + 1];
const scale = Number(value("--scale"));
const enabled = args.includes("--profile");
if (!Number.isSafeInteger(scale) || scale <= 0) throw new Error("invalid aggregation scale");

const session = await WorkerTelemetrySession.create(enabled);
const tracer = session.getTracer("gitlode.performance.aggregation");
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
for (let index = 0; index < scale; index += 1) {
  const outcome = index % 2 ? "success" : "error";
  const span = tracer.startSpan("gitlode.performance.aggregation.operation", {
    attributes: { "gitlode.performance.aggregation.outcome": outcome },
  });
  span.end();
  counter.add(1, { "gitlode.git.file_change.type": "added" });
  histogram.record((index + 1) / 1000, {
    "gitlode.file_change.expansion.outcome": outcome,
  });
}
const result = await session.finalize({ kind: "success" });
process.stdout.write(
  `${JSON.stringify({ scale, enabled, report: result.profileReport ?? null })}\n`,
);
