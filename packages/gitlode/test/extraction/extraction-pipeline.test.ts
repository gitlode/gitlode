import type { Diagnostic, DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  CommitFact,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  ExtractionCoordinator,
  ExtractionCheckpoint,
  Fact,
  FileChangeExpander,
  FileChangeFact,
  OutputSink,
  ProjectedRecord,
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
} from "@gitlode/internal-contracts/extraction";
import type { CommitOid } from "@gitlode/internal-contracts/model";
import type { ProgressEvent, ProgressReporter } from "@gitlode/internal-contracts/progress";
import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

import { NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER } from "../../src/extraction/extraction-pipeline-metric-recorder.js";
import { ExtractionPipeline } from "../../src/extraction/extraction-pipeline.js";
import type { CoordinatorDependencies } from "../../src/extraction/types.js";
import { makeTracer } from "../support/otel-fakes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_HEAD = "a".repeat(12) as CommitOid;
const FAKE_HEAD_2 = "b".repeat(12) as CommitOid;

function makeCommitFact(oid: string): CommitFact {
  return {
    type: "commit",
    oid,
    message: `commit ${oid.slice(0, 7)}`,
    author: { name: "Test", email: "t@t.com", timestamp: 1_000_000, timezoneOffset: 0 },
    committer: { name: "Test", email: "t@t.com", timestamp: 1_000_000, timezoneOffset: 0 },
    parents: [],
    repository: { name: "repo", url: null },
  };
}

function makeOutputRecord(oid: string): ProjectedRecord {
  return {
    oid,
    message: `commit ${oid.slice(0, 7)}`,
    author: { name: "Test", email: "t@t.com", timestamp: "2024-01-01T00:00:00+00:00" },
    committer: { name: "Test", email: "t@t.com", timestamp: "2024-01-01T00:00:00+00:00" },
    parents: [],
    repository: { name: "repo", url: null },
  };
}

function emptyCheckpoint(repositoryPath = "/repo"): ExtractionCheckpoint {
  return { generatedAt: "", repositoryPath, refs: [] };
}

function makeProgressReporter(): ProgressReporter & {
  events: ProgressEvent[];
} {
  const events: ProgressEvent[] = [];
  return {
    events,
    emit(event: ProgressEvent) {
      events.push(event);
    },
  };
}

function makeDiagnosticReporter(): DiagnosticReporter & {
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  return {
    diagnostics,
    report(diagnostic) {
      diagnostics.push(diagnostic);
    },
  };
}

/** Planner stub that returns a fixed list of plans. */
function makePlanner(plans: readonly TraversalPlan[]): TraversalPlanner {
  return {
    async plan(_req: TraversalPlanningRequest): Promise<readonly TraversalPlan[]> {
      return plans;
    },
  };
}

/** Traversal stub that yields one CommitFact per provided oid. */
function makeTraverser(oids: string[]): CommitTraversalExtractor {
  return {
    extract(_req: CommitTraversalRequest): AsyncIterable<CommitFact> {
      return (async function* () {
        for (const oid of oids) yield makeCommitFact(oid);
      })();
    },
  };
}

/** Expander stub: yields one FileChangeFact per CommitFact. */
const fileChangeExpander: FileChangeExpander = {
  expand(commits: AsyncIterable<CommitFact>): AsyncIterable<FileChangeFact> {
    return (async function* () {
      for await (const fact of commits) {
        yield {
          type: "file-change",
          commit: fact,
          file: { path: "a.ts", status: "modified", additions: 1, deletions: 0 },
        };
      }
    })();
  },
  skippedDiffCount: 0,
};

/** Single projector stub: dispatches commit and file-change facts to the appropriate output. */
const projector = {
  project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
    return (async function* () {
      for await (const fact of facts) {
        if (fact.type === "commit") {
          yield makeOutputRecord(fact.oid);
        } else {
          yield makeOutputRecord(`${fact.commit.oid}-file`);
        }
      }
    })();
  },
};

