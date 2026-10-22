import {
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT,
  context,
  metrics,
  trace,
  type Span,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { LocalMetricReader } from "../../src/execution/telemetry/local-metric-reader.js";
import { LocalSpanProcessor } from "../../src/execution/telemetry/local-span-processor.js";
import {
  WorkerTelemetrySession,
  createWorkerTelemetrySessionForTest,
  type WorkerTelemetryTestAttempt,
} from "../../src/execution/telemetry/worker-telemetry-session.js";

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("boundary test deadline")), 2000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

beforeEach(() => {
  context.disable();
  trace.disable();
  metrics.disable();
});
afterEach(() => {
  context.disable();
  trace.disable();
  metrics.disable();
  vi.restoreAllMocks();
});

test("disabled factory skips loader, providers, lifecycle hooks and context registration", async () => {
  const loadEnabledModule = vi.fn(() => Promise.reject(new Error("must not import")));
  const onAttempt = vi.fn(() => {
    throw new Error("must not initialize");
  });
  const traceAcquisition = vi.spyOn(BasicTracerProvider.prototype, "getTracer");
  const meterAcquisition = vi.spyOn(MeterProvider.prototype, "getMeter");
  const registration = vi.spyOn(context, "setGlobalContextManager");
  const session = await bounded(
    createWorkerTelemetrySessionForTest({ loadEnabledModule, onAttempt }, false),
  );
  session.getTracer("plugin").startSpan("ignored").end();
  session.getMeter("plugin").createCounter("ignored").add(1);
  expect(session.recordingEnabled).toBe(false);
  expect(session.rootSpan.spanContext()).toEqual(INVALID_SPAN_CONTEXT);
  expect(await bounded(session.finalize("result"))).toEqual({ applicationResult: "result" });
  expect(loadEnabledModule).not.toHaveBeenCalled();
  expect(onAttempt).not.toHaveBeenCalled();
  expect(traceAcquisition).not.toHaveBeenCalled();
  expect(meterAcquisition).not.toHaveBeenCalled();
  expect(registration).not.toHaveBeenCalled();
});

test("disabled never calls a rejected enabled loader even with nonthrowing observers", async () => {
  const loadEnabledModule = vi.fn(() => Promise.reject(new Error("loader must stay unused")));
  const onAttempt = vi.fn();
  const session = await bounded(
    createWorkerTelemetrySessionForTest({ loadEnabledModule, onAttempt }, false),
  );
  expect(await bounded(session.finalize("result"))).toEqual({ applicationResult: "result" });
  expect(loadEnabledModule).not.toHaveBeenCalled();
  expect(onAttempt).not.toHaveBeenCalled();
});

test.each([false, true])(
  "no-op root/explicit parent and global-provider isolation, degraded=%s",
  async (degraded) => {
    const externalTrace = new BasicTracerProvider();
    const externalMeter = new MeterProvider();
    const globalTrace = vi.spyOn(externalTrace, "getTracer");
    const globalMeter = vi.spyOn(externalMeter, "getMeter");
    trace.setGlobalTracerProvider(externalTrace);
    metrics.setGlobalMeterProvider(externalMeter);
    const parent = trace.wrapSpanContext({
      traceId: "1".repeat(32),
      spanId: "2".repeat(16),
      traceFlags: 1,
    });
    const manager = new AsyncLocalStorageContextManager().enable();
    context.setGlobalContextManager(manager);
    const disable = vi.spyOn(manager, "disable");
    try {
      const session = await context.with(trace.setSpan(ROOT_CONTEXT, parent), () =>
        bounded(
          createWorkerTelemetrySessionForTest(
            { failures: { enabled_module_import: new Error("reject") } },
            degraded,
          ),
        ),
      );
      expect(session.rootSpan.spanContext()).toEqual(INVALID_SPAN_CONTEXT);
      const tracer = session.getTracer("plugin");
      const child = tracer.startSpan("explicit", {}, trace.setSpan(ROOT_CONTEXT, parent));
      expect(child.isRecording()).toBe(false);
      expect(child.spanContext()).toEqual(parent.spanContext());
      expect(
        tracer.startSpan("root", { root: true }, trace.setSpan(ROOT_CONTEXT, parent)).spanContext(),
      ).toEqual(INVALID_SPAN_CONTEXT);
      await session.runInRootContext(async () => {
        await Promise.resolve();
        expect(trace.getSpan(context.active())).toBe(session.rootSpan);
        expect(tracer.startSpan("child").spanContext()).toEqual(INVALID_SPAN_CONTEXT);
        await tracer.startActiveSpan("active", async (span) => {
          await Promise.resolve();
          expect(trace.getSpan(context.active())).toBe(span);
          expect(span.isRecording()).toBe(false);
        });
      });
      session.getMeter("plugin").createHistogram("ignored").record(1);
      expect(globalTrace).not.toHaveBeenCalled();
      expect(globalMeter).not.toHaveBeenCalled();
      // Sensitivity: the unrelated global APIs really reach the recording sentinels.
      expect(trace.getTracer("sentinel").startSpan("sentinel").isRecording()).toBe(true);
      metrics.getMeter("sentinel").createCounter("sentinel").add(1);
      expect(globalTrace).toHaveBeenCalledTimes(1);
      expect(globalMeter).toHaveBeenCalledTimes(1);
      await bounded(session.finalize("done"));
      expect(disable).not.toHaveBeenCalled();
      await context.with(trace.setSpan(ROOT_CONTEXT, parent), async () => {
        await Promise.resolve();
        expect(trace.getSpan(context.active())).toBe(parent);
      });
    } finally {
      await externalTrace.shutdown();
      await externalMeter.shutdown();
    }
  },
);

