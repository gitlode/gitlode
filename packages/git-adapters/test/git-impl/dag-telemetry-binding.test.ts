import { noopInstrumentation } from "@gitlode/internal-foundation/instrumentation";
import {
  context,
  type Context,
  type Span,
  type SpanOptions,
  type SpanStatus,
  type Tracer,
  type Meter,
} from "@opentelemetry/api";
import * as git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { describe, expect, it } from "vitest";

import { createCommitTraversalStrategy } from "../../src/git-impl/commit-traversal/index.js";
import { createDagTelemetryBinding } from "../../src/git-impl/dag-metric-recorder.js";
import { IsomorphicGitAdapter } from "../../src/git-impl/isomorphic-git-adapter.js";

class RecordingSpan {
  readonly attributes: Record<string, string | boolean | number> = {};
  readonly events: Array<{ name: string; attributes?: Record<string, unknown> }> = [];
  readonly exceptions: unknown[] = [];
  status: SpanStatus | undefined;
  endCount = 0;
  setAttribute(name: string, value: string | boolean | number) {
    this.attributes[name] = value;
    return this;
  }
  setAttributes(values: Record<string, string | boolean | number>) {
    Object.assign(this.attributes, values);
    return this;
  }
  addEvent(name: string, attributes?: Record<string, unknown>) {
    this.events.push({ name, attributes });
    return this;
  }
  setStatus(status: SpanStatus) {
    this.status = status;
    return this;
  }
  recordException(exception: unknown) {
    this.exceptions.push(exception);
  }
  end() {
    this.endCount++;
  }
  isRecording() {
    return this.endCount === 0;
  }
  spanContext() {
    return { traceId: "1".repeat(32), spanId: "2".repeat(16), traceFlags: 1 };
  }
}

class RecordingTracer {
  readonly starts: Array<{
    name: string;
    options?: SpanOptions;
    parent: Context;
    span: RecordingSpan;
  }> = [];
  startSpan(name: string, options?: SpanOptions, parent: Context = context.active()) {
    const span = new RecordingSpan();
    this.starts.push({ name, options, parent, span });
    return span as unknown as Span;
  }
}

class RecordingMeter {
  readonly creations: string[] = [];
  readonly adds: Array<{ name: string; value: number; attributes: unknown }> = [];
  createCounter(name: string) {
    this.creations.push(name);
    return {
      add: (value: number, attributes: unknown) => this.adds.push({ name, value, attributes }),
    };
  }
}

const asTracer = (tracer: RecordingTracer) => tracer as unknown as Tracer;
const asMeter = (meter: RecordingMeter) => meter as unknown as Meter;

async function makeAdapter(strategy: string, tracer: RecordingTracer, meter: RecordingMeter) {
  const volume = new Volume();
  const fs = createFsFromVolume(volume);
  await git.init({ fs, dir: "/", defaultBranch: "main" });
  await git.setConfig({ fs, dir: "/", path: "user.name", value: "Test" });
  await git.setConfig({ fs, dir: "/", path: "user.email", value: "test@example.com" });
  fs.writeFileSync("/file", "value");
  await git.add({ fs, dir: "/", filepath: "file" });
  const head = await git.commit({
    fs,
    dir: "/",
    message: "head",
    author: { name: "Test", email: "test@example.com", timestamp: 1, timezoneOffset: 0 },
  });
  return {
    adapter: new IsomorphicGitAdapter({
      fs,
      instrumentation: noopInstrumentation,
      commitTraversalStrategy: createCommitTraversalStrategy(strategy as never),
      dagTracer: asTracer(tracer),
      dagMeter: asMeter(meter),
    }),
    head,
  };
}

