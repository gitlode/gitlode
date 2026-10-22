import { TELEMETRY_SPANS } from "@gitlode/internal-contracts/telemetry";
import { ProxyTracerProvider, ROOT_CONTEXT, createNoopMeter, trace } from "@opentelemetry/api";

import type { WorkerTelemetryBackend } from "./worker-telemetry-contract.js";

export function createNoopWorkerTelemetry(): WorkerTelemetryBackend {
  // Never register or delegate this API provider: unrelated globals must remain isolated.
  const provider = new ProxyTracerProvider();
  const meter = createNoopMeter();
  const run = TELEMETRY_SPANS.find((span) => span.id === "run");
  if (!run || run.scope.type !== "core") throw new Error("Invalid run span telemetry metadata");
  const rootSpan = provider
    .getTracer(run.scope.name)
    .startSpan(run.name, { root: true }, ROOT_CONTEXT);
  return {
    getTracer: (name, version) => provider.getTracer(name, version),
    getMeter: () => meter,
    rootSpan,
    rootContext: trace.setSpan(ROOT_CONTEXT, rootSpan),
    recordingEnabled: false,
    async finalize() {
      try {
        rootSpan.end();
      } catch {
        // Telemetry must preserve the application result even during finalization.
      }
      return undefined;
    },
  };
}
