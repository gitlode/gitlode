import pathlib, sys, shutil

source = pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/checkout/source')
execution = source / 'packages/gitlode/src/execution'
variant = sys.argv[1]
shutil.copy2(__file__, source / 'experiments/otel-m2-disabled-rss/change-variant.py')
path = execution / 'telemetry/worker-telemetry-session.ts'
text = path.read_text()
if variant == 'V1':
    text = text.replace('  ROOT_CONTEXT,', '  ROOT_CONTEXT,\n  ProxyTracerProvider,\n  createNoopMeter,', 1)
    text = text.replace('readonly tracerProvider: BasicTracerProvider;', 'readonly tracerProvider: Pick<BasicTracerProvider, "getTracer" | "forceFlush" | "shutdown">;')
    text = text.replace('readonly meterProvider: MeterProvider;', 'readonly meterProvider: Pick<MeterProvider, "getMeter" | "shutdown">;')
    text = text.replace('readonly #tracerProvider: BasicTracerProvider;', 'readonly #tracerProvider: Pick<BasicTracerProvider, "getTracer" | "forceFlush" | "shutdown">;')
    text = text.replace('readonly #meterProvider: MeterProvider;', 'readonly #meterProvider: Pick<MeterProvider, "getMeter" | "shutdown">;')
    old = '''    const degraded = createDegradedProviders();
    return new WorkerTelemetrySession({
      ...degraded,
      rootContext: trace.setSpan(ROOT_CONTEXT, degraded.rootSpan),
      hooks,
    });'''
    new = '''    // The private API proxy is never registered and never receives a delegate.
    // Global provider registration cannot activate this disabled experiment path.
    const provider = new ProxyTracerProvider();
    const tracerProvider = {
      getTracer: provider.getTracer.bind(provider),
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const meterProvider = { getMeter: () => createNoopMeter(), shutdown: async () => {} };
    const rootSpan = tracerProvider.getTracer(runSpanMetadata.scope.name).startSpan(
      runSpanMetadata.name, { root: true }, ROOT_CONTEXT,
    );
    return new WorkerTelemetrySession({
      tracerProvider, meterProvider, rootSpan,
      rootContext: trace.setSpan(ROOT_CONTEXT, rootSpan),
      hooks,
    });'''
    assert old in text
    text = text.replace(old, new, 1)
    path.write_text(text)
elif variant == 'V2':
    (execution / 'telemetry/rss-experiment-session.ts').write_text('''import { TELEMETRY_SPANS } from "@gitlode/internal-contracts/telemetry";
import { ROOT_CONTEXT, context, trace, ProxyTracerProvider, createNoopMeter } from "@opentelemetry/api";
import type { WorkerTelemetrySession } from "./worker-telemetry-session.js";

export type RssExperimentSession = Pick<WorkerTelemetrySession,
  "getTracer" | "getMeter" | "rootSpan" | "rootContext" | "recordingEnabled" | "runInRootContext" | "finalize">;

const runSpanMetadata = TELEMETRY_SPANS.find(span => span.id === "run");
if (!runSpanMetadata || runSpanMetadata.scope.type !== "core") throw new Error("Invalid run span telemetry metadata");

export async function createRssExperimentSession(enabled = true): Promise<RssExperimentSession> {
  if (enabled) {
    const { WorkerTelemetrySession } = await import("./worker-telemetry-session.js");
    return await WorkerTelemetrySession.create(true);
  }
  // Identical unregistered API provider construction to V1; no SDK is imported.
  const provider = new ProxyTracerProvider();
  const rootSpan = provider.getTracer(runSpanMetadata.scope.name).startSpan(runSpanMetadata.name, { root: true }, ROOT_CONTEXT);
  const rootContext = trace.setSpan(ROOT_CONTEXT, rootSpan);
  let finalization: Promise<{ applicationResult: unknown }> | undefined;
  return {
    getTracer: provider.getTracer.bind(provider),
    getMeter: () => createNoopMeter(),
    rootSpan,
    rootContext,
    recordingEnabled: false,
    runInRootContext: callback => context.with(rootContext, callback),
    finalize<Result>(applicationResult: Result) {
      if (!finalization) {
        rootSpan.end();
        finalization = Promise.resolve({ applicationResult });
      }
      return finalization as Promise<{ applicationResult: Result }>;
    },
  };
}
''')
    path = execution / 'execute-run.ts'; text = path.read_text()
    text = text.replace('import { WorkerTelemetrySession } from "./telemetry/worker-telemetry-session.js";', 'import { createRssExperimentSession, type RssExperimentSession as WorkerTelemetrySession } from "./telemetry/rss-experiment-session.js";')
    text = text.replace('dependencies.createTelemetrySession ?? WorkerTelemetrySession.create', 'dependencies.createTelemetrySession ?? createRssExperimentSession')
    path.write_text(text)
    path = execution / 'worker-entry.ts'; text = path.read_text()
    text = text.replace('import { createWorkerTelemetrySessionForTest } from "./telemetry/worker-telemetry-session.js";\n', '')
    text = text.replace('await createWorkerTelemetrySessionForTest({', 'await (await import("./telemetry/worker-telemetry-session.js")).createWorkerTelemetrySessionForTest({')
    path.write_text(text)
else: raise ValueError(variant)
print(variant, 'prepared')
