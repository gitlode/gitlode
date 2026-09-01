import { context, metrics, trace } from "@opentelemetry/api";

import { createDagTelemetryBinding } from "../../src/git-impl/dag-metric-recorder.js";
import { createGitMetricRecorder } from "../../src/git-impl/git-metric-recorder.js";

export function adapterTelemetry(adapter: "isomorphic-git" | "git-cli") {
  const gitTracer = trace.getTracer("gitlode.git");
  return {
    tracer: gitTracer,
    metricRecorder: createGitMetricRecorder(metrics.getMeter("gitlode.git"), adapter),
    parentContext: context.active(),
    dagTelemetryBinding: createDagTelemetryBinding(
      trace.getTracer("gitlode.dag"),
      metrics.getMeter("gitlode.dag"),
    ),
  };
}
