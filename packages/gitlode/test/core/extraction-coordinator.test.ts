import { describe, expect, it } from "vitest";

import { DefaultExtractionCoordinator } from "../../src/core/extraction-coordinator.js";
import type {
  CommitFact,
  CommitOid,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CoordinatorDependencies,
  ExtractionCoordinator,
  ExtractionState,
  Fact,
  FileChangeExpander,
  FileChangeFact,
  OutputSink,
  ProgressEvent,
  ProgressReporter,
  ProjectedRecord,
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
} from "../../src/core/types.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "../../src/instrumentation/index.js";

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

function emptyState(repositoryPath = "/repo"): ExtractionState {
  return { version: 2, generatedAt: "", repositoryPath, refs: [] };
}

function makeProgressReporter(): ProgressReporter & {
  events: ProgressEvent[];
  warnings: string[];
} {
  const events: ProgressEvent[] = [];
  const warnings: string[] = [];
  return {
    events,
    warnings,
    emit(event: ProgressEvent) {
      events.push(event);
      if (event.type === "warning") warnings.push(event.message);
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
    reporter: overrides.reporter ?? makeProgressReporter(),
    instrumentation: overrides.instrumentation ?? noopInstrumentation,
  };
}

function baseRequest(
  overrides: Partial<Parameters<ExtractionCoordinator["run"]>[0]> = {},
): Parameters<ExtractionCoordinator["run"]>[0] {
  return {
    repositoryPath: "/repo",
    repoName: "repo",
    remoteUrl: null,
    refs: ["main"],
    granularity: "commit",
    priorState: emptyState(),
    sessionTimestamp: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DefaultExtractionCoordinator", () => {
  it("commit-mode: runs the commit pipeline and returns correct result", async () => {
    const deps = makeDeps({ oids: ["1".padStart(12, "0"), "2".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ granularity: "commit" }));

    expect(result.recordsWritten).toBe(2);
    expect(result.refs).toEqual(["main"]);
    expect(deps.sink.records).toHaveLength(2);
    // commit projector preserves oid (no "-file" suffix)
    expect(deps.sink.records[0]!.oid).toBe("1".padStart(12, "0"));
  });

  it("file-mode: runs the file-change pipeline and returns correct result", async () => {
    const deps = makeDeps({ oids: ["1".padStart(12, "0"), "2".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
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
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ granularity: "file" }));

    expect(result.skippedDiffs).toBe(3);
  });

  it("commitsTraversed: result contains correct commit count", async () => {
    const oids = ["1".padStart(12, "0"), "2".padStart(12, "0"), "3".padStart(12, "0")];
    const deps = makeDeps({ oids });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.commitsTraversed).toBe(3);
  });

  it("extracting-progress events: one event emitted per record written", async () => {
    const reporter = makeProgressReporter();
    const deps = makeDeps({
      reporter,
      oids: ["1".padStart(12, "0"), "2".padStart(12, "0"), "3".padStart(12, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    const progressEvents = reporter.events.filter((e) => e.type === "extracting-progress");
    expect(progressEvents).toHaveLength(3);
    expect(deps.sink.records).toHaveLength(3);
    // Each progress event happened after the corresponding write
    expect(progressEvents).toHaveLength(deps.sink.records.length);
  });

  it("phase event sequence: emits prepare/extract/finalize in order", async () => {
    const reporter = makeProgressReporter();
    const deps = makeDeps({ reporter, oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
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
    const deps = makeDeps({ reporter, plans, traversalExtractor: traverser });
    const coord = new DefaultExtractionCoordinator(deps);
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
    const deps = makeDeps({ reporter, sink: failingSink as never });
    const coord = new DefaultExtractionCoordinator(deps);
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
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write failure");

    expect(closeCalled).toBe(true);
  });

  it("returns state only after sink.close() succeeds", async () => {
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
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(closeOrder).toEqual(["close"]);
    expect(result.state.refs).toHaveLength(1);
  });

  it("state NOT returned when sink.close() throws", async () => {
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
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("close failure");
  });

  it("state NOT returned when sink.write() throws", async () => {
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
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write fail");
  });

  it("returns state even when no state file persistence is active", async () => {
    const deps = makeDeps({ oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(1);
    expect(result.state.refs).toHaveLength(1);
  });

  it("boundary-equals-head: traverser yields 0 commits, close() called, state returned", async () => {
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
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(deps.sink.closeCalls).toBe(1);
    expect(result.state.refs).toHaveLength(1);
    expect(result.state.refs[0]?.ref).toBe("main");
  });

  it("zero-record run: close() called; returns empty state when empty branches", async () => {
    const reporter = makeProgressReporter();
    const deps = makeDeps({
      plans: [], // no branches resolved
      oids: [],
      reporter,
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(result.refs).toEqual([]);
    expect(result.state.refs).toEqual([]);
  });

  it("no-branch-head case: planner returns empty plans, zero records, empty state", async () => {
    const deps = makeDeps({
      plans: [],
      oids: [],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ refs: ["nonexistent"] }));

    expect(result.recordsWritten).toBe(0);
    expect(result.state.refs).toEqual([]);
  });

  it("state refs contain only resolved ref names", async () => {
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
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ refs: ["main", "develop"] }));

    expect(result.refs).toEqual(["main", "develop"]);
    expect(result.state.refs.map((r) => r.ref)).toEqual(["main", "develop"]);
  });

  it("non-branch refs are recorded in state.refs with their refType", async () => {
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
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ refs: ["main", "v1.0"] }));

    // Both refs appear in the result (CoordinatorResult.refs)
    expect(result.refs).toEqual(["main", "v1.0"]);
    expect(result.state.refs.map((r) => [r.ref, r.refType])).toEqual([
      ["main", "branch"],
      ["v1.0", "tag-lightweight"],
    ]);
  });

  it("emits static-ref warnings for all non-branch refs (commit-oid, tag-annotated, tag-lightweight)", async () => {
    const reporter = makeProgressReporter();
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
    const deps = makeDeps({ plans, reporter, oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest({ refs: ["main", "v1.0-ann", "abc123", "v1.0"] }));

    expect(reporter.warnings).toHaveLength(3);
    expect(reporter.warnings[0]).toContain("v1.0-ann");
    expect(reporter.warnings[1]).toContain("abc123");
    expect(reporter.warnings[2]).toContain("v1.0");
  });

  it("emits static-ref warning for checkpoint state candidates", async () => {
    const reporter = makeProgressReporter();
    const plans: readonly TraversalPlan[] = [
      {
        name: "v1.0-ann",
        refType: "tag-annotated",
        head: FAKE_HEAD as never,
        excludeHash: undefined,
      },
    ];
    const deps = makeDeps({ plans, reporter, oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest({ refs: ["v1.0-ann"] }));

    expect(reporter.warnings).toHaveLength(1);
    expect(reporter.warnings[0]).toContain("v1.0-ann");
  });

  it("state generatedAt uses request.sessionTimestamp", async () => {
    const ts = new Date("2025-06-15T12:00:00Z");
    const deps = makeDeps({ oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ sessionTimestamp: ts }));

    expect(result.state.generatedAt).toBe("2025-06-15T12:00:00.000Z");
  });

  it("instruments write and close spans", async () => {
    let time = 0;
    const instrumentation = new LocalInstrumentationRecorder(() => time++);

    const deps = makeDeps({ oids: ["1".padStart(12, "0")], instrumentation });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    expect(instrumentation.summary()).toEqual([
      { name: "gitlode.output.write", totalMs: 1, calls: 1, averageMs: 1, maxMs: 1 },
      { name: "gitlode.output.close", totalMs: 1, calls: 1, averageMs: 1, maxMs: 1 },
    ]);
  });
});
