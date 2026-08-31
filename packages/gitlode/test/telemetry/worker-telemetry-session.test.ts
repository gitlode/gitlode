import { getTelemetryMetricMetadata, TELEMETRY_SPANS } from "@gitlode/internal-contracts/telemetry";
import { ROOT_CONTEXT, context, metrics, trace, type Span } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createWorkerTelemetrySessionForTest,
  WorkerTelemetrySession,
  type WorkerTelemetryTestAttempt,
  type WorkerTelemetryTestHooks,
} from "../../src/execution/telemetry/index.js";

const finalizationStages: WorkerTelemetryTestAttempt[] = [
  "root_end",
  "trace_flush",
  "metric_collect",
  "report_build",
  "telemetry_shutdown",
];

function hooks(failures: WorkerTelemetryTestHooks["failures"] = {}): {
  hooks: WorkerTelemetryTestHooks;
  attempts: WorkerTelemetryTestAttempt[];
} {
  const attempts: WorkerTelemetryTestAttempt[] = [];
  return { hooks: { failures, onAttempt: (attempt) => attempts.push(attempt) }, attempts };
}

function lifecycle(
  report: NonNullable<Awaited<ReturnType<WorkerTelemetrySession["finalize"]>>["profileReport"]>,
) {
  return report.diagnostics.filter((diagnostic) => diagnostic.code === "lifecycle_failure");
}

function expectPlainCloneValues(value: unknown): void {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
  expect(typeof value).not.toBe("bigint");
  expect(typeof value).not.toBe("function");
  expect(value).not.toBeInstanceOf(Error);
  if (Array.isArray(value)) {
    for (const entry of value) expectPlainCloneValues(entry);
    return;
  }
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  for (const entry of Object.values(value as Record<string, unknown>))
    expectPlainCloneValues(entry);
}

beforeEach(() => context.disable());
afterEach(() => context.disable());