test("disabled does not supply async propagation without a registered manager", async () => {
  const session = await WorkerTelemetrySession.create(false);
  await session.runInRootContext(async () => {
    expect(trace.getSpan(context.active())).toBeUndefined();
    await Promise.resolve();
    expect(trace.getSpan(context.active())).toBeUndefined();
    expect(trace.getSpan(session.rootContext)).toBe(session.rootSpan);
  });
  await bounded(session.finalize("done"));
});

test.each(["import rejection", "evaluation rejection", "import hook exception"])(
  "isolates %s with one warning and no acquisition",
  async (kind) => {
    const attempts: WorkerTelemetryTestAttempt[] = [];
    const acquisition = vi.spyOn(BasicTracerProvider.prototype, "getTracer");
    let evaluationError: unknown;
    const loadEnabledModule = vi.fn(async () => {
      if (kind === "evaluation rejection")
        try {
          const moduleUrl = "data:text/javascript,throw new Error('evaluation failed')";
          return await import(moduleUrl);
        } catch (error) {
          evaluationError = error;
          throw error;
        }
      throw new Error("resolution failed");
    });
    const session = await bounded(
      createWorkerTelemetrySessionForTest({
        loadEnabledModule,
        onAttempt(name) {
          attempts.push(name);
          if (kind === "import hook exception") throw new Error("hook failed");
        },
      }),
    );
    if (kind === "evaluation rejection") expect(evaluationError).toBeInstanceOf(Error);
    if (kind === "evaluation rejection")
      expect(String(evaluationError)).toContain("evaluation failed");
    expect(attempts).toEqual(["enabled_module_import"]);
    expect(loadEnabledModule).toHaveBeenCalledTimes(kind === "import hook exception" ? 0 : 1);
    expect(acquisition).not.toHaveBeenCalled();
    expect(session.rootSpan.spanContext()).toEqual(INVALID_SPAN_CONTEXT);
    expect(await bounded(session.finalize("application"))).toEqual({
      applicationResult: "application",
      initializationWarning: { code: "telemetry_initialization_failed", message: null },
    });
  },
);

