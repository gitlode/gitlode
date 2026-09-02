import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Diagnostic } from "@gitlode/internal-contracts/diagnostics";
import type { Fact, FactProjector, ProjectedRecord } from "@gitlode/internal-contracts/extraction";
import type { CommitOid } from "@gitlode/internal-contracts/model";
import type { AbsoluteDirectoryPath } from "@gitlode/internal-foundation/support";
import { context, trace, type Meter, type Tracer } from "@opentelemetry/api";
import { afterEach, describe, expect, it } from "vitest";

import { buildPluginProjector } from "../../src/execution/plugin-bootstrap.js";
import { NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER } from "../../src/extraction/built-in-fact-projector-metric-recorder.js";
import { BuiltInFactProjector } from "../../src/extraction/built-in-fact-projector.js";
import type { Namespace } from "../../src/plugin-api/index.js";
import { makeTracer } from "../support/otel-fakes.js";

type MetricCall = { readonly name: string; readonly value: number; readonly attributes?: unknown };

class RecordingMeter {
  readonly creations: Array<{ readonly kind: string; readonly name: string }> = [];
  readonly calls: MetricCall[] = [];

  createCounter(name: string) {
    this.creations.push({ kind: "counter", name });
    return {
      add: (value: number, attributes?: unknown) => this.calls.push({ name, value, attributes }),
    };
  }