describe("WorkerTelemetrySession normal lifecycle", () => {
  test("uses explicit providers, a catalog root, and async root context", async () => {
    const globalTracerProvider = trace.getTracerProvider();
    const globalMeterProvider = metrics.getMeterProvider();
    const { hooks: testHooks, attempts } = hooks();
    const session = await createWorkerTelemetrySessionForTest(testHooks);
    const run = TELEMETRY_SPANS.find((span) => span.id === "run");
    const ambient = trace.wrapSpanContext({
      traceId: "1".repeat(32),
      spanId: "2".repeat(16),
      traceFlags: 1,
      isRemote: false,
    });
    let synchronousActive: Span | undefined;
    let awaitedActive: Span | undefined;

    await context.with(trace.setSpan(ROOT_CONTEXT, ambient), async () => {
      await session.runInRootContext(async () => {
        synchronousActive = trace.getSpan(context.active());
        await Promise.resolve();
        awaitedActive = trace.getSpan(context.active());
      });
    });

    expect(session.getTracer("test.scope", "1")).toBe(session.getTracer("test.scope", "1"));
    expect(session.getMeter("test.scope", "1")).toBe(session.getMeter("test.scope", "1"));
    expect(trace.getTracerProvider()).toBe(globalTracerProvider);
    expect(metrics.getMeterProvider()).toBe(globalMeterProvider);
    expect(run?.scope.type).toBe("core");
    expect(synchronousActive).toBe(session.rootSpan);
    expect(awaitedActive).toBe(session.rootSpan);
    expect(session.rootSpan.spanContext().traceId).not.toBe(ambient.spanContext().traceId);
    expect(session.rootSpan.isRecording()).toBe(true);

    const end = vi.spyOn(session.rootSpan, "end");
    expect(session.rootSpan.isRecording()).toBe(true);
    const applicationResult = { ok: true };
    const finalized = await session.finalize(applicationResult);
    expect(end).toHaveBeenCalledTimes(1);
    expect(session.rootSpan.isRecording()).toBe(false);
    expect(finalized.applicationResult).toBe(applicationResult);
    expect(finalized.profileReport).toMatchObject({
      schemaVersion: 1,
      signalStatus: { spans: "complete", counters: "complete", histograms: "complete" },
      counters: [],
      histograms: [],
    });
    expect(finalized.profileReport?.spans).toContainEqual(
      expect.objectContaining({
        name: run?.name,
        scope: { name: run?.scope.type === "core" ? run.scope.name : "", version: null },
        callCount: 1,
      }),
    );
    expect(attempts.filter((attempt) => finalizationStages.includes(attempt))).toEqual(
      finalizationStages,
    );
    expect(attempts.filter((attempt) => attempt === "context_manager_cleanup")).toHaveLength(1);
  });

  test("collects actual spans and metrics into a structured-clone-safe report", async () => {
    const session = await WorkerTelemetrySession.create();
    const child = TELEMETRY_SPANS.find((span) => span.id === "repository_access_validate");
    const counter = getTelemetryMetricMetadata("output_file_created");

    await session.runInRootContext(async () => {
      const span = session
        .getTracer(child?.scope.type === "core" ? child.scope.name : "unexpected")
        .startSpan(child?.name ?? "unexpected");
      span.end();
      session
        .getMeter(counter.scope.type === "core" ? counter.scope.name : "unexpected")
        .createCounter(counter.name, { description: counter.description, unit: counter.unit })
        .add(2);
      await Promise.resolve();
    });

    const result = await session.finalize("done");
    const report = result.profileReport;
    expect(report?.spans.map((span) => span.name)).toEqual(
      expect.arrayContaining(["gitlode.run", child?.name]),
    );
    expect(report?.counters).toContainEqual(
      expect.objectContaining({ name: counter.name, value: 2, unit: counter.unit }),
    );
    expect(structuredClone(report)).toEqual(report);
    expectPlainCloneValues(report);
  });

  test("memoizes concurrent finalization before asynchronous work and keeps the first result", async () => {
    const { hooks: testHooks, attempts } = hooks();
    const session = await createWorkerTelemetrySessionForTest(testHooks);
    const end = vi.spyOn(session.rootSpan, "end");
    const first = { value: 1 };
    const second = { value: 2 };
    const firstPromise = session.finalize(first);
    const secondPromise = session.finalize(second);
    expect(secondPromise).toBe(firstPromise);
    const [firstFinalization, secondFinalization] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);
    expect(secondFinalization).toBe(firstFinalization);
    expect(firstFinalization.applicationResult).toBe(first);
    expect(session.finalize(Symbol("later"))).toBe(firstPromise);
    expect(end).toHaveBeenCalledTimes(1);
    expect(attempts.filter((attempt) => attempt === "metric_collect")).toHaveLength(1);
    for (const resource of [
      "trace_provider_shutdown",
      "meter_provider_shutdown",
      "context_manager_cleanup",
    ] as const)
      expect(attempts.filter((attempt) => attempt === resource)).toHaveLength(1);
  });
});

describe("WorkerTelemetrySession context manager ownership", () => {
  test("uses but does not replace or disable an existing compatible manager", async () => {
    const existing = new AsyncLocalStorageContextManager().enable();
    const disable = vi.spyOn(existing, "disable");
    expect(context.setGlobalContextManager(existing)).toBe(true);
    const { hooks: testHooks, attempts } = hooks();
    const session = await createWorkerTelemetrySessionForTest(testHooks);

    await session.runInRootContext(async () => {
      await Promise.resolve();
      expect(trace.getSpan(context.active())).toBe(session.rootSpan);
    });
    await session.finalize("done");

    expect(disable).not.toHaveBeenCalled();
    expect(attempts).not.toContain("context_manager_cleanup");
    expect(
      attempts.filter((attempt) => attempt === "initialization_context_manager_cleanup"),
    ).toHaveLength(1);
    const marker = ROOT_CONTEXT.setValue(Symbol.for("gitlode.test.context"), "existing");
    await context.with(marker, async () => {
      await Promise.resolve();
      expect(context.active()).toBe(marker);
    });
    context.disable();
    expect(disable).toHaveBeenCalledTimes(1);
  });
});

