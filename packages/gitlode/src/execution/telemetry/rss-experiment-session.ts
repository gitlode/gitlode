import { TELEMETRY_SPANS } from "@gitlode/internal-contracts/telemetry";
import {
  ROOT_CONTEXT,
  context,
  trace,
  ProxyTracerProvider,
  createNoopMeter,
} from "@opentelemetry/api";

import type { WorkerTelemetrySession } from "./worker-telemetry-session.js";

export type RssExperimentSession = Pick<
  WorkerTelemetrySession,
  | "getTracer"
  | "getMeter"
  | "rootSpan"
  | "rootContext"
  | "recordingEnabled"
  | "runInRootContext"
  | "finalize"
>;

const runSpanMetadata = (() => {
  const metadata = TELEMETRY_SPANS.find((span) => span.id === "run");
  if (!metadata || metadata.scope.type !== "core")
    throw new Error("Invalid run span telemetry metadata");
  return metadata;
})();

export async function createRssExperimentSession(enabled = true): Promise<RssExperimentSession> {
  if (enabled) {
    const { WorkerTelemetrySession } = await import("./worker-telemetry-session.js");
    return await WorkerTelemetrySession.create(true);
  }
  // Identical unregistered API provider construction to V1; no SDK is imported.
  const provider = new ProxyTracerProvider();
  const rootSpan = provider
    .getTracer(runSpanMetadata.scope.name)
    .startSpan(runSpanMetadata.name, { root: true }, ROOT_CONTEXT);
  const rootContext = trace.setSpan(ROOT_CONTEXT, rootSpan);
  let finalization: Promise<{ applicationResult: unknown }> | undefined;
  return {
    getTracer: provider.getTracer.bind(provider),
    getMeter: () => createNoopMeter(),
    rootSpan,
    rootContext,
    recordingEnabled: false,
    runInRootContext: (callback) => context.with(rootContext, callback),
    finalize<Result>(applicationResult: Result) {
      if (!finalization) {
        rootSpan.end();
        finalization = Promise.resolve({ applicationResult });
      }
      return finalization as Promise<{ applicationResult: Result }>;
    },
  };
}
