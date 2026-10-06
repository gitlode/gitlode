import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { ROOT_CONTEXT, context, trace, INVALID_SPAN_CONTEXT } from "@opentelemetry/api";
import { WorkerTelemetrySession } from "../../packages/gitlode/src/execution/telemetry/worker-telemetry-session.js";

const variant = process.argv[2];
const create = variant === "V2"
  ? (await import("../../packages/gitlode/src/execution/telemetry/rss-experiment-session.js")).createRssExperimentSession
  : WorkerTelemetrySession.create;
// This probe imports the original class for V2 type/behavior checking; the artifact
// graph check independently establishes disabled CLI/worker import isolation.
const session = await create(false);
assert.equal(session.recordingEnabled, false);
assert.equal(session.rootSpan.isRecording(), false);
assert.equal(session.rootSpan.spanContext().traceFlags, 0);
if (variant !== "V0") assert.deepEqual(session.rootSpan.spanContext(), INVALID_SPAN_CONTEXT);
assert.equal(trace.getSpan(session.rootContext), session.rootSpan);
assert.equal(session.runInRootContext(() => context.active()), ROOT_CONTEXT);
for (const scope of ["gitlode.git", "gitlode.dag", "gitlode.execution", "gitlode.extraction", "gitlode.line_diff", "gitlode.plugin_runtime"]) {
  const span = session.getTracer(scope).startSpan("probe", {}, session.rootContext);
  assert.equal(span.isRecording(), false);
  assert.equal(span.spanContext().traceFlags, 0);
  if (variant !== "V0") assert.deepEqual(span.spanContext(), INVALID_SPAN_CONTEXT);
  span.end();
  session.getMeter(scope).createCounter("probe").add(1);
}
const result = { kind: "probe-result" };
const finalized = await session.finalize(result);
assert.deepEqual(finalized, { applicationResult: result });
assert.equal((await session.finalize(result)).applicationResult, result);
const require = createRequire(import.meta.url);
const globalApi = (globalThis as Record<symbol, unknown>)[Symbol.for("opentelemetry.js.api.1")] as { trace?: unknown; metrics?: unknown; context?: unknown } | undefined;
assert.equal(globalApi?.trace, undefined);
assert.equal(globalApi?.metrics, undefined);
assert.equal(globalApi?.context, undefined);
console.log(JSON.stringify({ variant, node: process.version, disabled: true, rootRecording: false, globalProviderAbsent: true, sdkModulesInProbe: Object.keys(require.cache).filter(path => /opentelemetry.*(sdk-|context-async)/.test(path)) }));