test.each([
  ["provider_initialization", 0, 0, 0, 0, 0],
  ["trace_provider_construction", 0, 0, 1, 1, 0],
  ["meter_provider_construction", 1, 0, 1, 1, 0],
  ["context_manager_construction", 1, 1, 1, 1, 0],
  ["context_manager_enable", 1, 1, 1, 1, 1],
  ["context_manager_registration", 1, 1, 1, 1, 1],
  ["root_construction", 1, 1, 1, 1, 1],
  ["root_context_construction", 1, 1, 1, 1, 1],
] as const)(
  "cleans actual owned acquisitions once after %s, despite cleanup faults",
  async (stage, traceCount, meterCount, processorCount, readerCount, managerCount) => {
    const traceShutdown = vi.spyOn(BasicTracerProvider.prototype, "shutdown");
    const meterShutdown = vi.spyOn(MeterProvider.prototype, "shutdown");
    const processorShutdown = vi.spyOn(LocalSpanProcessor.prototype, "shutdown");
    const readerShutdown = vi.spyOn(LocalMetricReader.prototype, "shutdown");
    const managerDisable = vi.spyOn(AsyncLocalStorageContextManager.prototype, "disable");
    let root: Span | undefined;
    const original = BasicTracerProvider.prototype.getTracer;
    vi.spyOn(BasicTracerProvider.prototype, "getTracer").mockImplementation(function (...args) {
      const tracer = original.apply(this, args);
      const start = tracer.startSpan.bind(tracer);
      vi.spyOn(tracer, "startSpan").mockImplementation((...spanArgs) => {
        root = start(...spanArgs);
        vi.spyOn(root, "end");
        return root;
      });
      return tracer;
    });
    const session = await bounded(
      createWorkerTelemetrySessionForTest({
        failures: {
          [stage]: new Error("initialization fault"),
          initialization_trace_provider_cleanup: new Error("trace cleanup hook"),
          initialization_meter_provider_cleanup: new Error("meter cleanup hook"),
          initialization_context_manager_cleanup: new Error("manager cleanup hook"),
        },
      }),
    );
    expect(traceShutdown).toHaveBeenCalledTimes(traceCount);
    expect(meterShutdown).toHaveBeenCalledTimes(meterCount);
    expect(processorShutdown).toHaveBeenCalledTimes(processorCount);
    expect(readerShutdown).toHaveBeenCalledTimes(readerCount);
    expect(managerDisable).toHaveBeenCalledTimes(managerCount);
    if (stage === "root_context_construction") expect(root?.end).toHaveBeenCalledTimes(1);
    await bounded(session.finalize("original"));
    expect(traceShutdown).toHaveBeenCalledTimes(traceCount);
    expect(meterShutdown).toHaveBeenCalledTimes(meterCount);
    expect(session.recordingEnabled).toBe(false);
  },
);

test("actual rejected cleanup does not skip later owned resources", async () => {
  const originalTrace = BasicTracerProvider.prototype.shutdown;
  const originalMeter = MeterProvider.prototype.shutdown;
  vi.spyOn(BasicTracerProvider.prototype, "shutdown").mockImplementation(async function () {
    await originalTrace.call(this);
    throw new Error("trace cleanup rejection");
  });
  const meter = vi.spyOn(MeterProvider.prototype, "shutdown").mockImplementation(async function () {
    await originalMeter.call(this);
    throw new Error("meter cleanup rejection");
  });
  const manager = vi.spyOn(AsyncLocalStorageContextManager.prototype, "disable");
  const session = await bounded(
    createWorkerTelemetrySessionForTest({
      failures: { root_context_construction: new Error("root failed") },
    }),
  );
  expect(manager).toHaveBeenCalledTimes(1);
  expect(meter).toHaveBeenCalledTimes(1);
  expect((await bounded(session.finalize("application"))).applicationResult).toBe("application");
});

test.each(["enabled", "disabled", "degraded"] as const)(
  "memoizes reentrant, concurrent and repeated %s finalization",
  async (state) => {
    let reentrant: Promise<unknown> | undefined;
    let reentered = false;
    const reenter = () => {
      if (reentered) return;
      reentered = true;
      reentrant = session.finalize("reentrant");
    };
    const session = await bounded(
      createWorkerTelemetrySessionForTest(
        {
          failures: state === "degraded" ? { enabled_module_import: new Error("import") } : {},
          onAttempt(name) {
            if (name === "root_end") reenter();
          },
        },
        state !== "disabled",
      ),
    );
    const originalEnd = session.rootSpan.end.bind(session.rootSpan);
    const end = vi.spyOn(session.rootSpan, "end").mockImplementation(() => {
      reenter();
      originalEnd();
    });
    const original = { kind: "success" };
    const first = session.finalize(original);
    expect(session.finalize("concurrent")).toBe(first);
    const result = await bounded(first);
    expect(reentrant).toBe(first);
    expect(result.applicationResult).toBe(original);
    expect(await session.finalize("later")).toBe(result);
    expect(end).toHaveBeenCalledTimes(1);
  },
);

test("span snapshot failure preserves result and still collects and shuts down", async () => {
  const snapshot = vi.spyOn(LocalSpanProcessor.prototype, "snapshot").mockImplementation(() => {
    throw new Error("snapshot failed");
  });
  const shutdown = vi.spyOn(MeterProvider.prototype, "shutdown");
  const session = await WorkerTelemetrySession.create();
  const result = await bounded(session.finalize("original"));
  expect(snapshot).toHaveBeenCalledTimes(1);
  expect(shutdown).toHaveBeenCalledTimes(1);
  expect(result.applicationResult).toBe("original");
  expect(result.profileReport?.signalStatus.spans).toBe("unavailable");
  expect(result.profileReport?.signalStatus.counters).toBe("complete");
});
