import type { Diagnostic } from "@gitlode/internal-contracts/diagnostics";
import type { FactProjector } from "@gitlode/internal-contracts/extraction";
import type { ProgressEvent } from "@gitlode/internal-contracts/progress";
import type { AbsoluteDirectoryPath } from "@gitlode/internal-foundation/support";
import { context, metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Namespace } from "../../src/plugin-api/index.js";

const pluginRuntime = vi.hoisted(() => ({
  checkPluginCompatibility: vi.fn(),
  initializePlugins: vi.fn(),
  resolvePluginEntries: vi.fn(),
}));

vi.mock("../../src/plugin-runtime/index.js", () => ({
  ...pluginRuntime,
  createPluginProjectionMetricRecorder: () => ({
    startProjection: () => ({}),
    completeProjection() {},
  }),
  EnrichingFactProjector: class EnrichingFactProjector {},
}));

import { buildPluginProjector } from "../../src/execution/plugin-bootstrap.js";
import { makeTracer } from "../support/otel-fakes.js";

const namespace = "test-plugin" as Namespace;
const pluginEntry = {
  namespace,
  failurePolicy: "skip-fact" as const,
  plugin: { init: vi.fn(), project: vi.fn() },
  entrypoint: "./plugin.js",
  resolvedEntrypointUrl: "file:///plugin.js",
};
const declarations = {
  [namespace]: { entrypoint: "./plugin.js", failurePolicy: "skip-fact" as const },
};
const baseProjector = {} as FactProjector;

function recordingTelemetry(core: ReturnType<typeof makeTracer>) {
  return {
    pluginRuntimeTracer: core.tracer,
    projectionTracer: trace.getTracer("gitlode.extraction"),
    rootContext: context.active(),
    getPluginTracer: (name: string, version?: string) => trace.getTracer(name, version),
    getPluginMeter: (name: string, version?: string) => metrics.getMeter(name, version),
  };
}

describe("buildPluginProjector reporter wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginRuntime.resolvePluginEntries.mockResolvedValue({
      kind: "resolved",
      entries: [pluginEntry],
    });
  });

  it("routes compatibility and initialization diagnostics separately from plugin phase progress", async () => {
    pluginRuntime.checkPluginCompatibility.mockImplementation(async (entries, reporter) => {
      reporter.warn("compatibility warning");
      return {
        warningCount: 1,
        resolutions: entries.map((entry) => ({
          entry,
          packageResolution: { scope: { name: "test-plugin", version: "1.0.0" } },
        })),
      };
    });
    pluginRuntime.initializePlugins.mockImplementation(async (entries) => {
      entries[0].runtimeContext.warn("initialization warning");
      entries[0].runtimeContext.error("initialization error");
      return [{ entry: entries[0], type: "ready" }];
    });

    const progressEvents: ProgressEvent[] = [];
    const diagnostics: Diagnostic[] = [];
    const result = await buildPluginProjector(
      declarations,
      "/plugins" as AbsoluteDirectoryPath,
      baseProjector,
      {
        progressReporter: { emit: (event) => progressEvents.push(event) },
        diagnosticReporter: { report: (diagnostic) => diagnostics.push(diagnostic) },
      },
      {
        pluginRuntimeTracer: trace.getTracer("gitlode.plugin_runtime"),
        projectionTracer: trace.getTracer("gitlode.extraction"),
        rootContext: context.active(),
        getPluginTracer: (name, version) => trace.getTracer(name, version),
        getPluginMeter: (name, version) => metrics.getMeter(name, version),
      },
    );

    expect(result.kind).toBe("success");
    expect(progressEvents).toEqual([
      { type: "phase-start", phase: "initializing-plugins" },
      { type: "phase-end", phase: "initializing-plugins" },
    ]);
    expect(diagnostics).toEqual([
      { severity: "warn", message: "compatibility warning" },
      { severity: "warn", message: 'Plugin "test-plugin": initialization warning' },
      { severity: "error", message: 'Plugin "test-plugin": initialization error' },
    ]);
  });

  it("marks resolve typed termination without recording an exception", async () => {
    pluginRuntime.resolvePluginEntries.mockResolvedValue({
      kind: "termination",
      termination: { kind: "user-error", message: "invalid plugin" },
    });
    const core = makeTracer();
    const result = await buildPluginProjector(
      declarations,
      "/plugins" as AbsoluteDirectoryPath,
      baseProjector,
      { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
      recordingTelemetry(core),
    );
    expect(result).toEqual({ kind: "termination", message: "invalid plugin" });
    expect(core.starts.map((start) => start.name)).toEqual([
      "gitlode.plugin.bootstrap",
      "gitlode.plugin.resolve",
    ]);
    for (const start of core.starts) {
      expect(start.span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
      expect(start.span.exceptions).toEqual([]);
      expect(start.span.endCount).toBe(1);
    }
  });

  it("records the original resolve runtime exception once on each failing owner span", async () => {
    const thrown = new Error("unexpected resolver failure");
    pluginRuntime.resolvePluginEntries.mockRejectedValue(thrown);
    const core = makeTracer();
    await expect(
      buildPluginProjector(
        declarations,
        "/plugins" as AbsoluteDirectoryPath,
        baseProjector,
        { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
        recordingTelemetry(core),
      ),
    ).rejects.toBe(thrown);
    expect(core.starts.map((start) => start.name)).toEqual([
      "gitlode.plugin.bootstrap",
      "gitlode.plugin.resolve",
    ]);
    for (const start of core.starts) {
      expect(start.span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
      expect(start.span.exceptions).toEqual([thrown]);
      expect(start.span.endCount).toBe(1);
    }
  });

  it("records resolved, ready, and failed counts for init termination", async () => {
    pluginRuntime.checkPluginCompatibility.mockResolvedValue({
      warningCount: 0,
      resolutions: [
        {
          entry: pluginEntry,
          packageResolution: { scope: { name: "test-plugin", version: "1.0.0" } },
        },
      ],
    });
    pluginRuntime.initializePlugins.mockImplementation(async (entries) => [
      { entry: entries[0], type: "fatal" },
    ]);
    const core = makeTracer();
    const result = await buildPluginProjector(
      declarations,
      "/plugins" as AbsoluteDirectoryPath,
      baseProjector,
      { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
      recordingTelemetry(core),
    );
    expect(result).toEqual({
      kind: "termination",
      message: 'Plugin "test-plugin" init failed.',
    });
    const bootstrap = core.starts[0]!.span;
    expect(bootstrap.attributes).toEqual({
      "gitlode.plugin.resolved.count": 1,
      "gitlode.plugin.ready.count": 0,
      "gitlode.plugin.failed.count": 1,
    });
    expect(bootstrap.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
    expect(bootstrap.exceptions).toEqual([]);
    expect(bootstrap.endCount).toBe(1);
  });
});