describe("WorkerTelemetrySession initialization degradation", () => {
  test.each([
    ["trace_provider_construction", "provider failed"],
    ["meter_provider_construction", "m".repeat(700)],
    ["context_manager_construction", new Error("private path C:/secret")],
    ["context_manager_enable", Symbol("context enable")],
    ["context_manager_registration", "registration failed"],
  ] as const)("degrades without rejecting after %s failure", async (stage, failure) => {
    const { hooks: testHooks, attempts } = hooks({ [stage]: failure });
    const session = await createWorkerTelemetrySessionForTest(testHooks);
    let ran = false;
    await session.runInRootContext(async () => {
      ran = true;
      await Promise.resolve();
    });
    const applicationResult = { type: "typed_failure", detail: new Error("application secret") };
    const finalization = session.finalize(applicationResult);
    await expect(finalization).resolves.toBeDefined();
    const finalized = await finalization;

    expect(ran).toBe(true);
    expect(finalized.applicationResult).toBe(applicationResult);
    expect(finalized.profileReport).toBeUndefined();
    expect(finalized.initializationWarning?.code).toBe("telemetry_initialization_failed");
    expect(finalized.initializationWarning?.message?.length ?? 0).toBeLessThanOrEqual(512);
    expect(finalized.initializationWarning?.message).toBe(
      typeof failure === "string" ? failure.slice(0, 512) : null,
    );
    expect(finalized.initializationWarning).not.toHaveProperty("error");
    expect(session.finalize(Symbol("later"))).toBe(finalization);
    expect(attempts).toContain("initialization_trace_provider_cleanup");
    expect(attempts).toContain("initialization_meter_provider_cleanup");
    if (stage === "context_manager_enable" || stage === "context_manager_registration")
      expect(attempts).toContain("initialization_context_manager_cleanup");
  });

  test("treats existing-manager registration refusal as a normal initialized session", async () => {
    const existing = new AsyncLocalStorageContextManager().enable();
    expect(context.setGlobalContextManager(existing)).toBe(true);
    const session = await WorkerTelemetrySession.create();
    const result = await session.finalize("done");
    expect(result.initializationWarning).toBeUndefined();
    expect(result.profileReport).toBeDefined();
  });
});

