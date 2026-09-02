import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { AbsoluteDirectoryPath } from "@gitlode/internal-foundation/support";
import { context, metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigExtensionsSection } from "../../src/config/index.js";
import type {
  Namespace,
  PluginInitResult,
  PluginRuntimeContext,
} from "../../src/plugin-api/index.js";
import {
  checkPluginCompatibility,
  initializePlugins,
  resolvePluginEntries,
  NOOP_PLUGIN_PROJECTION_METRIC_RECORDER,
  type PluginEntry,
  type PluginRuntimeEntry,
} from "../../src/plugin-runtime/index.js";
import { makeTracer } from "../support/otel-fakes.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRuntimeContext(overrides: Partial<PluginRuntimeContext> = {}): PluginRuntimeContext {
  return {
    warn() {},
    error() {},
    tracer: trace.getTracer("test.plugin"),
    meter: metrics.getMeter("test.plugin"),
    ...overrides,
  };
}

type UnboundPluginEntry = Omit<PluginEntry, "entrypoint" | "resolvedEntrypointUrl">;

function bindEntry(
  entry: UnboundPluginEntry,
  runtimeContext: PluginRuntimeContext = makeRuntimeContext(),
): PluginRuntimeEntry {
  return {
    ...entry,
    entrypoint: "./plugin.mjs",
    resolvedEntrypointUrl: "file:///plugin.mjs",
    tracer: runtimeContext.tracer,
    meter: runtimeContext.meter,
    runtimeContext,
    projectionMetricRecorder: NOOP_PLUGIN_PROJECTION_METRIC_RECORDER,
  };
}

function makeExtensions(entrypoint = "./plugin.mjs"): ConfigExtensionsSection {
  return {
    "test-plugin": {
      entrypoint,
      failurePolicy: "skip-fact",
    },
  };
}

describe("resolvePluginEntries", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-plugins-resolve-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("loads a relative entrypoint and returns PluginEntry values", async () => {
    await writeFile(
      join(tmpDir, "plugin.mjs"),
      `export default async function factory() {
        return { init: async () => ({ type: "ready" }), project: async () => ({ type: "success", data: {} }) };
      }`,
    );

    const result = await resolvePluginEntries(makeExtensions(), tmpDir as AbsoluteDirectoryPath);
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") {
      throw new Error("Expected resolved plugin entries");
    }

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.namespace).toBe("test-plugin");
    expect(typeof result.entries[0]!.plugin.project).toBe("function");
  });

  it("returns user-error termination when default export is missing", async () => {
    await writeFile(join(tmpDir, "plugin.mjs"), "export const noop = 1;");

    await expect(
      resolvePluginEntries(makeExtensions(), join(tmpDir, "gitlode.config.json")),
    ).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns user-error termination when factory does not return ProjectorPlugin", async () => {
    await writeFile(
      join(tmpDir, "plugin.mjs"),
      "export default async function factory() { return null; }",
    );

    await expect(
      resolvePluginEntries(makeExtensions(), join(tmpDir, "gitlode.config.json")),
    ).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });
});

