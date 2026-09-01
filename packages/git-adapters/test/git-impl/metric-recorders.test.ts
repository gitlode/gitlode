import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Context, Meter, Span, SpanOptions, SpanStatus, Tracer } from "@opentelemetry/api";
import { describe, expect, test } from "vitest";

import {
  createDagMetricRecorder,
  createDagTelemetryBinding,
  bindDagObservation,
  NOOP_DAG_METRIC_RECORDER,
  normalizeDagCompletion,
  type DagMetricRecorder,
  type NeutralDagCompletion,
} from "../../src/git-impl/dag-metric-recorder.js";
import {
  createGitMetricRecorder,
  NOOP_GIT_METRIC_RECORDER,
} from "../../src/git-impl/git-metric-recorder.js";

type Call = { name: string; value: number; attributes: unknown };
type Creation = { kind: "counter" | "histogram"; name: string; options: unknown };
class FakeMeter {
  readonly creations: Creation[] = [];
  readonly calls: Call[] = [];
  createCounter(name: string, options: unknown) {
    this.creations.push({ kind: "counter", name, options });
    return {
      add: (value: number, attributes: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
  createHistogram(name: string, options: unknown) {
    this.creations.push({ kind: "histogram", name, options });
    return {
      record: (value: number, attributes: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
}
class FakeSpan {
  readonly attributes: Record<string, string | boolean | number> = {};
  readonly events: Array<{ name: string; attributes?: Record<string, unknown> }> = [];
  endCount = 0;
  status: SpanStatus | undefined;
  readonly exceptions: unknown[] = [];
  setAttribute(name: string, value: string | boolean | number) {
    this.attributes[name] = value;
    return this;
  }
  setAttributes(attributes: Record<string, string | boolean | number>) {
    Object.assign(this.attributes, attributes);
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
}
class FakeTracer {
  readonly spans: FakeSpan[] = [];
  readonly starts: Array<{ name: string; options?: SpanOptions; parent?: Context }> = [];
  startSpan(name: string, options?: SpanOptions, parent?: Context) {
    this.starts.push({ name, options, parent });
    const span = new FakeSpan();
    this.spans.push(span);
    return span as unknown as Span;
  }
}
const meter = (fake: FakeMeter) => fake as unknown as Meter;
const calls = (fake: FakeMeter, name: string) => fake.calls.filter((call) => call.name === name);
const sequenceTiming = (...values: Array<number | Error>) => {
  let index = 0;
  return createMonotonicTiming(() => {
    const value = values[index++]!;
    if (value instanceof Error) throw value;
    return value;
  });
};
const metricIds = [
  "git_commit_yielded",
  "git_object_read",
  "git_object_cache_lookup",
  "git_object_cache_hit",
  "git_file_change_yielded",
  "git_blob_read_duration",
  "git_blob_read_size",
  "git_blob_read_byte",
  "dag_operation_completion",
  "dag_step_processed",
  "dag_step_stale",
  "dag_successor_expansion",
  "dag_node_yielded",
  "dag_node_excluded",
  "dag_fallback",
  "dag_fallback_node_removed",
] as const;

// This function is type-checked but deliberately never called.
function assertCompletionTypeBoundaries(recorder: DagMetricRecorder) {
  const difference = recorder.startOperation({
    operation: "difference",
    strategy: "eager-exclude",
    hasExclusion: true,
  });
  difference.complete({ type: "stream", completion: "exhausted" });
  // @ts-expect-error difference operations cannot use closure completion evidence.
  difference.complete({ type: "certified-closure", completion: "success" });
  const reachable = recorder.startOperation({ operation: "reachable" });
  // @ts-expect-error reachable operations cannot use closure completion evidence.
  reachable.complete({ type: "certified-closure", completion: "error" });
  const closure = recorder.startOperation({ operation: "certified-closure" });
  closure.complete({ type: "certified-closure", completion: "success" });
  // @ts-expect-error closure operations cannot use stream completion evidence.
  closure.complete({ type: "stream", completion: "cancelled" });
}
void assertCompletionTypeBoundaries;

describe("Git and DAG instrument ownership", () => {
  test("creates exactly the cataloged instruments with exact detached metadata", () => {
    const fake = new FakeMeter();
    const git = createGitMetricRecorder(meter(fake), "git-cli");
    const dagRecorder = createDagMetricRecorder(meter(fake));
    expect(fake.creations).toHaveLength(16);
    expect(fake.creations.map(({ name }) => name).sort()).toEqual(
      metricIds.map((id) => TELEMETRY_METRICS.find((metric) => metric.id === id)!.name).sort(),
    );
    for (const id of metricIds) {
      const metadata = TELEMETRY_METRICS.find((metric) => metric.id === id)!;
      const matching = fake.creations.filter(({ name }) => name === metadata.name);
      expect(matching).toHaveLength(1);
      const expectedOptions =
        metadata.instrument === "histogram"
          ? {
              description: metadata.description,
              unit: metadata.unit,
              advice: { explicitBucketBoundaries: [...metadata.explicitBucketBoundaries] },
            }
          : { description: metadata.description, unit: metadata.unit };
      expect(matching[0]).toEqual({
        kind: metadata.instrument,
        name: metadata.name,
        options: expectedOptions,
      });
      if (metadata.instrument === "histogram") {
        const boundaries = (
          matching[0]!.options as { advice: { explicitBucketBoundaries: number[] } }
        ).advice.explicitBucketBoundaries;
        expect(boundaries).toEqual(metadata.explicitBucketBoundaries);
        expect(boundaries).not.toBe(metadata.explicitBucketBoundaries);
      }
    }
    const creationCount = fake.creations.length;
    git.recordCommitYielded("git-cli-rev-list-stream", false);
    const dag = dagRecorder.startOperation({ operation: "reachable" });
    dag.observations.recordStepProcessed();
    dag.complete({ type: "stream", completion: "exhausted" });
    expect(fake.creations).toHaveLength(creationCount);
  });

  test("reuses one DAG binding and keeps start count scoped to reachable", async () => {
    const fakeMeter = new FakeMeter();
    const fakeTracer = new FakeTracer();
    const binding = createDagTelemetryBinding(fakeTracer as unknown as Tracer, meter(fakeMeter));
    expect(fakeMeter.creations).toHaveLength(8);
    const graph = {
      getSuccessors: async (node: string) => (node === "root" ? [{ nodeId: "leaf" }] : []),
    };
    const oneShot = {
      [Symbol.iterator]() {
        let used = false;
        return {
          next: () => {
            if (used) return { done: true, value: undefined };
            used = true;
            return { done: false, value: "root" };
          },
        };
      },
    };
    const first = binding.instrumentReachable(graph, oneShot);
    expect(fakeTracer.spans).toHaveLength(0);
    await expect([...(await collectAsync(first))]).toEqual(["root", "leaf"]);
    const second = binding.instrumentReachable(graph, ["root"]);
    await collectAsync(second);
    expect(fakeMeter.creations).toHaveLength(8);
    expect(fakeTracer.starts.map(({ name }) => name)).toEqual([
      "gitlode.dag.reachable",
      "gitlode.dag.reachable",
    ]);
    expect(fakeTracer.spans[0]?.attributes).toEqual({
      "gitlode.dag.start.count": 1,
      "gitlode.stream.completion": "exhausted",
    });
    expect(fakeTracer.spans[0]?.endCount).toBe(1);
    const differenceSpan = new FakeSpan();
    const difference = createDagMetricRecorder(meter(new FakeMeter())).startOperation({
      operation: "difference",
      strategy: "eager-exclude",
      hasExclusion: true,
    });
    bindDagObservation(differenceSpan as unknown as Span, difference, {
      operation: "difference",
      strategy: "eager-exclude",
      hasExclusion: true,
    }).complete("exhausted");
    expect(differenceSpan.attributes).not.toHaveProperty("gitlode.dag.start.count");
    await binding.instrumentCertifiedClosure(graph, "root");
    expect(fakeTracer.starts[2]?.name).toBe("gitlode.dag.certified_closure");
    expect(fakeTracer.spans[2]?.endCount).toBe(1);
    expect(fakeTracer.spans[2]?.status).toBeUndefined();
    expect(fakeTracer.spans[2]?.exceptions).toEqual([]);
  });
});

async function collectAsync<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}

describe("Git metric recorder", () => {
  test("records exact commit, object, and file-change datapoints", () => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "isomorphic-git");
    recorder.recordCommitYielded("phase-certified-fifo", true);
    recorder.recordCommitObjectRead("topology");
    recorder.recordFileChangeYielded("deleted");
    expect(fake.calls).toEqual([
      {
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.commit.walk.strategy": "phase-certified-fifo",
          "gitlode.git.commit.walk.has_exclusion": true,
        },
      },
      {
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.object.type": "commit",
          "gitlode.git.object.purpose": "topology",
        },
      },
      {
        name: "gitlode.git.file_change.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.file_change.type": "deleted",
        },
      },
    ]);
  });

  test.each(["miss", "hit"] as const)("records an exact cache %s result atomically", (result) => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "git-cli");
    recorder.recordObjectCacheLookup("blob", "file-change", result);
    const attributes = {
      "gitlode.git.adapter": "git-cli",
      "gitlode.git.object.type": "blob",
      "gitlode.git.object.purpose": "file-change",
    };
    expect(calls(fake, "gitlode.git.object.cache.lookup")).toEqual([
      { name: "gitlode.git.object.cache.lookup", value: 1, attributes },
    ]);
    expect(calls(fake, "gitlode.git.object.cache.hit")).toEqual(
      result === "hit" ? [{ name: "gitlode.git.object.cache.hit", value: 1, attributes }] : [],
    );
    expect(calls(fake, "gitlode.git.object.read")).toEqual([]);
  });

