import { describe, expect, it } from "vitest";

import { DefaultExtractionCoordinator } from "../../src/core/extraction-coordinator.js";
import type {
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
  StateStore,
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
  ProgressEvent,
  ProgressReporter,
} from "../../src/core/types.js";
import type { OutputSink } from "../../src/core/types.js";
import type { OutputRecord } from "../../src/output/types.js";

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

function makeOutputRecord(oid: string): OutputRecord {
  return {
    oid,
    subject: `commit ${oid.slice(0, 7)}`,
    body: "",
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
};

/** Single projector stub: dispatches commit and file-change facts to the appropriate output. */
const projector = {
  project(facts: AsyncIterable<Fact>): AsyncIterable<OutputRecord> {
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
  records: OutputRecord[];
  closeCalls: number;
  bytesWritten: number;
  filesCreated: number;
} {
  const records: OutputRecord[] = [];
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

/** In-memory StateStore. */
function makeStateStore(): StateStore & { stored: ExtractionState | null } {
  let stored: ExtractionState | null = null;
  return {
    get stored() {
      return stored;
    },
    async read() {
      return stored;
    },
    async write(s) {
      stored = s;
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
    stateStore: overrides.stateStore,
    reporter: overrides.reporter ?? makeProgressReporter(),
    profiler: overrides.profiler,
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
    // file projector appends "-file" to oid
    expect(deps.sink.records[0]!.oid).toBe(`${"1".padStart(12, "0")}-file`);
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

  it("state written after sink.close() succeeds", async () => {
    const stateStore = makeStateStore();
    const closeOrder: string[] = [];

    const trackingSink: OutputSink & { records: OutputRecord[] } = {
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
    // Patch stateStore.write to track call order
    const origWrite = stateStore.write.bind(stateStore);
    stateStore.write = async (s) => {
      closeOrder.push("checkpoint");
      return origWrite(s);
    };

    const deps = makeDeps({
      sink: trackingSink as never,
      stateStore,
      oids: ["1".padStart(12, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    expect(closeOrder).toEqual(["close", "checkpoint"]);
    expect(stateStore.stored).not.toBeNull();
  });

  it("state NOT written when sink.close() throws", async () => {
    const stateStore = makeStateStore();
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
      stateStore,
      oids: ["1".padStart(12, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("close failure");

    expect(stateStore.stored).toBeNull();
  });

  it("state NOT written when sink.write() throws", async () => {
    const stateStore = makeStateStore();
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
      stateStore,
      oids: ["1".padStart(12, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write fail");

    expect(stateStore.stored).toBeNull();
  });

  it("state NOT written when stateStore is undefined", async () => {
    const deps = makeDeps({ stateStore: undefined, oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(1);
    // No error — just not written
  });

  it("boundary-equals-head: traverser yields 0 commits, close() called, state written", async () => {
    const stateStore = makeStateStore();
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
    const deps = makeDeps({ plans, stateStore, traversalExtractor: emptyTraverser });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(deps.sink.closeCalls).toBe(1);
    // Plans had one resolved ref, so one state checkpoint entry is written.
    expect(stateStore.stored).not.toBeNull();
    expect(stateStore.stored?.refs).toHaveLength(1);
    expect(stateStore.stored?.refs[0]?.ref).toBe("main");
  });

  it("zero-record run: close() called; no state written when empty branches", async () => {
    const stateStore = makeStateStore();
    const reporter = makeProgressReporter();
    const deps = makeDeps({
      plans: [], // no branches resolved
      oids: [],
      stateStore,
      reporter,
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(result.refs).toEqual([]);
    // refs.length === 0 -> state write skipped.
    expect(stateStore.stored).toBeNull();
  });

  it("no-branch-head case: planner returns empty plans, zero records, no state written", async () => {
    const stateStore = makeStateStore();
    const deps = makeDeps({
      plans: [],
      oids: [],
      stateStore,
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ refs: ["nonexistent"] }));

    expect(result.recordsWritten).toBe(0);
    expect(stateStore.stored).toBeNull();
  });

  it("state refs contain only resolved ref names", async () => {
    const stateStore = makeStateStore();
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
      stateStore,
      traversalExtractor: traverser,
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ refs: ["main", "develop"] }));

    expect(result.refs).toEqual(["main", "develop"]);
    expect(stateStore.stored?.refs.map((r) => r.ref)).toEqual(["main", "develop"]);
  });

  it("non-branch refs are recorded in state.refs with their refType", async () => {
    const stateStore = makeStateStore();
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
    const deps = makeDeps({ plans, stateStore, traversalExtractor: traverser });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ refs: ["main", "v1.0"] }));

    // Both refs appear in the result (CoordinatorResult.refs)
    expect(result.refs).toEqual(["main", "v1.0"]);
    expect(stateStore.stored?.refs.map((r) => [r.ref, r.refType])).toEqual([
      ["main", "branch"],
      ["v1.0", "tag-lightweight"],
    ]);
  });

  it("emits static-ref warnings for all non-branch refs (commit-oid, tag-annotated, tag-lightweight)", async () => {
    const stateStore = makeStateStore();
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
    const deps = makeDeps({ plans, stateStore, reporter, oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest({ refs: ["main", "v1.0-ann", "abc123", "v1.0"] }));

    expect(reporter.warnings).toHaveLength(3);
    expect(reporter.warnings[0]).toContain("v1.0-ann");
    expect(reporter.warnings[1]).toContain("abc123");
    expect(reporter.warnings[2]).toContain("v1.0");
  });

  it("does not emit static-ref warning when state tracking is not active", async () => {
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

    expect(reporter.warnings).toHaveLength(0);
  });

  it("state generatedAt uses request.sessionTimestamp", async () => {
    const stateStore = makeStateStore();
    const ts = new Date("2025-06-15T12:00:00Z");
    const deps = makeDeps({ stateStore, oids: ["1".padStart(12, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest({ sessionTimestamp: ts }));

    expect(stateStore.stored?.generatedAt).toBe("2025-06-15T12:00:00.000Z");
  });

  it("profiler.resume/stop called for write and close but NOT checkpoint write", async () => {
    let time = 0;
    let resumeCount = 0;
    let stopCount = 0;
    let measureWorkCount = 0;
    const profilerStub: import("../../src/core/types.js").StageProfiler = {
      name: "write",
      start() {},
      resume() {
        resumeCount++;
      },
      stop() {
        stopCount++;
      },
      measureWork<T>(fn: () => T): T {
        measureWorkCount++;
        time++;
        return fn();
      },
      createScopedProfiler(_name: string) {
        return profilerStub;
      },
      entries() {
        return [{ name: "write", wallMs: time, workMs: measureWorkCount }];
      },
    };

    const deps = makeDeps({ oids: ["1".padStart(12, "0")], profiler: profilerStub });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    // resume/stop called once for write, once for close (2 pairs total)
    expect(resumeCount).toBe(2);
    expect(stopCount).toBe(2);
    expect(measureWorkCount).toBe(2);
  });
});
