import { AsyncLocalStorage } from "node:async_hooks";

import {
  walkDagNodeIdsCertifiedLazy,
  walkDagNodeIdsEagerExclude,
} from "@gitlode/internal-foundation/dag";
import { noopInstrumentation } from "@gitlode/internal-foundation/instrumentation";
import {
  context,
  createContextKey,
  ROOT_CONTEXT,
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

class TestContextManager {
  private readonly storage = new AsyncLocalStorage<Context>();
  active() {
    return this.storage.getStore() ?? ROOT_CONTEXT;
  }
  with<A, F extends (...args: never[]) => A>(
    ctx: Context,
    fn: F,
    thisArg?: unknown,
    ...args: never[]
  ) {
    return this.storage.run(ctx, () => fn.apply(thisArg, args));
  }
  enable() {
    return this;
  }
  disable() {
    this.storage.disable();
  }
}

context.setGlobalContextManager(new TestContextManager());

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
    const uniqueParent = context.active().setValue(createContextKey("dag-test-parent"), true);
    await expect(context.with(uniqueParent, () => drain(stream))).resolves.toEqual(["root"]);
    expect(iterations).toBe(1);
    expect(tracer.starts[0]?.name).toBe("gitlode.dag.reachable");
    expect(tracer.starts[0]?.parent).toBe(uniqueParent);
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
    await binding.instrumentCertifiedClosure(
      {
        getSuccessors: async (node: string) =>
          node === "root"
            ? [{ nodeId: "left" }, { nodeId: "right" }]
            : node === "left" || node === "right"
              ? [{ nodeId: "join" }]
              : node === "join"
                ? [{ nodeId: "outside" }]
                : [],
      },
      "root",
    );
    expect(tracer.starts[1]?.span.attributes["gitlode.dag.certified_closure.result"]).toBe(
      "closed-boundary",
    );
    expect(tracer.starts[1]?.span.endCount).toBe(1);
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
    expect(tracer.starts[2]?.span.status?.code).toBe(2);
    expect(tracer.starts[2]?.span.exceptions).toEqual([failure]);
    expect(tracer.starts[2]?.span.endCount).toBe(1);
  });

  it("records certified-lazy fallback with exact bounded evidence and zero omission", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    const result = await drain(
      binding.instrumentDifference("certified-lazy", true, (observation) =>
        walkDagNodeIdsCertifiedLazy(
          {
            graph: {
              getSuccessors: async (node: string) =>
                node === "head" ? [{ nodeId: "headRoot" }] : [],
            },
            observation,
          },
          "head",
          "exclude",
        ),
      ),
    );
    expect(result).toEqual(["head", "headRoot"]);
    const span = tracer.starts[0]?.span;
    expect(span?.attributes).toEqual({
      "gitlode.dag.certification.result": "fallback",
      "gitlode.dag.fallback.reason": "open-include-path",
      "gitlode.dag.has_exclusion": true,
      "gitlode.dag.strategy": "certified-lazy",
      "gitlode.dag.termination.reason": "frontier-exhausted",
      "gitlode.stream.completion": "exhausted",
    });
    expect(span?.events).toEqual([
      {
        name: "gitlode.dag.fallback",
        attributes: { "gitlode.dag.fallback.reason": "open-include-path" },
      },
    ]);
    expect(span?.status).toBeUndefined();
    expect(span?.exceptions).toEqual([]);
    expect(span?.endCount).toBe(1);
    expect(meter.adds.filter((call) => call.name === "gitlode.dag.fallback")).toHaveLength(1);
    expect(meter.adds.filter((call) => call.name === "gitlode.dag.fallback.node.removed")).toEqual(
      [],
    );
    expect(
      meter.adds.filter((call) => call.name === "gitlode.dag.operation.completion"),
    ).toHaveLength(1);
  });

  it("keeps eager certification evidence independent from certified-lazy fallback", async () => {
    const eagerTracer = new RecordingTracer();
    const eagerMeter = new RecordingMeter();
    const eager = createDagTelemetryBinding(asTracer(eagerTracer), asMeter(eagerMeter));
    await drain(
      eager.instrumentDifference("eager-exclude", true, (observation) =>
        walkDagNodeIdsEagerExclude(
          { graph: { getSuccessors: async () => [] }, observation },
          "head",
          "exclude",
        ),
      ),
    );
    expect(eagerTracer.starts[0]?.span.attributes).toMatchObject({
      "gitlode.dag.certification.result": "certified",
      "gitlode.dag.termination.reason": "frontier-exhausted",
      "gitlode.stream.completion": "exhausted",
    });

    const fallbackTracer = new RecordingTracer();
    const fallbackMeter = new RecordingMeter();
    const fallback = createDagTelemetryBinding(asTracer(fallbackTracer), asMeter(fallbackMeter));
    await drain(
      fallback.instrumentDifference("certified-lazy", true, (observation) =>
        walkDagNodeIdsCertifiedLazy(
          {
            graph: {
              getSuccessors: async (node: string) =>
                node === "head" ? [{ nodeId: "headRoot" }] : [],
            },
            observation,
          },
          "head",
          "exclude",
        ),
      ),
    );
    expect(fallbackTracer.starts[0]?.span.attributes).toMatchObject({
      "gitlode.dag.certification.result": "fallback",
      "gitlode.dag.fallback.reason": "open-include-path",
    });
  });

  it("preserves difference partial metrics on cancellation and repeated terminals", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    const stream = binding.instrumentDifference("eager-exclude", true, (observation) =>
      (async function* () {
        observation.recordStepProcessed(2);
        observation.recordNodeYielded();
        yield "head";
      })(),
    );
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    await iterator.return?.();
    await iterator.next();
    expect(tracer.starts[0]?.span.attributes["gitlode.stream.completion"]).toBe("cancelled");
    expect(tracer.starts[0]?.span.status).toBeUndefined();
    expect(tracer.starts[0]?.span.exceptions).toEqual([]);
    expect(tracer.starts[0]?.span.endCount).toBe(1);
    expect(meter.adds.filter((call) => call.name === "gitlode.dag.step.processed")[0]?.value).toBe(
      2,
    );
    expect(meter.adds.filter((call) => call.name === "gitlode.dag.node.yielded")[0]?.value).toBe(1);
    expect(
      meter.adds.filter((call) => call.name === "gitlode.dag.operation.completion"),
    ).toHaveLength(1);
  });

  it("records positive fallback removal without emitting zero datapoints", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    await drain(
      binding.instrumentDifference("certified-lazy", true, (observation) =>
        walkDagNodeIdsCertifiedLazy(
          {
            graph: {
              getSuccessors: async (node: string) =>
                node === "head"
                  ? [{ nodeId: "common" }]
                  : node === "exclude"
                    ? [{ nodeId: "excludeBranch" }]
                    : node === "excludeBranch"
                      ? [{ nodeId: "common" }]
                      : [],
            },
            observation,
          },
          "head",
          "exclude",
        ),
      ),
    );
    expect(meter.adds.filter((call) => call.name === "gitlode.dag.fallback.node.removed")).toEqual([
      expect.objectContaining({ value: 1 }),
    ]);
  });

  it("preserves difference partial metrics and thrown identity on error", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    const failure = new Error("difference failure");
    const stream = binding.instrumentDifference("eager-exclude", false, (observation) =>
      (async function* () {
        observation.recordStepProcessed(2);
        yield "head";
        throw failure;
      })(),
    );
    await expect(drain(stream)).rejects.toBe(failure);
    expect(tracer.starts[0]?.span.attributes["gitlode.stream.completion"]).toBe("error");
    expect(tracer.starts[0]?.span.status?.code).toBe(2);
    expect(tracer.starts[0]?.span.exceptions).toEqual([failure]);
    expect(tracer.starts[0]?.span.endCount).toBe(1);
    expect(meter.adds.filter((call) => call.name === "gitlode.dag.step.processed")[0]?.value).toBe(
      2,
    );
    expect(
      meter.adds.filter((call) => call.name === "gitlode.dag.operation.completion"),
    ).toHaveLength(1);
  });

  it("records handled throw separately from rethrown throw", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    const token = { kind: "handled" };
    const handled = binding.instrumentDifference("eager-exclude", false, (observation) => {
      observation.recordNodeYielded();
      let first = true;
      return {
        [Symbol.asyncIterator]() {
          return {
            next: async () =>
              first
                ? ((first = false), { value: "head", done: false })
                : { value: token, done: true },
            throw: async () => ({ value: token, done: true }),
          };
        },
      };
    });
    const handledIterator = handled[Symbol.asyncIterator]();
    await handledIterator.next();
    const handledResult = await handledIterator.throw?.(token);
    expect(handledResult).toEqual({ value: token, done: true });
    expect(tracer.starts[0]?.span.attributes["gitlode.stream.completion"]).toBe("handled_throw");
    expect(
      meter.adds.find((call) => call.name === "gitlode.dag.operation.completion")?.attributes,
    ).toMatchObject({ "gitlode.dag.operation.completion": "handled-throw" });
    expect(tracer.starts[0]?.span.endCount).toBe(1);
    const rethrowToken = { kind: "rethrow" };
    const rethrown = binding.instrumentDifference("eager-exclude", false, () => ({
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ value: "head", done: false }),
          throw: async () => {
            throw rethrowToken;
          },
        };
      },
    }));
    const rethrowIterator = rethrown[Symbol.asyncIterator]();
    await rethrowIterator.next();
    await expect(rethrowIterator.throw?.(rethrowToken)).rejects.toBe(rethrowToken);
    expect(tracer.starts[1]?.span.attributes["gitlode.stream.completion"]).toBe("error");
    expect(tracer.starts[1]?.span.exceptions).toHaveLength(1);
  });

  it("creates cataloged DAG instruments once across all binding operations", async () => {
    const tracer = new RecordingTracer();
    const meter = new RecordingMeter();
    const binding = createDagTelemetryBinding(asTracer(tracer), asMeter(meter));
    await drain(
      binding.instrumentDifference("eager-exclude", false, async function* () {
        yield "root";
      }),
    );
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
