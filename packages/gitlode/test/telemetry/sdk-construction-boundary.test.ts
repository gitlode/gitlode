import type * as ContextSdk from "@opentelemetry/context-async-hooks";
import type * as MetricSdk from "@opentelemetry/sdk-metrics";
import type * as TraceSdk from "@opentelemetry/sdk-trace-base";
import { expect, test, vi } from "vitest";

const constructions = vi.hoisted(() => ({ traces: 0, meters: 0, contexts: 0 }));
vi.mock("@opentelemetry/sdk-trace-base", async (original) => {
  const sdk = await original<typeof TraceSdk>();
  return {
    ...sdk,
    BasicTracerProvider: new Proxy(sdk.BasicTracerProvider, {
      construct(target, args, newTarget) {
        constructions.traces += 1;
        return Reflect.construct(target, args, newTarget);
      },
    }),
  };
});
vi.mock("@opentelemetry/sdk-metrics", async (original) => {
  const sdk = await original<typeof MetricSdk>();
  return {
    ...sdk,
    MeterProvider: new Proxy(sdk.MeterProvider, {
      construct(target, args, newTarget) {
        constructions.meters += 1;
        return Reflect.construct(target, args, newTarget);
      },
    }),
  };
});
vi.mock("@opentelemetry/context-async-hooks", async (original) => {
  const sdk = await original<typeof ContextSdk>();
  return {
    ...sdk,
    AsyncLocalStorageContextManager: new Proxy(sdk.AsyncLocalStorageContextManager, {
      construct(target, args, newTarget) {
        constructions.contexts += 1;
        return Reflect.construct(target, args, newTarget);
      },
    }),
  };
});

import {
  WorkerTelemetrySession,
  createWorkerTelemetrySessionForTest,
} from "../../src/execution/telemetry/worker-telemetry-session.js";

test("actual SDK constructors stay unused in Disabled/Degraded and activate in Enabled", async () => {
  const disabled = await WorkerTelemetrySession.create(false);
  await disabled.finalize("disabled");
  const degraded = await createWorkerTelemetrySessionForTest({
    failures: { enabled_module_import: new Error("denied") },
  });
  await degraded.finalize("degraded");
  expect(constructions).toEqual({ traces: 0, meters: 0, contexts: 0 });
  const enabled = await WorkerTelemetrySession.create(true);
  try {
    expect(enabled.recordingEnabled).toBe(true);
    expect(constructions).toEqual({ traces: 1, meters: 1, contexts: 1 });
  } finally {
    await enabled.finalize("enabled");
  }
}, 5000);