describe("WorkerTelemetrySession best-effort finalization", () => {
  test("guards an actual root span end exception and does not retry it", async () => {
    const { hooks: testHooks, attempts } = hooks();
    const session = await createWorkerTelemetrySessionForTest(testHooks);
    const end = vi.spyOn(session.rootSpan, "end").mockImplementation(() => {
      throw new Error("root end failed");
    });
    const applicationResult = { ok: false };

    const finalization = session.finalize(applicationResult);
    await expect(finalization).resolves.toBeDefined();
    const finalized = await finalization;
    expect(finalized.applicationResult).toBe(applicationResult);
    expect(finalized.profileReport?.signalStatus.spans).toBe("partial");
    expect(lifecycle(finalized.profileReport!)).toContainEqual(
      expect.objectContaining({ stage: "trace_flush", signal: "spans", message: null }),
    );
    expect(end).toHaveBeenCalledTimes(1);
    expect(attempts.filter((attempt) => finalizationStages.includes(attempt))).toEqual(
      finalizationStages,
    );
  });

  test.each([
    ["root_end", "trace_flush", "spans", "partial"],
    ["trace_flush", "trace_flush", "spans", "partial"],
    ["metric_collect", "metric_collection", "counters", "unavailable"],
    ["report_build", "report_build", "report", "complete"],
  ] as const)(
    "preserves the result and later stages after %s failure",
    async (fault, diagnosticStage, signal, expectedSignalStatus) => {
      const { hooks: testHooks, attempts } = hooks({ [fault]: "x".repeat(700) });
      const session = await createWorkerTelemetrySessionForTest(testHooks);
      const result = { identity: fault };
      const finalization = session.finalize(result);
      await expect(finalization).resolves.toBeDefined();
      const finalized = await finalization;

      expect(finalized.applicationResult).toBe(result);
      expect(finalized.profileReport).toBeDefined();
      expect(attempts.filter((attempt) => finalizationStages.includes(attempt))).toEqual(
        finalizationStages,
      );
      const diagnostic = lifecycle(finalized.profileReport!).find(
        (entry) => entry.stage === diagnosticStage && entry.signal === signal,
      );
      expect(diagnostic?.message).toHaveLength(512);
      if (signal === "spans")
        expect(finalized.profileReport?.signalStatus.spans).toBe(expectedSignalStatus);
      if (signal === "counters") {
        expect(finalized.profileReport?.signalStatus.counters).toBe(expectedSignalStatus);
        expect(finalized.profileReport?.signalStatus.histograms).toBe("unavailable");
        expect(finalized.profileReport?.counters).toEqual([]);
        expect(finalized.profileReport?.histograms).toEqual([]);
      }
      if (signal === "report") expect(finalized.profileReport?.signalStatus.spans).toBe("complete");
    },
  );

  test("deduplicates multiple shutdown failures and preserves the built signals", async () => {
    const { hooks: testHooks, attempts } = hooks({
      trace_provider_shutdown: "shutdown",
      meter_provider_shutdown: "shutdown",
      context_manager_cleanup: "shutdown",
    });
    const session = await createWorkerTelemetrySessionForTest(testHooks);
    const finalized = await session.finalize(Symbol.for("application-result"));
    const report = finalized.profileReport!;
    const shutdown = lifecycle(report).find(
      (entry) => entry.stage === "telemetry_shutdown" && entry.signal === "telemetry",
    );

    expect(finalized.applicationResult).toBe(Symbol.for("application-result"));
    expect(report.spans).toContainEqual(expect.objectContaining({ name: "gitlode.run" }));
    expect(report.signalStatus).toEqual({
      spans: "complete",
      counters: "complete",
      histograms: "complete",
    });
    expect(shutdown).toMatchObject({ message: "shutdown", count: 3 });
    for (const resource of [
      "trace_provider_shutdown",
      "meter_provider_shutdown",
      "context_manager_cleanup",
    ] as const)
      expect(attempts.filter((attempt) => attempt === resource)).toHaveLength(1);
  });

  test.each([
    "trace_provider_shutdown",
    "meter_provider_shutdown",
    "context_manager_cleanup",
    "telemetry_shutdown",
  ] as const)("isolates an individual %s failure", async (fault) => {
    const { hooks: testHooks, attempts } = hooks({ [fault]: Symbol(fault) });
    const session = await createWorkerTelemetrySessionForTest(testHooks);
    const applicationResult = new Error("application result");
    const finalized = await session.finalize(applicationResult);

    expect(finalized.applicationResult).toBe(applicationResult);
    expect(finalized.profileReport?.spans).toContainEqual(
      expect.objectContaining({ name: "gitlode.run" }),
    );
    expect(lifecycle(finalized.profileReport!)).toContainEqual(
      expect.objectContaining({
        stage: "telemetry_shutdown",
        signal: "telemetry",
        message: null,
      }),
    );
    expect(attempts.filter((attempt) => finalizationStages.includes(attempt))).toEqual(
      finalizationStages,
    );
  });

  test.each([
    { kind: "object" },
    Symbol("result"),
    { name: "Error", message: "application value", stack: "do not inspect" },
    { type: "user_error" as const, reason: "typed" },
  ])("preserves arbitrary application result identity", async (applicationResult) => {
    const session = await createWorkerTelemetrySessionForTest({
      failures: { trace_flush: new Error("telemetry failed") },
    });
    const finalized = await session.finalize(applicationResult);
    expect(finalized.applicationResult).toBe(applicationResult);
    expect(lifecycle(finalized.profileReport!)).toContainEqual(
      expect.objectContaining({ stage: "trace_flush", signal: "spans", message: null }),
    );
    expect(JSON.stringify(finalized.profileReport)).not.toContain("application value");
  });
});