describe("initializePlugins", () => {
  it("returns ready outcomes when all init() calls are ready", async () => {
    const entries: UnboundPluginEntry[] = [
      {
        namespace: "a" as Namespace,
        plugin: {
          init: async (): Promise<PluginInitResult> => ({ type: "ready" }),
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    const runtimeEntries = entries.map((entry) => bindEntry(entry));
    await expect(initializePlugins(runtimeEntries, context.active())).resolves.toEqual([
      {
        entry: runtimeEntries[0],
        type: "ready",
      },
    ]);
  });

  it.each([
    { label: "unknown type", result: { type: "unknown" } },
    { label: "unbounded type", result: { type: "x".repeat(1000) } },
    { label: "null", result: null },
    { label: "undefined", result: undefined },
  ])("keeps $label normal returns outside init telemetry", async ({ result }) => {
    const recording = makeTracer();
    const errors: string[] = [];
    const runtime = makeRuntimeContext({
      tracer: recording.tracer,
      error: (message) => errors.push(message),
    });
    const entry = bindEntry(
      {
        namespace: "invalid" as Namespace,
        plugin: {
          init: async () => result,
          project: async () => ({ type: "skip" }),
        } as unknown as UnboundPluginEntry["plugin"],
        failurePolicy: "skip-fact",
      },
      runtime,
    );
    await expect(initializePlugins([entry], context.active())).resolves.toEqual([
      { entry, ...(result ?? {}) },
    ]);
    expect(errors).toEqual([]);
    expect(recording.starts[0]!.span.attributes).toEqual({});
    expect(recording.starts[0]!.span.statuses).toEqual([]);
    expect(recording.starts[0]!.span.exceptions).toEqual([]);
    expect(recording.starts[0]!.span.endCount).toBe(1);
  });

  it("passes runtime warn/error to plugin init", async () => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const entries: UnboundPluginEntry[] = [
      {
        namespace: "runtime-test" as Namespace,
        plugin: {
          init: async (runtime) => {
            runtime.warn("warn message");
            runtime.error("error message");
            return { type: "ready" };
          },
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    const runtimeEntries = entries.map((entry) =>
      bindEntry(
        entry,
        makeRuntimeContext({
          warn(message) {
            warnings.push(message);
          },
          error(message) {
            errors.push(message);
          },
        }),
      ),
    );
    const results = await initializePlugins(runtimeEntries, context.active());

    expect(results).toEqual([
      {
        entry: runtimeEntries[0],
        type: "ready",
      },
    ]);
    expect(warnings).toEqual(["warn message"]);
    expect(errors).toEqual(["error message"]);
  });

  it("returns fatal outcome when init returns fatal", async () => {
    const entries: UnboundPluginEntry[] = [
      {
        namespace: "bad" as Namespace,
        plugin: {
          init: async (): Promise<PluginInitResult> => ({ type: "fatal" }),
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    const runtimeEntries = entries.map((entry) => bindEntry(entry));
    await expect(initializePlugins(runtimeEntries, context.active())).resolves.toEqual([
      {
        entry: runtimeEntries[0],
        type: "fatal",
      },
    ]);
  });

  it("returns fatal outcome when init throws", async () => {
    const entries: UnboundPluginEntry[] = [
      {
        namespace: "thrower" as Namespace,
        plugin: {
          init: async () => {
            throw new Error("boom");
          },
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    const runtimeEntries = entries.map((entry) => bindEntry(entry));
    await expect(initializePlugins(runtimeEntries, context.active())).resolves.toEqual([
      {
        entry: runtimeEntries[0],
        type: "fatal",
      },
    ]);
  });

  it("records returned fatal without a synthetic exception", async () => {
    const recording = makeTracer();
    const runtime = makeRuntimeContext({ tracer: recording.tracer });
    const entry = bindEntry(
      {
        namespace: "fatal" as Namespace,
        plugin: {
          init: async () => ({ type: "fatal" }),
          project: async () => ({ type: "skip" }),
        },
        failurePolicy: "skip-fact",
      },
      runtime,
    );
    await initializePlugins([entry], context.active());
    const span = recording.starts[0]!.span;
    expect(span.attributes).toEqual({
      "gitlode.plugin.init.result": "fatal",
      "gitlode.plugin.init.failure.source": "returned",
    });
    expect(span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
    expect(span.exceptions).toEqual([]);
    expect(span.endCount).toBe(1);
  });

  it.each([
    { label: "Error", thrown: new Error("boom"), recorded: new Error("boom") },
    {
      label: "non-Error",
      thrown: 42,
      recorded: { name: "NonErrorThrown", message: "42" },
    },
  ])("records a thrown $label exactly once before normalization", async ({ thrown, recorded }) => {
    const recording = makeTracer();
    const runtimeErrors: string[] = [];
    const runtime = makeRuntimeContext({
      tracer: recording.tracer,
      error(message) {
        runtimeErrors.push(message);
      },
    });
    const entry = bindEntry(
      {
        namespace: "throwing" as Namespace,
        plugin: {
          init: async () => {
            throw thrown;
          },
          project: async () => ({ type: "skip" }),
        },
        failurePolicy: "skip-fact",
      },
      runtime,
    );
    await expect(initializePlugins([entry], context.active())).resolves.toEqual([
      { entry, type: "fatal" },
    ]);
    const span = recording.starts[0]!.span;
    expect(span.attributes).toEqual({
      "gitlode.plugin.init.result": "fatal",
      "gitlode.plugin.init.failure.source": "thrown",
    });
    expect(span.statuses).toEqual([{ code: SpanStatusCode.ERROR }]);
    expect(span.exceptions).toEqual([recorded]);
    expect(span.endCount).toBe(1);
    expect(runtimeErrors).toEqual([thrown instanceof Error ? thrown.message : String(thrown)]);
  });

  it("keeps the explicit bootstrap parent for parallel init", async () => {
    const recording = makeTracer();
    const parentRecording = makeTracer();
    const bootstrapSpan = parentRecording.tracer.startSpan("bootstrap");
    const parentContext = trace.setSpan(context.active(), bootstrapSpan);
    const makeParallelEntry = (namespace: string) => {
      const runtime = makeRuntimeContext({ tracer: recording.tracer });
      return bindEntry(
        {
          namespace: namespace as Namespace,
          plugin: {
            init: async () => {
              await Promise.resolve();
              return { type: "ready" };
            },
            project: async () => ({ type: "skip" }),
          },
          failurePolicy: "skip-fact",
        },
        runtime,
      );
    };
    await initializePlugins([makeParallelEntry("one"), makeParallelEntry("two")], parentContext);
    expect(recording.starts).toHaveLength(2);
    for (const start of recording.starts) {
      expect(trace.getSpan(start.parent!)).toBe(bootstrapSpan);
      expect(start.span.endCount).toBe(1);
    }
  });
});

describe("checkPluginCompatibility", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-compat-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeEntry(namespace: string): PluginEntry {
    return {
      namespace: namespace as PluginEntry["namespace"],
      plugin: {
        init: async () => ({ type: "ready" }),
        project: async () => ({ type: "success", data: {} }),
      },
      failurePolicy: "skip-fact",
      entrypoint: "./plugin.mjs",
      resolvedEntrypointUrl: pathToFileURL(join(tmpDir, "plugin.mjs")).href,
    };
  }

  it("emits no warning when range is satisfied", async () => {
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-plugin", peerDependencies: { gitlode: ">=0.0.0" } }),
    );

    const warnings: string[] = [];
    await checkPluginCompatibility([makeEntry("test-plugin")], {
      warn(message) {
        warnings.push(message);
      },
    });

    expect(warnings).toEqual([]);
  });

  it("emits mismatch warning when range is not satisfied", async () => {
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-plugin", peerDependencies: { gitlode: ">=999.0.0" } }),
    );

    const warnings: string[] = [];
    await checkPluginCompatibility([makeEntry("test-plugin")], {
      warn(message) {
        warnings.push(message);
      },
    });

    expect(warnings.join("\n")).toMatch(/declares peer gitlode/);
  });

  it("emits compatibility unknown warning when peerDependencies.gitlode is absent", async () => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ name: "test-plugin" }));

    const warnings: string[] = [];
    await checkPluginCompatibility([makeEntry("test-plugin")], {
      warn(message) {
        warnings.push(message);
      },
    });

    expect(warnings.join("\n")).toMatch(/does not declare peerDependencies\.gitlode/);
  });

  it("emits skipped warning when package metadata cannot be read", async () => {
    await writeFile(join(tmpDir, "package.json"), "NOT VALID JSON {{{");

    const warnings: string[] = [];
    await checkPluginCompatibility([makeEntry("test-plugin")], {
      warn(message) {
        warnings.push(message);
      },
    });

    expect(warnings.join("\n")).toMatch(/compatibility check skipped/);
  });

  it("supports empty entries when config has no extensions", async () => {
    const warnings: string[] = [];
    await checkPluginCompatibility([], {
      warn(message) {
        warnings.push(message);
      },
    });
    expect(warnings).toEqual([]);
  });
});