  test("records exact successful blob signals once", () => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "git-cli", sequenceTiming(0, 250));
    const token = recorder.startBlobRead();
    recorder.completeBlobRead(token, { outcome: "success", purpose: "materialize", sizeBytes: 8 });
    recorder.completeBlobRead(token, { outcome: "error" });
    expect(fake.calls).toEqual([
      {
        name: "gitlode.git.blob.read.duration",
        value: 0.25,
        attributes: {
          "gitlode.git.adapter": "git-cli",
          "gitlode.git.blob.read.outcome": "success",
        },
      },
      {
        name: "gitlode.git.object.read",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "git-cli",
          "gitlode.git.object.type": "blob",
          "gitlode.git.object.purpose": "materialize",
        },
      },
      {
        name: "gitlode.git.blob.read.size",
        value: 8,
        attributes: { "gitlode.git.adapter": "git-cli" },
      },
      {
        name: "gitlode.git.blob.read.byte",
        value: 8,
        attributes: { "gitlode.git.adapter": "git-cli" },
      },
    ]);
  });

  test("records only error duration", () => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "git-cli", sequenceTiming(1, 1));
    recorder.completeBlobRead(recorder.startBlobRead(), { outcome: "error" });
    expect(fake.calls).toEqual([
      {
        name: "gitlode.git.blob.read.duration",
        value: 0,
        attributes: { "gitlode.git.adapter": "git-cli", "gitlode.git.blob.read.outcome": "error" },
      },
    ]);
  });

  test("records empty blob size and object read but omits bytes", () => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "git-cli", sequenceTiming(0, 0));
    recorder.completeBlobRead(recorder.startBlobRead(), {
      outcome: "success",
      purpose: "materialize",
      sizeBytes: 0,
    });
    expect(calls(fake, "gitlode.git.blob.read.duration")[0]?.value).toBe(0);
    expect(calls(fake, "gitlode.git.blob.read.size")).toEqual([
      {
        name: "gitlode.git.blob.read.size",
        value: 0,
        attributes: { "gitlode.git.adapter": "git-cli" },
      },
    ]);
    expect(calls(fake, "gitlode.git.blob.read.byte")).toEqual([]);
    expect(calls(fake, "gitlode.git.object.read")).toHaveLength(1);
  });

  test.each([-1, NaN, Infinity, -Infinity])("isolates invalid blob size %s", (size) => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "git-cli", sequenceTiming(0, 100));
    recorder.completeBlobRead(recorder.startBlobRead(), {
      outcome: "success",
      purpose: "materialize",
      sizeBytes: size,
    });
    expect(calls(fake, "gitlode.git.blob.read.duration")).toHaveLength(1);
    expect(calls(fake, "gitlode.git.object.read")).toHaveLength(1);
    expect(calls(fake, "gitlode.git.blob.read.size")).toEqual([]);
    expect(calls(fake, "gitlode.git.blob.read.byte")).toEqual([]);
  });

  test.each([
    ["throwing start", [new Error("clock"), 1]],
    ["nonfinite start", [Infinity, 1]],
    ["throwing completion", [0, new Error("clock")]],
    ["nonfinite completion", [0, Infinity]],
    ["backward clock", [2, 1]],
  ] as const)("isolates %s clock failure", (_label, values) => {
    const fake = new FakeMeter(),
      recorder = createGitMetricRecorder(meter(fake), "git-cli", sequenceTiming(...values));
    recorder.completeBlobRead(recorder.startBlobRead(), {
      outcome: "success",
      purpose: "materialize",
      sizeBytes: 2,
    });
    expect(calls(fake, "gitlode.git.blob.read.duration")).toEqual([]);
    expect(calls(fake, "gitlode.git.object.read")).toHaveLength(1);
    expect(calls(fake, "gitlode.git.blob.read.size")).toHaveLength(1);
    expect(calls(fake, "gitlode.git.blob.read.byte")).toHaveLength(1);
  });

  test("Git no-op is shared, clock-free, instrument-free, and harmless", () => {
    const fake = new FakeMeter(),
      first = NOOP_GIT_METRIC_RECORDER.startBlobRead(),
      second = NOOP_GIT_METRIC_RECORDER.startBlobRead();
    expect(first).toBe(second);
    expect(() => {
      NOOP_GIT_METRIC_RECORDER.recordCommitYielded("certified-lazy", true);
      NOOP_GIT_METRIC_RECORDER.recordCommitObjectRead("topology");
      NOOP_GIT_METRIC_RECORDER.recordObjectCacheLookup("commit", "topology", "hit");
      NOOP_GIT_METRIC_RECORDER.recordFileChangeYielded("added");
      NOOP_GIT_METRIC_RECORDER.completeBlobRead(first, {
        outcome: "success",
        purpose: "materialize",
        sizeBytes: 1,
      });
      NOOP_GIT_METRIC_RECORDER.completeBlobRead(first, { outcome: "error" });
    }).not.toThrow();
    expect(fake.creations).toEqual([]);
  });
});