  createHistogram(name: string) {
    this.creations.push({ kind: "histogram", name });
    return {
      record: (value: number, attributes?: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete (globalThis as { __gitlodePluginContexts?: unknown }).__gitlodePluginContexts;
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createPluginPackage(
  root: string,
  directoryName: string,
  manifest: unknown | undefined,
): Promise<string> {
  const directory = join(root, directoryName);
  await mkdir(directory, { recursive: true });
  if (manifest !== undefined) {
    await writeFile(join(directory, "package.json"), JSON.stringify(manifest));
  }
  await writeFile(
    join(directory, "plugin.mjs"),
    `export default function factory(config) {
      return {
        async init(runtime) {
          (globalThis.__gitlodePluginContexts ??= []).push({ config, runtime });
          return { type: "ready" };
        },
        async project() { return { type: "success", data: { configured: config } }; }
      };
    }`,
  );
  return `./${directoryName}/plugin.mjs`;
}

function baseProjector(): FactProjector {
  return {
    async *project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
      for await (const fact of facts) {
        if (fact.type !== "commit") throw new Error("commit fixture expected");
        yield {
          oid: fact.oid,
          message: fact.message,
          author: { name: "a", email: "a@example.com", timestamp: "1970-01-01T00:00:00Z" },
          committer: { name: "c", email: "c@example.com", timestamp: "1970-01-01T00:00:00Z" },
          parents: [],
          repository: { name: "repo", url: null },
        };
      }
    },
  };
}

async function* oneFact(): AsyncIterable<Fact> {
  yield {
    type: "commit",
    oid: "a".repeat(40) as CommitOid,
    message: "message",
    author: { name: "a", email: "a@example.com", timestamp: 0, timezoneOffset: 0 },
    committer: { name: "c", email: "c@example.com", timestamp: 0, timezoneOffset: 0 },
    parents: [],
    repository: { name: "repo", url: null },
  };
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of source) values.push(value);
  return values;
}

describe("plugin telemetry production owners", () => {
  it("reuses one resolved package scope for init contexts, init spans, and projection metrics", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-plugin-owner-"));
    temporaryDirectories.push(root);
    const entrypoint = await createPluginPackage(root, "shared", {
      name: "@example/shared-plugin",
      version: "1.2.3",
      peerDependencies: { gitlode: ">=0.0.0" },
    });
    const declarations = {
      alpha: { entrypoint, config: "alpha", failurePolicy: "skip-fact" as const },
      beta: { entrypoint, config: "beta", failurePolicy: "skip-fact" as const },
    } as Readonly<Record<Namespace, never>>;

    const core = makeTracer();
    const projection = makeTracer();
    const rootTracer = makeTracer();
    const rootSpan = rootTracer.tracer.startSpan("root");
    const rootContext = trace.setSpan(context.active(), rootSpan);
    const scopedTracers = new Map<string, ReturnType<typeof makeTracer>>();
    const scopedMeters = new Map<string, RecordingMeter>();
    const tracerRequests: string[] = [];
    const meterRequests: string[] = [];
    const diagnostics: Diagnostic[] = [];

    const result = await buildPluginProjector(
      declarations,
      root as AbsoluteDirectoryPath,
      new BuiltInFactProjector(
        "repo",
        null,
        projection.tracer,
        NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER,
        false,
      ),
      {
        progressReporter: { emit() {} },
        diagnosticReporter: { report: (diagnostic) => diagnostics.push(diagnostic) },
      },
      {
        pluginRuntimeTracer: core.tracer,
        projectionTracer: projection.tracer,
        rootContext,
        getPluginTracer(name, version) {
          const identity = `${name}@${version ?? ""}`;
          tracerRequests.push(identity);
          const existing = scopedTracers.get(identity);
          if (existing !== undefined) return existing.tracer;
          const created = makeTracer();
          scopedTracers.set(identity, created);
          return created.tracer;
        },
        getPluginMeter(name, version) {
          const identity = `${name}@${version ?? ""}`;
          meterRequests.push(identity);
          const existing = scopedMeters.get(identity);
          if (existing !== undefined) return existing as unknown as Meter;
          const created = new RecordingMeter();
          scopedMeters.set(identity, created);
          return created as unknown as Meter;
        },
      },
    );

    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error(result.message);
    const records = await collect(result.projector.project(oneFact()));
    expect(records[0]?.extensions).toEqual({
      alpha: { configured: "alpha" },
      beta: { configured: "beta" },
    });
    expect(diagnostics).toEqual([]);
    expect(tracerRequests).toEqual(["@example/shared-plugin@1.2.3"]);
    expect(meterRequests).toEqual(["@example/shared-plugin@1.2.3"]);

    const bootstrap = core.starts.find((start) => start.name === "gitlode.plugin.bootstrap")!;
    const resolve = core.starts.find((start) => start.name === "gitlode.plugin.resolve")!;
    const compatibility = core.starts.find(
      (start) => start.name === "gitlode.plugin.compatibility.check",
    )!;
    expect(trace.getSpan(bootstrap.parent!)).toBe(rootSpan);
    expect(trace.getSpan(resolve.parent!)).toBe(bootstrap.span);
    expect(trace.getSpan(compatibility.parent!)).toBe(bootstrap.span);
    expect(bootstrap.options?.attributes).toEqual({ "gitlode.plugin.configured.count": 2 });
    expect(resolve.options?.attributes).toEqual({ "gitlode.plugin.configured.count": 2 });
    expect(resolve.span.attributes).toEqual({ "gitlode.plugin.resolved.count": 2 });
    expect(resolve.span.statuses).toEqual([]);
    expect(resolve.span.exceptions).toEqual([]);
    expect(resolve.span.endCount).toBe(1);
    expect(bootstrap.span.attributes).toEqual({
      "gitlode.plugin.resolved.count": 2,
      "gitlode.plugin.ready.count": 2,
      "gitlode.plugin.failed.count": 0,
    });
    expect(bootstrap.span.statuses).toEqual([]);
    expect(bootstrap.span.exceptions).toEqual([]);
    expect(bootstrap.span.endCount).toBe(1);
    expect(compatibility.options?.attributes).toEqual({ "gitlode.plugin.resolved.count": 2 });
    expect(compatibility.span.attributes).toEqual({
      "gitlode.plugin.compatibility.warning.count": 0,
    });
    expect(compatibility.span.statuses).toEqual([]);
    expect(compatibility.span.exceptions).toEqual([]);
    expect(compatibility.span.endCount).toBe(1);

    const pluginTracer = scopedTracers.get("@example/shared-plugin@1.2.3")!;
    expect(pluginTracer.starts.map((start) => start.name)).toEqual([
      "gitlode.plugin.init",
      "gitlode.plugin.init",
    ]);
    for (const init of pluginTracer.starts) {
      expect(trace.getSpan(init.parent!)).toBe(bootstrap.span);
      expect(init.span.attributes).toEqual({ "gitlode.plugin.init.result": "ready" });
      expect(init.span.statuses).toEqual([]);
      expect(init.span.exceptions).toEqual([]);
      expect(init.span.endCount).toBe(1);
    }

    const contexts = (
      globalThis as {
        __gitlodePluginContexts: Array<{ runtime: { tracer: Tracer; meter: Meter } }>;
      }
    ).__gitlodePluginContexts;
    expect(contexts).toHaveLength(2);
    expect(contexts[0]?.runtime.tracer).toBe(contexts[1]?.runtime.tracer);
    expect(contexts[0]?.runtime.meter).toBe(contexts[1]?.runtime.meter);

    const meter = scopedMeters.get("@example/shared-plugin@1.2.3")!;
    expect(meter.creations).toEqual([
      { kind: "counter", name: "gitlode.plugin.projection.operation" },
      { kind: "histogram", name: "gitlode.plugin.projection.duration" },
    ]);
    expect(meter.calls.filter((call) => call.name.endsWith("operation"))).toEqual([
      {
        name: "gitlode.plugin.projection.operation",
        value: 1,
        attributes: {
          "gitlode.projection.fact.type": "commit",
          "gitlode.plugin.projection.outcome": "success",
        },
      },
      {
        name: "gitlode.plugin.projection.operation",
        value: 1,
        attributes: {
          "gitlode.projection.fact.type": "commit",
          "gitlode.plugin.projection.outcome": "success",
        },
      },
    ]);
    expect(projection.starts.map((start) => start.name)).toEqual(["gitlode.projection"]);
  });

  it.each([
    {
      label: "package without a version",
      directory: "unversioned",
      manifest: { name: "example-plugin", peerDependencies: { gitlode: ">=0.0.0" } },
      namespace: "unversioned",
      expected: "example-plugin@",
    },
    {
      label: "invalid package name",
      directory: "invalid-name",
      manifest: { name: "INVALID PACKAGE", peerDependencies: { gitlode: ">=0.0.0" } },
      namespace: "bounded-fallback",
      expected: "gitlode.plugin.bounded-fallback@",
    },
    {
      label: "invalid package version",
      directory: "invalid-version",
      manifest: {
        name: "example-invalid-version",
        version: "not-semver",
        peerDependencies: { gitlode: ">=0.0.0" },
      },
      namespace: "invalid-version",
      expected: "example-invalid-version@",
    },
    {
      label: "missing package metadata",
      directory: "missing-manifest",
      manifest: undefined,
      namespace: "missing-metadata",
      expected: "gitlode.plugin.missing-metadata@",
    },
  ])(
    "binds $label to the cataloged scope",
    async ({ directory, manifest, namespace, expected }) => {
      const root = await mkdtemp(join(tmpdir(), "gitlode-plugin-scope-"));
      temporaryDirectories.push(root);
      const entrypoint = await createPluginPackage(root, directory, manifest);
      const core = makeTracer();
      const projection = makeTracer();
      const requested: string[] = [];
      const result = await buildPluginProjector(
        {
          [namespace as Namespace]: { entrypoint, failurePolicy: "skip-fact" },
        },
        root as AbsoluteDirectoryPath,
        baseProjector(),
        {
          progressReporter: { emit() {} },
          diagnosticReporter: { report() {} },
        },
        {
          pluginRuntimeTracer: core.tracer,
          projectionTracer: projection.tracer,
          rootContext: context.active(),
          getPluginTracer(name, version) {
            requested.push(`${name}@${version ?? ""}`);
            return makeTracer().tracer;
          },
          getPluginMeter(name, version) {
            requested.push(`${name}@${version ?? ""}`);
            return new RecordingMeter() as unknown as Meter;
          },
        },
      );
      expect(result.kind).toBe("success");
      expect(requested).toEqual([expected, expected]);
      const compatibility = core.starts.find(
        (start) => start.name === "gitlode.plugin.compatibility.check",
      )!;
      expect(compatibility.span.attributes).toEqual({
        "gitlode.plugin.compatibility.warning.count": directory === "missing-manifest" ? 1 : 0,
      });
      expect(compatibility.span.statuses).toEqual([]);
      expect(compatibility.span.exceptions).toEqual([]);
      expect(compatibility.span.endCount).toBe(1);
    },
  );
});
