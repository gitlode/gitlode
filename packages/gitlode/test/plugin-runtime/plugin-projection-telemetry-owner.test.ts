import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type { Fact, FactProjector, ProjectedRecord } from "@gitlode/internal-contracts/extraction";
import type { CommitOid } from "@gitlode/internal-contracts/model";
import { createMonotonicTiming } from "@gitlode/internal-contracts/telemetry";
import { context, metrics, SpanStatusCode, trace, type Meter } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import type { Namespace, ProjectorPlugin } from "../../src/plugin-api/index.js";
import {
  createPluginProjectionMetricRecorder,
  EnrichingFactProjector,
  type PluginRuntimeEntry,
} from "../../src/plugin-runtime/index.js";
import { makeTracer } from "../support/otel-fakes.js";

type MetricCall = { readonly name: string; readonly value: number; readonly attributes?: unknown };

class RecordingMeter {
  readonly calls: MetricCall[] = [];
  readonly creations: string[] = [];

  createCounter(name: string) {
    this.creations.push(name);
    return {
      add: (value: number, attributes?: unknown) => this.calls.push({ name, value, attributes }),
    };
  }

  createHistogram(name: string) {
    this.creations.push(name);
    return {
      record: (value: number, attributes?: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
}

function commitFact(suffix = "a"): Fact {
  return {
    type: "commit",
    oid: suffix.repeat(40) as CommitOid,
    message: "message",
    author: { name: "a", email: "a@example.com", timestamp: 0, timezoneOffset: 0 },
    committer: { name: "c", email: "c@example.com", timestamp: 0, timezoneOffset: 0 },
    parents: [],
    repository: { name: "repo", url: null },
  };
}

function fileChangeFact(): Fact {
  return {
    type: "file-change",
    commit: commitFact() as Extract<Fact, { type: "commit" }>,
    file: {
      path: "src/example.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
    },
  };
}

function recordFor(fact: Fact): ProjectedRecord {
  const commit = fact.type === "commit" ? fact : fact.commit;
  const record: ProjectedRecord = {
    oid: commit.oid,
    message: commit.message,
    author: { name: "a", email: "a@example.com", timestamp: "1970-01-01T00:00:00Z" },
    committer: { name: "c", email: "c@example.com", timestamp: "1970-01-01T00:00:00Z" },
    parents: [],
    repository: { name: "repo", url: null },
  };
  return fact.type === "file-change" ? { ...record, file: fact.file } : record;
}

function baseProjector(onProject?: () => void): FactProjector {
  return {
    async *project(facts: AsyncIterable<Fact>) {
      for await (const fact of facts) {
        onProject?.();
        yield recordFor(fact);
      }
    },
  };
}

async function* facts(count = 1): AsyncIterable<Fact> {
  for (let index = 0; index < count; index++) yield commitFact(String.fromCharCode(97 + index));
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of source) values.push(value);
  return values;
}

function runtimeEntry(
  plugin: ProjectorPlugin,
  failurePolicy: "skip-fact" | "fatal",
  meter: RecordingMeter,
  clock: () => number = (() => {
    let value = 0;
    return () => value++ * 1000;
  })(),
): PluginRuntimeEntry {
  const pluginTracer = trace.getTracer("example-plugin");
  const pluginMeter = meter as unknown as Meter;
  return {
    namespace: "example" as Namespace,
    plugin,
    failurePolicy,
    entrypoint: "./plugin.js",
    resolvedEntrypointUrl: "file:///plugin.js",
    tracer: pluginTracer,
    meter: pluginMeter,
    runtimeContext: { warn() {}, error() {}, tracer: pluginTracer, meter: pluginMeter },
    projectionMetricRecorder: createPluginProjectionMetricRecorder(
      pluginMeter,
      createMonotonicTiming(clock),
    ),
  };
}

describe("EnrichingFactProjector telemetry owner", () => {
  it.each([
    {
      label: "success",
      policy: "skip-fact" as const,
      invoke: async () => ({ type: "success" as const, data: { ok: true } }),
      outcome: "success",
      rejects: false,
      error: false,
    },
    {
      label: "skip",
      policy: "skip-fact" as const,
      invoke: async () => ({ type: "skip" as const }),
      outcome: "skip",
      rejects: false,
      error: false,
    },
    {
      label: "returned fatal continued",
      policy: "skip-fact" as const,
      invoke: async () => ({ type: "fatal" as const }),
      outcome: "failure_continued",
      rejects: false,
      error: false,
    },
    {
      label: "returned fatal aborted",
      policy: "fatal" as const,
      invoke: async () => ({ type: "fatal" as const }),
      outcome: "failure_aborted",
      rejects: true,
      error: true,
      exceptions: 0,
    },
    {
      label: "thrown continued",
      policy: "skip-fact" as const,
      invoke: async () => {
        throw new Error("continued");
      },
      outcome: "failure_continued",
      rejects: false,
      error: false,
    },
    {
      label: "thrown aborted",
      policy: "fatal" as const,
      invoke: async () => {
        throw "aborted";
      },
      outcome: "failure_aborted",
      rejects: true,
      error: true,
      exceptions: 1,
    },
  ])(
    "records $label exactly once",
    async ({ policy, invoke, outcome, rejects, error, exceptions }) => {
      const meter = new RecordingMeter();
      const tracer = makeTracer();
      const plugin: ProjectorPlugin = {
        init: async () => ({ type: "ready" }),
        project: invoke,
      };
      const projector = new EnrichingFactProjector(
        baseProjector(),
        [runtimeEntry(plugin, policy, meter)],
        { report() {} },
        tracer.tracer,
      );
      const operation = collect(projector.project(facts(), context.active()));
      if (rejects) await expect(operation).rejects.toThrow();
      else await expect(operation).resolves.toHaveLength(1);

      const attributes = {
        "gitlode.projection.fact.type": "commit",
        "gitlode.plugin.projection.outcome": outcome,
      };
      expect(meter.calls).toEqual([
        { name: "gitlode.plugin.projection.operation", value: 1, attributes },
        { name: "gitlode.plugin.projection.duration", value: 1, attributes },
      ]);
      expect(meter.creations).toEqual([
        "gitlode.plugin.projection.operation",
        "gitlode.plugin.projection.duration",
      ]);
      expect(tracer.starts.map((start) => start.name)).toEqual(["gitlode.projection"]);
      const span = tracer.starts[0]!.span;
      expect(span.attributes).toEqual({
        "gitlode.projection.mode": "plugin_enriched",
        "gitlode.stream.completion": rejects ? "error" : "exhausted",
      });
      expect(span.endCount).toBe(1);
      expect(span.statuses).toEqual(error ? [{ code: SpanStatusCode.ERROR }] : []);
      expect(span.exceptions).toHaveLength(exceptions ?? (error ? 1 : 0));
      if (exceptions === 1) expect(span.exceptions[0]).toBe("aborted");
    },
  );

  it("does not invent metrics for a contract-invalid return", async () => {
    const meter = new RecordingMeter();
    const tracer = makeTracer();
    const plugin = {
      init: async () => ({ type: "ready" as const }),
      project: async () => ({ type: "invalid" }),
    } as unknown as ProjectorPlugin;
    const projector = new EnrichingFactProjector(
      baseProjector(),
      [runtimeEntry(plugin, "skip-fact", meter)],
      { report() {} },
      tracer.tracer,
    );
    await expect(collect(projector.project(facts()))).resolves.toHaveLength(1);
    expect(meter.calls).toEqual([]);
  });

  it("records the bounded file-change fact type without fact identity", async () => {
    const meter = new RecordingMeter();
    const plugin: ProjectorPlugin = {
      init: async () => ({ type: "ready" }),
      project: async () => ({ type: "skip" }),
    };
    const projector = new EnrichingFactProjector(
      baseProjector(),
      [runtimeEntry(plugin, "skip-fact", meter)],
      { report() {} },
      makeTracer().tracer,
    );
    async function* source() {
      yield fileChangeFact();
    }
    await collect(projector.project(source()));
    expect(meter.calls[0]?.attributes).toEqual({
      "gitlode.projection.fact.type": "file-change",
      "gitlode.plugin.projection.outcome": "skip",
    });
  });

  it("measures only the awaited callback before diagnostics and host result handling", async () => {
    let now = 2_000;
    const meter = new RecordingMeter();
    const reporter: DiagnosticReporter = {
      report() {
        now = 99_000;
      },
    };
    const plugin: ProjectorPlugin = {
      init: async () => ({ type: "ready" }),
      project: async () => {
        now = 5_000;
        return { type: "fatal" };
      },
    };
    const entry = runtimeEntry(plugin, "skip-fact", meter, () => now);
    const projector = new EnrichingFactProjector(
      baseProjector(() => {
        now = 2_000;
      }),
      [entry],
      reporter,
      makeTracer().tracer,
    );
    await collect(projector.project(facts()));
    expect(meter.calls[1]).toEqual({
      name: "gitlode.plugin.projection.duration",
      value: 3,
      attributes: {
        "gitlode.projection.fact.type": "commit",
        "gitlode.plugin.projection.outcome": "failure_continued",
      },
    });
  });

  it("ends one outer span on partial cancellation and ignores repeated terminal operations", async () => {
    const meter = new RecordingMeter();
    const tracer = makeTracer();
    const plugin: ProjectorPlugin = {
      init: async () => ({ type: "ready" }),
      project: async () => ({ type: "success", data: true }),
    };
    const projector = new EnrichingFactProjector(
      baseProjector(),
      [runtimeEntry(plugin, "skip-fact", meter)],
      { report() {} },
      tracer.tracer,
    );
    const iterator = projector.project(facts(2))[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    await iterator.return?.();
    expect(meter.calls.filter((call) => call.name.endsWith("operation"))).toHaveLength(1);
    expect(tracer.starts).toHaveLength(1);
    expect(tracer.starts[0]!.span.attributes).toEqual({
      "gitlode.projection.mode": "plugin_enriched",
      "gitlode.stream.completion": "cancelled",
    });
    expect(tracer.starts[0]!.span.endCount).toBe(1);
    expect(tracer.starts[0]!.span.statuses).toEqual([]);
  });

  it("treats a downstream consumer throw as cancellation without a per-record span", async () => {
    const meter = new RecordingMeter();
    const tracer = makeTracer();
    const plugin: ProjectorPlugin = {
      init: async () => ({ type: "ready" }),
      project: async () => ({ type: "success", data: true }),
    };
    const projector = new EnrichingFactProjector(
      baseProjector(),
      [runtimeEntry(plugin, "skip-fact", meter)],
      { report() {} },
      tracer.tracer,
    );
    await expect(
      (async () => {
        for await (const _record of projector.project(facts(2))) throw new Error("consumer");
      })(),
    ).rejects.toThrow("consumer");
    expect(tracer.starts).toHaveLength(1);
    expect(tracer.starts[0]!.span.attributes).toEqual({
      "gitlode.projection.mode": "plugin_enriched",
      "gitlode.stream.completion": "cancelled",
    });
    expect(tracer.starts[0]!.span.statuses).toEqual([]);
    expect(tracer.starts[0]!.span.endCount).toBe(1);
  });
});