describe("DAG metric recorder", () => {
  test.each([
    [{ type: "stream", completion: "exhausted" }, "success"],
    [{ type: "stream", completion: "cancelled" }, "cancelled"],
    [{ type: "stream", completion: "handled_throw" }, "handled-throw"],
    [{ type: "stream", completion: "error" }, "error"],
    [{ type: "certified-closure", completion: "success" }, "success"],
    [{ type: "certified-closure", completion: "error" }, "error"],
  ] as const)("maps $0 to %s", (completion, expected) => {
    expect(normalizeDagCompletion(completion as NeutralDagCompletion)).toBe(expected);
  });

  test("uses exact context-specific completion attributes", () => {
    const fake = new FakeMeter(),
      recorder = createDagMetricRecorder(meter(fake));
    recorder
      .startOperation({ operation: "difference", strategy: "phase-certified", hasExclusion: true })
      .complete({ type: "stream", completion: "exhausted" });
    recorder
      .startOperation({ operation: "reachable" })
      .complete({ type: "stream", completion: "cancelled" });
    recorder
      .startOperation({ operation: "certified-closure" })
      .complete({ type: "certified-closure", completion: "error" });
    expect(calls(fake, "gitlode.dag.operation.completion")).toEqual([
      {
        name: "gitlode.dag.operation.completion",
        value: 1,
        attributes: {
          "gitlode.dag.operation": "difference",
          "gitlode.dag.strategy": "phase-certified",
          "gitlode.dag.has_exclusion": true,
          "gitlode.dag.operation.completion": "success",
        },
      },
      {
        name: "gitlode.dag.operation.completion",
        value: 1,
        attributes: {
          "gitlode.dag.operation": "reachable",
          "gitlode.dag.operation.completion": "cancelled",
        },
      },
      {
        name: "gitlode.dag.operation.completion",
        value: 1,
        attributes: {
          "gitlode.dag.operation": "certified-closure",
          "gitlode.dag.operation.completion": "error",
        },
      },
    ]);
  });

  test.each(["exhausted", "cancelled", "handled_throw", "error"] as const)(
    "flushes exact partial work on %s",
    (completion) => {
      const fake = new FakeMeter(),
        operation = createDagMetricRecorder(meter(fake)).startOperation({
          operation: "difference",
          strategy: "eager-exclude",
          hasExclusion: true,
        });
      operation.observations.recordStepProcessed(2);
      operation.observations.recordStepStale(3);
      operation.observations.recordSuccessorExpansion("main", 4);
      operation.observations.recordSuccessorExpansion("exclude", 5);
      operation.observations.recordNodeYielded(6);
      operation.observations.recordNodeExcluded(7);
      operation.complete({ type: "stream", completion });
      operation.complete({ type: "stream", completion: "error" });
      const attributes = {
        "gitlode.dag.operation": "difference",
        "gitlode.dag.strategy": "eager-exclude",
        "gitlode.dag.has_exclusion": true,
      };
      expect(calls(fake, "gitlode.dag.step.processed")).toEqual([
        { name: "gitlode.dag.step.processed", value: 2, attributes },
      ]);
      expect(calls(fake, "gitlode.dag.step.stale")).toEqual([
        { name: "gitlode.dag.step.stale", value: 3, attributes },
      ]);
      expect(calls(fake, "gitlode.dag.successor.expansion")).toEqual([
        {
          name: "gitlode.dag.successor.expansion",
          value: 4,
          attributes: { ...attributes, "gitlode.dag.role": "main" },
        },
        {
          name: "gitlode.dag.successor.expansion",
          value: 5,
          attributes: { ...attributes, "gitlode.dag.role": "exclude" },
        },
      ]);
      expect(calls(fake, "gitlode.dag.node.yielded")).toEqual([
        { name: "gitlode.dag.node.yielded", value: 6, attributes },
      ]);
      expect(calls(fake, "gitlode.dag.node.excluded")).toEqual([
        { name: "gitlode.dag.node.excluded", value: 7, attributes },
      ]);
      expect(calls(fake, "gitlode.dag.operation.completion")).toHaveLength(1);
    },
  );

  test("omits closure yields and exclusion without a full excluded set", () => {
    const fake = new FakeMeter(),
      recorder = createDagMetricRecorder(meter(fake));
    const closure = recorder.startOperation({ operation: "certified-closure" });
    closure.observations.recordNodeYielded();
    closure.complete({ type: "certified-closure", completion: "success" });
    const difference = recorder.startOperation({
      operation: "difference",
      strategy: "eager-exclude",
      hasExclusion: false,
    });
    difference.observations.recordNodeExcluded();
    difference.complete({ type: "stream", completion: "exhausted" });
    expect(calls(fake, "gitlode.dag.node.yielded")).toEqual([]);
    expect(calls(fake, "gitlode.dag.node.excluded")).toEqual([]);
  });

  test.each([0, -1, 1.5, NaN, Infinity, -Infinity])(
    "isolates invalid count %s for every hook",
    (invalid) => {
      const fake = new FakeMeter(),
        operation = createDagMetricRecorder(meter(fake)).startOperation({
          operation: "difference",
          strategy: "certified-lazy",
          hasExclusion: true,
        });
      operation.observations.recordStepProcessed(invalid);
      operation.observations.recordStepStale(invalid);
      operation.observations.recordSuccessorExpansion("main", invalid);
      operation.observations.recordNodeYielded(invalid);
      operation.observations.recordNodeExcluded(invalid);
      operation.observations.markFallback("no_stop_points");
      operation.observations.recordFallbackNodeRemoved(invalid);
      operation.observations.recordStepProcessed();
      operation.complete({ type: "stream", completion: "error" });
      expect(calls(fake, "gitlode.dag.step.processed")[0]?.value).toBe(1);
      expect(calls(fake, "gitlode.dag.step.stale")).toEqual([]);
      expect(calls(fake, "gitlode.dag.successor.expansion")).toEqual([]);
      expect(calls(fake, "gitlode.dag.node.yielded")).toEqual([]);
      expect(calls(fake, "gitlode.dag.node.excluded")).toEqual([]);
      expect(calls(fake, "gitlode.dag.fallback.node.removed")).toEqual([]);
      expect(calls(fake, "gitlode.dag.operation.completion")).toHaveLength(1);
    },
  );

  test("defaults, accumulates, and rejects nonfinite accumulation", () => {
    const fake = new FakeMeter(),
      operation = createDagMetricRecorder(meter(fake)).startOperation({ operation: "reachable" });
    operation.observations.recordStepProcessed();
    operation.observations.recordStepProcessed(2);
    operation.observations.recordStepStale(Number.MAX_VALUE);
    operation.observations.recordStepStale(Number.MAX_VALUE);
    operation.complete({ type: "stream", completion: "exhausted" });
    expect(calls(fake, "gitlode.dag.step.processed")[0]?.value).toBe(3);
    expect(calls(fake, "gitlode.dag.step.stale")[0]?.value).toBe(Number.MAX_VALUE);
  });

  test.each([
    ["open_include_path", "open-include-path"],
    ["exclude_path_split", "exclude-path-split"],
    ["no_stop_points", "no-stop-points"],
    ["uncertified_stop_point", "uncertified-stop-point"],
  ] as const)("maps fallback %s", (reason, mapped) => {
    const fake = new FakeMeter(),
      operation = createDagMetricRecorder(meter(fake)).startOperation({
        operation: "difference",
        strategy: "certified-lazy",
        hasExclusion: true,
      });
    operation.observations.recordFallbackNodeRemoved(9);
    operation.observations.markFallback(reason);
    operation.observations.markFallback(
      reason === "no_stop_points" ? "open_include_path" : "no_stop_points",
    );
    operation.observations.recordFallbackNodeRemoved(2);
    operation.observations.recordFallbackNodeRemoved(0);
    operation.observations.recordStepProcessed();
    operation.complete({ type: "stream", completion: "error" });
    const attributes = {
      "gitlode.dag.strategy": "certified-lazy",
      "gitlode.dag.fallback.reason": mapped,
    };
    expect(calls(fake, "gitlode.dag.fallback")).toEqual([
      { name: "gitlode.dag.fallback", value: 1, attributes },
    ]);
    expect(calls(fake, "gitlode.dag.fallback.node.removed")).toEqual([
      { name: "gitlode.dag.fallback.node.removed", value: 2, attributes },
    ]);
    expect(calls(fake, "gitlode.dag.step.processed")).toHaveLength(1);
  });

  test("ignores fallback outside certified-lazy difference", () => {
    const fake = new FakeMeter(),
      recorder = createDagMetricRecorder(meter(fake));
    const operations = [
      recorder.startOperation({ operation: "reachable" }),
      recorder.startOperation({
        operation: "difference",
        strategy: "eager-exclude",
        hasExclusion: true,
      }),
      recorder.startOperation({
        operation: "difference",
        strategy: "phase-certified",
        hasExclusion: true,
      }),
    ];
    for (const operation of operations) {
      operation.observations.markFallback("open_include_path");
      operation.observations.recordFallbackNodeRemoved(1);
      operation.complete({ type: "stream", completion: "error" });
    }
    const closure = recorder.startOperation({ operation: "certified-closure" });
    closure.observations.markFallback("open_include_path");
    closure.observations.recordFallbackNodeRemoved(1);
    closure.complete({ type: "certified-closure", completion: "error" });
    expect(calls(fake, "gitlode.dag.fallback")).toEqual([]);
    expect(calls(fake, "gitlode.dag.fallback.node.removed")).toEqual([]);
  });

  test("DAG no-op shares operation and hooks and all methods are harmless", () => {
    const fake = new FakeMeter(),
      first = NOOP_DAG_METRIC_RECORDER.startOperation({ operation: "reachable" }),
      second = NOOP_DAG_METRIC_RECORDER.startOperation({ operation: "certified-closure" });
    expect(first).toBe(second);
    expect(first.observations).toBe(second.observations);
    expect(() => {
      first.observations.recordStepProcessed();
      first.observations.recordStepStale();
      first.observations.recordSuccessorExpansion("main");
      first.observations.recordNodeYielded();
      first.observations.recordNodeExcluded();
      first.observations.markFallback("open_include_path");
      first.observations.recordFallbackNodeRemoved();
      first.complete({ type: "stream", completion: "exhausted" });
      first.complete({ type: "stream", completion: "error" });
    }).not.toThrow();
    expect(fake.creations).toEqual([]);
  });
});