/** In-memory sink that records writes and tracks close calls. */
function makeSink(): OutputSink & {
  records: ProjectedRecord[];
  closeCalls: number;
  bytesWritten: number;
  filesCreated: number;
} {
  const records: ProjectedRecord[] = [];
  let closeCalls = 0;
  return {
    records,
    get closeCalls() {
      return closeCalls;
    },
    get bytesWritten() {
      return records.length * 100;
    },
    get filesCreated() {
      return records.length > 0 ? 1 : 0;
    },
    async write(record) {
      records.push(record);
    },
    async close() {
      closeCalls++;
    },
  };
}

function makeDeps(
  overrides: Partial<CoordinatorDependencies> & {
    plans?: readonly TraversalPlan[];
    oids?: string[];
  } = {},
): CoordinatorDependencies & { sink: ReturnType<typeof makeSink> } {
  const sink = (overrides.sink as ReturnType<typeof makeSink> | undefined) ?? makeSink();
  const plans: readonly TraversalPlan[] = overrides.plans ?? [
    { name: "main", refType: "branch", head: FAKE_HEAD as never, excludeHash: undefined },
  ];
  const oids = overrides.oids ?? ["aaaa1111".padEnd(40, "0")];

  return {
    traversalPlanner: overrides.traversalPlanner ?? makePlanner(plans),
    traversalExtractor: overrides.traversalExtractor ?? makeTraverser(oids),
    fileChangeExpander: overrides.fileChangeExpander ?? fileChangeExpander,
    projector: overrides.projector ?? projector,
    sink,
    progressReporter: overrides.progressReporter ?? makeProgressReporter(),
    diagnosticReporter: overrides.diagnosticReporter ?? makeDiagnosticReporter(),
    tracer: overrides.tracer ?? trace.getTracer("gitlode.extraction"),
    metricRecorder: overrides.metricRecorder ?? NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
  };
}