describe("Git-owned DAG telemetry binding", () => {
  it.each(["certified-lazy", "phase-certified-fifo", "phase-certified-timestamp"])(
    "records %s difference exhaustion through IsomorphicGitAdapter",
    async (strategy) => {
      const tracer = new RecordingTracer();
      const meter = new RecordingMeter();
      const { adapter, head } = await makeAdapter(strategy, tracer, meter);
      const commits = [];
      for await (const commit of adapter.walkCommits("/", head)) commits.push(commit);
      const start = tracer.starts.find((entry) => entry.name === "gitlode.dag.traversal");
      expect(commits).toHaveLength(1);
      expect(Object.keys(start?.span.attributes ?? {}).sort()).toEqual([
        "gitlode.dag.certification.result",
        "gitlode.dag.has_exclusion",
        "gitlode.dag.strategy",
        "gitlode.dag.termination.reason",
        "gitlode.stream.completion",
      ]);
      expect(start?.span.attributes).toMatchObject({
        "gitlode.dag.strategy":
          strategy === "certified-lazy" ? "certified-lazy" : "phase-certified",
        "gitlode.dag.has_exclusion": false,
        "gitlode.dag.certification.result": "certified",
        "gitlode.dag.termination.reason": "frontier-exhausted",
        "gitlode.stream.completion": "exhausted",
      });
      expect(start?.span.endCount).toBe(1);
      expect(
        meter.adds.filter((call) => call.name === "gitlode.dag.operation.completion"),
      ).toHaveLength(1);
      expect(tracer.starts.filter((entry) => entry.name.startsWith("dag.")).length).toBe(0);
    },
  );

  it("records reachable laziness, first-consumption parent, and start count", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    let iterations = 0;
    const source = {
      [Symbol.iterator]() {
        iterations++;
        return ["root"][Symbol.iterator]();
      },
    };
    const stream = binding.instrumentReachable({ getSuccessors: async () => [] }, source);
    expect(iterations).toBe(0);
    expect(tracer.starts).toHaveLength(0);
    await expect(drain(stream)).resolves.toEqual(["root"]);
    expect(iterations).toBe(1);
    expect(tracer.starts[0]?.name).toBe("gitlode.dag.reachable");
    expect(tracer.starts[0]?.span.attributes["gitlode.dag.start.count"]).toBe(1);
    expect(tracer.starts[0]?.span.attributes["gitlode.stream.completion"]).toBe("exhausted");
    expect(tracer.starts[0]?.span.endCount).toBe(1);
  });

  it("records reachable cancellation and source failure with one terminal signal", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    const iterator = binding
      .instrumentReachable({ getSuccessors: async () => [] }, ["root"])
      [Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    await iterator.next();
    expect(tracer.starts[0]?.span.attributes["gitlode.stream.completion"]).toBe("cancelled");
    expect(tracer.starts[0]?.span.endCount).toBe(1);

    const failure = new Error("source failure");
    const failed = binding.instrumentReachable(
      {
        getSuccessors: async () => {
          throw failure;
        },
      },
      ["root"],
    );
    await expect(drain(failed)).rejects.toBe(failure);
    const span = tracer.starts[1]?.span;
    expect(span.status?.code).toBe(2);
    expect(span.exceptions).toEqual([failure]);
    expect(span.endCount).toBe(1);
  });

  it("records certified closure results and runtime errors exactly once", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    await binding.instrumentCertifiedClosure({ getSuccessors: async () => [] }, "root");
    expect(tracer.starts[0]?.name).toBe("gitlode.dag.certified_closure");
    expect(tracer.starts[0]?.span.attributes["gitlode.dag.certified_closure.result"]).toBe(
      "exhausted",
    );
    expect(tracer.starts[0]?.span.endCount).toBe(1);
    const failure = new Error("closure failure");
    await expect(
      binding.instrumentCertifiedClosure(
        {
          getSuccessors: async () => {
            throw failure;
          },
        },
        "root",
      ),
    ).rejects.toBe(failure);
    expect(tracer.starts[1]?.span.status?.code).toBe(2);
    expect(tracer.starts[1]?.span.exceptions).toEqual([failure]);
    expect(tracer.starts[1]?.span.endCount).toBe(1);
  });

  it("creates cataloged DAG instruments once across all binding operations", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    await drain(binding.instrumentReachable({ getSuccessors: async () => [] }, ["root"]));
    await binding.instrumentCertifiedClosure({ getSuccessors: async () => [] }, "root");
    await drain(binding.instrumentReachable({ getSuccessors: async () => [] }, ["root"]));
    expect(meter.creations).toHaveLength(8);
  });
});

async function drain<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of stream) values.push(value);
  return values;
}
