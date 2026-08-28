import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
import { describe, expect, test } from "vitest";

import {
  createDagMetricRecorder,
  NOOP_DAG_METRIC_RECORDER,
} from "../../src/git-impl/dag-metric-recorder.js";
import {
  createGitMetricRecorder,
  NOOP_GIT_METRIC_RECORDER,
} from "../../src/git-impl/git-metric-recorder.js";

type Call = { name: string; value: number; attributes: unknown };
class FakeMeter {
  creations: { kind: string; name: string; options: unknown }[] = [];
  calls: Call[] = [];
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
const meter = (f: FakeMeter) => f as unknown as Meter;
const ids = [
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
describe("Git and DAG metric recorders", () => {
  test("create exactly the sixteen catalog instruments with detached boundaries", () => {
    const f = new FakeMeter();
    createGitMetricRecorder(meter(f), "git-cli");
    createDagMetricRecorder(meter(f));
    expect(f.creations).toHaveLength(16);
    for (const id of ids) {
      const m = TELEMETRY_METRICS.find((x) => x.id === id)!;
      const [c] = f.creations.filter((x) => x.name === m.name);
      expect(c).toBeDefined();
      expect(c!.kind).toBe(m.instrument);
      const options = c!.options as {
        description: string;
        unit: string;
        advice?: { explicitBucketBoundaries: number[] };
      };
      expect(options.description).toBe(m.description);
      expect(options.unit).toBe(m.unit);
      if (m.instrument === "histogram") {
        expect(options.advice!.explicitBucketBoundaries).toEqual(m.explicitBucketBoundaries);
        expect(options.advice!.explicitBucketBoundaries).not.toBe(m.explicitBucketBoundaries);
      }
    }
  });
  test("records compound Git semantics once", () => {
    const f = new FakeMeter();
    let i = 0;
    const r = createGitMetricRecorder(
      meter(f),
      "isomorphic-git",
      createMonotonicTiming(() => [0, 1000][i++]!),
    );
    r.recordCommitYielded("certified-lazy", true);
    r.recordCommitObjectRead("topology");
    r.recordObjectCacheLookup("blob", "materialize", "miss");
    r.recordObjectCacheLookup("blob", "materialize", "hit");
    r.recordFileChangeYielded("modified");
    const t = r.startBlobRead();
    r.completeBlobRead(t, { outcome: "success", purpose: "materialize", sizeBytes: 2 });
    r.completeBlobRead(t, { outcome: "error" });
    expect(f.calls.filter((c) => c.name === "gitlode.git.object.read")).toHaveLength(2);
    expect(f.calls.find((c) => c.name === "gitlode.git.object.cache.hit")?.value).toBe(1);
    expect(f.calls.find((c) => c.name === "gitlode.git.blob.read.duration")?.value).toBe(1);
    expect(f.calls.find((c) => c.name === "gitlode.git.blob.read.byte")?.value).toBe(2);
  });
  test("flushes partial DAG work once and preserves the first fallback", () => {
    const f = new FakeMeter(),
      op = createDagMetricRecorder(meter(f)).startOperation({
        operation: "difference",
        strategy: "certified-lazy",
        hasExclusion: true,
      });
    op.observations.recordStepProcessed(2);
    op.observations.recordStepStale();
    op.observations.recordSuccessorExpansion("main", 3);
    op.observations.recordNodeYielded();
    op.observations.recordNodeExcluded();
    op.observations.markFallback("open_include_path");
    op.observations.markFallback("no_stop_points");
    op.observations.recordFallbackNodeRemoved(2);
    op.complete({ type: "stream", completion: "error" });
    op.complete({ type: "stream", completion: "exhausted" });
    expect(f.calls.filter((c) => c.name === "gitlode.dag.operation.completion")).toHaveLength(1);
    expect(f.calls.find((c) => c.name === "gitlode.dag.fallback")?.attributes).toEqual({
      "gitlode.dag.strategy": "certified-lazy",
      "gitlode.dag.fallback.reason": "open-include-path",
    });
    expect(f.calls.find((c) => c.name === "gitlode.dag.step.processed")?.value).toBe(2);
  });
  test("no-op objects and tokens are shared", () => {
    expect(NOOP_GIT_METRIC_RECORDER.startBlobRead()).toBe(NOOP_GIT_METRIC_RECORDER.startBlobRead());
    expect(NOOP_DAG_METRIC_RECORDER.startOperation({ operation: "reachable" })).toBe(
      NOOP_DAG_METRIC_RECORDER.startOperation({ operation: "certified-closure" }),
    );
  });
});