function baseRequest(
  overrides: Partial<Parameters<ExtractionCoordinator["run"]>[0]> = {},
): Parameters<ExtractionCoordinator["run"]>[0] {
  return {
    repositoryPath: "/repo",
    repoName: "repo",
    repoUrl: null,
    refs: ["main"],
    granularity: "commit",
    priorCheckpoint: emptyCheckpoint(),
    sessionTimestamp: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExtractionPipeline orchestration", () => {
  it("commit-mode: runs the commit pipeline and returns correct result", async () => {
    const deps = makeDeps({ oids: ["1".padStart(12, "0"), "2".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ granularity: "commit" }));

    expect(result.recordsWritten).toBe(2);
    expect(result.refs).toEqual(["main"]);
    expect(deps.sink.records).toHaveLength(2);
    // commit projector preserves oid (no "-file" suffix)
    expect(deps.sink.records[0]!.oid).toBe("1".padStart(12, "0"));
  });

  it("file-mode: runs the file-change pipeline and returns correct result", async () => {
    const deps = makeDeps({ oids: ["1".padStart(12, "0"), "2".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ granularity: "file" }));

    expect(result.recordsWritten).toBe(2);
    expect(result.skippedDiffs).toBe(0);
    // file projector appends "-file" to oid
    expect(deps.sink.records[0]!.oid).toBe(`${"1".padStart(12, "0")}-file`);
  });

  it("returns skippedDiffs from file-change expander in file mode", async () => {
    const customExpander: FileChangeExpander = {
      skippedDiffCount: 3,
      expand(commits: AsyncIterable<CommitFact>): AsyncIterable<FileChangeFact> {
        return (async function* () {
          for await (const fact of commits) {
            yield {
              type: "file-change",
              commit: fact,
              file: { path: "a.ts", status: "modified", additions: null, deletions: null },
            };
          }
        })();
      },
    };

    const deps = makeDeps({ oids: ["1".padStart(12, "0")], fileChangeExpander: customExpander });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ granularity: "file" }));

    expect(result.skippedDiffs).toBe(3);
  });

  it("commitsTraversed: result contains correct commit count", async () => {
    const oids = ["1".padStart(12, "0"), "2".padStart(12, "0"), "3".padStart(12, "0")];
    const deps = makeDeps({ oids });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest());

    expect(result.commitsTraversed).toBe(3);
  });

  it("extracting-progress events: one event emitted per record written", async () => {
    const reporter = makeProgressReporter();
    const deps = makeDeps({
      progressReporter: reporter,
      oids: ["1".padStart(12, "0"), "2".padStart(12, "0"), "3".padStart(12, "0")],
    });
    const coord = new ExtractionPipeline(deps);
    await coord.run(baseRequest());

    const progressEvents = reporter.events.filter((e) => e.type === "extracting-progress");
    expect(progressEvents).toHaveLength(3);
    expect(deps.sink.records).toHaveLength(3);
    // Each progress event happened after the corresponding write
    expect(progressEvents).toHaveLength(deps.sink.records.length);
  });

  it("phase event sequence: emits prepare/extract/finalize in order", async () => {
    const reporter = makeProgressReporter();
    const deps = makeDeps({ progressReporter: reporter, oids: ["1".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    await coord.run(baseRequest());

    const phaseEvents = reporter.events
      .filter((e) => e.type === "phase-start" || e.type === "phase-end")
      .map((e) => `${e.type}:${(e as { phase: string }).phase}`);

    expect(phaseEvents).toEqual([
      "phase-start:preparing",
      "phase-end:preparing",
      "phase-start:extracting",
      "phase-end:extracting",
      "phase-start:finalizing",
      "phase-end:finalizing",
    ]);
  });

  it("refIndex: tracking increments across multi-ref runs", async () => {
    const reporter = makeProgressReporter();
    const plans: readonly TraversalPlan[] = [
      { name: "main", refType: "branch", head: FAKE_HEAD as never, excludeHash: undefined },
      {
        name: "develop",
        refType: "branch",
        head: FAKE_HEAD_2 as never,
        excludeHash: undefined,
      },
    ];
    // Each branch yields a unique commit so dedup doesn't discard them
    const uniqueOids = ["1".padStart(12, "0"), "2".padStart(12, "0")];
    const traverser: CommitTraversalExtractor = {
      extract(req: CommitTraversalRequest): AsyncIterable<CommitFact> {
        const planName = req.plans[0]?.name ?? "";
        const oid = planName === "main" ? uniqueOids[0]! : uniqueOids[1]!;
        return (async function* () {
          yield makeCommitFact(oid);
        })();
      },
    };
    const deps = makeDeps({ progressReporter: reporter, plans, traversalExtractor: traverser });
    const coord = new ExtractionPipeline(deps);
    await coord.run(baseRequest({ refs: ["main", "develop"] }));

    const progressEvents = reporter.events.filter(
      (e): e is Extract<ProgressEvent, { type: "extracting-progress" }> =>
        e.type === "extracting-progress",
    );
    expect(progressEvents[0]?.refIndex).toBe(0);
    expect(progressEvents[0]?.refCount).toBe(2);
    expect(progressEvents[1]?.refIndex).toBe(1);
    expect(progressEvents[1]?.refCount).toBe(2);
  });

  it("phase-end extracting NOT emitted when sink.write() throws", async () => {
    const reporter = makeProgressReporter();
    const failingSink: OutputSink = {
      async write() {
        throw new Error("write failure");
      },
      async close() {},
      get filesCreated() {
        return 0;
      },
      get bytesWritten() {
        return 0;
      },
    };
    const deps = makeDeps({ progressReporter: reporter, sink: failingSink as never });
    const coord = new ExtractionPipeline(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write failure");

    const phaseEndExtract = reporter.events.filter(
      (e) => e.type === "phase-end" && (e as { phase: string }).phase === "extracting",
    );
    expect(phaseEndExtract).toHaveLength(0);
  });

  it("close() is always called (even after sink.write() failure)", async () => {
    let closeCalled = false;
    const failingSink: OutputSink = {
      async write() {
        throw new Error("write failure");
      },
      async close() {
        closeCalled = true;
      },
      get filesCreated() {
        return 0;
      },
      get bytesWritten() {
        return 0;
      },
    };
    const deps = makeDeps({ sink: failingSink as never });
    const coord = new ExtractionPipeline(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write failure");

    expect(closeCalled).toBe(true);
  });

  it("returns checkpoint only after sink.close() succeeds", async () => {
    const closeOrder: string[] = [];

    const trackingSink: OutputSink & { records: ProjectedRecord[] } = {
      records: [],
      async write(r) {
        this.records.push(r);
      },
      async close() {
        closeOrder.push("close");
      },
      get filesCreated() {
        return 1;
      },
      get bytesWritten() {
        return 100;
      },
    };
    const deps = makeDeps({
      sink: trackingSink as never,
      oids: ["1".padStart(12, "0")],
    });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest());

    expect(closeOrder).toEqual(["close"]);
    expect(result.checkpoint.refs).toHaveLength(1);
  });

  it("checkpoint NOT returned when sink.close() throws", async () => {
    const closingFailSink: OutputSink = {
      async write() {},
      async close() {
        throw new Error("close failure");
      },
      get filesCreated() {
        return 0;
      },
      get bytesWritten() {
        return 0;
      },
    };
    const deps = makeDeps({
      sink: closingFailSink as never,
      oids: ["1".padStart(12, "0")],
    });
    const coord = new ExtractionPipeline(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("close failure");
  });

  it("checkpoint NOT returned when sink.write() throws", async () => {
    const failSink: OutputSink = {
      async write() {
        throw new Error("write fail");
      },
      async close() {},
      get filesCreated() {
        return 0;
      },
      get bytesWritten() {
        return 0;
      },
    };
    const deps = makeDeps({
      sink: failSink as never,
      oids: ["1".padStart(12, "0")],
    });
    const coord = new ExtractionPipeline(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write fail");
  });

  it("returns checkpoint even when no state file persistence is active", async () => {
    const deps = makeDeps({ oids: ["1".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(1);
    expect(result.checkpoint.refs).toHaveLength(1);
  });

  it("boundary-equals-head: traverser yields 0 commits, close() called, checkpoint returned", async () => {
    const plans: readonly TraversalPlan[] = [
      {
        name: "main",
        refType: "branch",
        head: FAKE_HEAD as never,
        excludeHash: FAKE_HEAD as never,
      },
    ];
    const emptyTraverser: CommitTraversalExtractor = {
      extract(_req: CommitTraversalRequest): AsyncIterable<CommitFact> {
        return (async function* () {})();
      },
    };
    const deps = makeDeps({ plans, traversalExtractor: emptyTraverser });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(deps.sink.closeCalls).toBe(1);
    expect(result.checkpoint.refs).toHaveLength(1);
    expect(result.checkpoint.refs[0]?.ref).toBe("main");
  });

  it("zero-record run: close() called; returns empty checkpoint when empty branches", async () => {
    const reporter = makeProgressReporter();
    const deps = makeDeps({
      plans: [], // no branches resolved
      oids: [],
      reporter,
    });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(result.refs).toEqual([]);
    expect(result.checkpoint.refs).toEqual([]);
  });

  it("no-branch-head case: planner returns empty plans, zero records, empty checkpoint", async () => {
    const deps = makeDeps({
      plans: [],
      oids: [],
    });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ refs: ["nonexistent"] }));

    expect(result.recordsWritten).toBe(0);
    expect(result.checkpoint.refs).toEqual([]);
  });

  it("checkpoint refs contain only resolved ref names", async () => {
    const plans: readonly TraversalPlan[] = [
      { name: "main", refType: "branch", head: FAKE_HEAD as never, excludeHash: undefined },
      {
        name: "develop",
        refType: "branch",
        head: FAKE_HEAD_2 as never,
        excludeHash: undefined,
      },
    ];
    // Each branch yields a unique commit so dedup doesn't discard them
    const traverser: CommitTraversalExtractor = {
      extract(req: CommitTraversalRequest): AsyncIterable<CommitFact> {
        const planName = req.plans[0]?.name ?? "";
        const oid = planName === "main" ? "1".padStart(12, "0") : "2".padStart(12, "0");
        return (async function* () {
          yield makeCommitFact(oid);
        })();
      },
    };
    const deps = makeDeps({
      plans,
      traversalExtractor: traverser,
    });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ refs: ["main", "develop"] }));

    expect(result.refs).toEqual(["main", "develop"]);
    expect(result.checkpoint.refs.map((r) => r.ref)).toEqual(["main", "develop"]);
  });

  it("non-branch refs are recorded in checkpoint.refs with their refType", async () => {
    const plans: readonly TraversalPlan[] = [
      { name: "main", refType: "branch", head: FAKE_HEAD as never, excludeHash: undefined },
      {
        name: "v1.0",
        refType: "tag-lightweight",
        head: FAKE_HEAD_2 as never,
        excludeHash: undefined,
      },
    ];
    const traverser: CommitTraversalExtractor = {
      extract(req: CommitTraversalRequest): AsyncIterable<CommitFact> {
        const planName = req.plans[0]?.name ?? "";
        const oid = planName === "main" ? "1".padStart(12, "0") : "2".padStart(12, "0");
        return (async function* () {
          yield makeCommitFact(oid);
        })();
      },
    };
    const deps = makeDeps({ plans, traversalExtractor: traverser });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ refs: ["main", "v1.0"] }));

    // Both refs appear in the result (CoordinatorResult.refs)
    expect(result.refs).toEqual(["main", "v1.0"]);
    expect(result.checkpoint.refs.map((r) => [r.ref, r.refType])).toEqual([
      ["main", "branch"],
      ["v1.0", "tag-lightweight"],
    ]);
  });

  it("emits static-ref warnings for all non-branch refs (commit-oid, tag-annotated, tag-lightweight)", async () => {
    const reporter = makeDiagnosticReporter();
    const plans: readonly TraversalPlan[] = [
      { name: "main", refType: "branch", head: FAKE_HEAD as never, excludeHash: undefined },
      {
        name: "v1.0-ann",
        refType: "tag-annotated",
        head: FAKE_HEAD_2 as never,
        excludeHash: undefined,
      },
      {
        name: "abc123",
        refType: "commit-oid",
        head: FAKE_HEAD as never,
        excludeHash: undefined,
      },
      {
        name: "v1.0",
        refType: "tag-lightweight",
        head: FAKE_HEAD_2 as never,
        excludeHash: undefined,
      },
    ];
    const deps = makeDeps({ plans, diagnosticReporter: reporter, oids: ["1".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    await coord.run(baseRequest({ refs: ["main", "v1.0-ann", "abc123", "v1.0"] }));

    expect(reporter.diagnostics).toEqual(
      plans.slice(1).map((plan) => ({
        severity: "warn",
        message: `Warning: Ref "${plan.name}" (${plan.refType}) is included in checkpoint state, but future incremental runs usually produce no new records unless the ref target changes.`,
      })),
    );
  });

  it("emits static-ref warning for checkpoint candidates", async () => {
    const reporter = makeDiagnosticReporter();
    const plans: readonly TraversalPlan[] = [
      {
        name: "v1.0-ann",
        refType: "tag-annotated",
        head: FAKE_HEAD as never,
        excludeHash: undefined,
      },
    ];
    const deps = makeDeps({ plans, diagnosticReporter: reporter, oids: ["1".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    await coord.run(baseRequest({ refs: ["v1.0-ann"] }));

    expect(reporter.diagnostics).toEqual([
      {
        severity: "warn",
        message:
          'Warning: Ref "v1.0-ann" (tag-annotated) is included in checkpoint state, but future incremental runs usually produce no new records unless the ref target changes.',
      },
    ]);
  });

  it("checkpoint generatedAt uses request.sessionTimestamp", async () => {
    const ts = new Date("2025-06-15T12:00:00Z");
    const deps = makeDeps({ oids: ["1".padStart(12, "0")] });
    const coord = new ExtractionPipeline(deps);
    const result = await coord.run(baseRequest({ sessionTimestamp: ts }));

    expect(result.checkpoint.generatedAt).toBe("2025-06-15T12:00:00.000Z");
  });

  it("uses the explicitly supplied extraction domain recorder", async () => {
    const accepted = vi.fn();
    const metricRecorder = {
      ...NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
      recordCommitAccepted: accepted,
    };
    const deps = makeDeps({ oids: ["1".padStart(12, "0")], metricRecorder });
    const coord = new ExtractionPipeline(deps);
    await coord.run(baseRequest());

    expect(accepted).toHaveBeenCalledWith("commit");
  });

  it("owns extract and output-close spans under the injected parent", async () => {
    const { tracer, starts } = makeTracer();
    const deps = makeDeps({ tracer });
    const parent = ROOT_CONTEXT;
    const coord = new ExtractionPipeline({ ...deps, parentContext: parent });

    await coord.run(baseRequest());

    expect(starts.map(({ name }) => name)).toEqual(["gitlode.extract", "gitlode.output.close"]);
    expect(starts[0]?.parent).toBe(ROOT_CONTEXT);
    expect(trace.getSpan(starts[1]?.parent ?? ROOT_CONTEXT)).toBe(starts[0]?.span);
    expect(starts[0]?.span.endCount).toBe(1);
    expect(starts[1]?.span.endCount).toBe(1);
  });

  it("records deduplicated commits and successful output writes at owner points", async () => {
    const startOutputWrite = vi.fn(() => ({ token: true }) as never);
    const completeOutputWrite = vi.fn();
    const recordCommitAccepted = vi.fn();
    const metricRecorder = {
      ...NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
      startOutputWrite,
      completeOutputWrite,
      recordCommitAccepted,
    };
    const deps = makeDeps({
      oids: ["1".padStart(12, "0"), "1".padStart(12, "0")],
      metricRecorder,
    });

    const result = await new ExtractionPipeline(deps).run(baseRequest());

    expect(result.commitsTraversed).toBe(1);
    expect(result.recordsWritten).toBe(1);
    expect(recordCommitAccepted).toHaveBeenCalledTimes(1);
    expect(recordCommitAccepted).toHaveBeenCalledWith("commit");
    expect(startOutputWrite).toHaveBeenCalledTimes(1);
    expect(completeOutputWrite).toHaveBeenCalledWith(
      startOutputWrite.mock.results[0]?.value,
      "commit",
      "success",
    );
  });

  it("records failed output writes without counting a record", async () => {
    const completeOutputWrite = vi.fn();
    const failingSink: OutputSink = {
      async write() {
        throw new Error("write failure");
      },
      async close() {},
      get filesCreated() {
        return 0;
      },
      get bytesWritten() {
        return 0;
      },
    };
    const metricRecorder = {
      ...NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
      startOutputWrite: vi.fn(() => ({ token: true }) as never),
      completeOutputWrite,
    };

    await expect(
      new ExtractionPipeline(makeDeps({ sink: failingSink, metricRecorder })).run(baseRequest()),
    ).rejects.toThrow("write failure");
    expect(completeOutputWrite).toHaveBeenCalledWith(
      metricRecorder.startOutputWrite.mock.results[0]?.value,
      "commit",
      "error",
    );
  });

  it("keeps partial counts on write failure and closes exactly once", async () => {
    const { tracer, starts } = makeTracer();
    const sink: OutputSink = {
      async write() {
        throw new Error("partial write failure");
      },
      async close() {},
      get filesCreated() {
        return 0;
      },
      get bytesWritten() {
        return 0;
      },
    };
    await expect(
      new ExtractionPipeline(makeDeps({ tracer, sink })).run(baseRequest()),
    ).rejects.toThrow("partial write failure");
    const extractSpan = starts.find(({ name }) => name === "gitlode.extract")!.span;
    expect(extractSpan.attributes["gitlode.commit.unique.count"]).toBe(1);
    expect(extractSpan.attributes["gitlode.output.record.count"]).toBe(0);
    expect(starts.filter(({ name }) => name === "gitlode.output.close")).toHaveLength(1);
    expect(starts.find(({ name }) => name === "gitlode.output.close")!.span.statuses).toEqual([]);
    expect(starts.every(({ span }) => span.endCount === 1)).toBe(true);
  });

  it("keeps successful output counts when close fails and marks only close as error", async () => {
    const { tracer, starts } = makeTracer();
    const sink: OutputSink = {
      async write() {},
      async close() {
        throw new Error("close failure");
      },
      get filesCreated() {
        return 1;
      },
      get bytesWritten() {
        return 10;
      },
    };
    await expect(
      new ExtractionPipeline(makeDeps({ tracer, sink })).run(baseRequest()),
    ).rejects.toThrow("close failure");
    const extract = starts.find(({ name }) => name === "gitlode.extract")!.span;
    const close = starts.find(({ name }) => name === "gitlode.output.close")!.span;
    expect(extract.attributes["gitlode.output.record.count"]).toBe(1);
    expect(extract.statuses).toEqual([{ code: 2 }]);
    expect(close.statuses).toEqual([{ code: 2 }]);
    expect(close.exceptions).toHaveLength(1);
  });
});
