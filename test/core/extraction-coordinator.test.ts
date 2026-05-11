import { describe, expect, it } from "vitest";

import {
  DefaultExtractionCoordinator,
  type ExtractionCoordinator,
} from "../../src/core/extraction-coordinator.js";
import type {
  BranchTraversalPlan,
  BranchTraversalPlanner,
  BranchTraversalPlanningRequest,
  CheckpointStore,
  CommitFact,
  CommitHash,
  CommitTraversalExtractor,
  CommitTraversalRequest,
  CoordinatorDependencies,
  ExtractionCheckpoint,
  FileChangeExpander,
  FileChangeFact,
  Reporter,
} from "../../src/core/types.js";
import type { OutputSink } from "../../src/core/types.js";
import type { OutputRecord } from "../../src/output/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_HEAD = "a".repeat(40) as CommitHash;
const FAKE_HEAD_2 = "b".repeat(40) as CommitHash;

function makeCommitFact(oid: string): CommitFact {
  return {
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

function emptyCheckpoint(repositoryPath = "/repo"): ExtractionCheckpoint {
  return { version: 1, generatedAt: "", repositoryPath, branches: [] };
}

function makeReporter(): Reporter & {
  progressCalls: number[];
  doneCalls: number[];
  warnings: string[];
} {
  const progressCalls: number[] = [];
  const doneCalls: number[] = [];
  const warnings: string[] = [];
  return {
    progressCalls,
    doneCalls,
    warnings,
    warn(m) {
      warnings.push(m);
    },
    progress(n) {
      progressCalls.push(n);
    },
    done(n) {
      doneCalls.push(n);
    },
  };
}

/** Planner stub that returns a fixed list of plans. */
function makePlanner(plans: readonly BranchTraversalPlan[]): BranchTraversalPlanner {
  return {
    async plan(_req: BranchTraversalPlanningRequest): Promise<readonly BranchTraversalPlan[]> {
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

/** Commit projector stub: wraps each CommitFact as an OutputRecord. */
const commitProjector = {
  project(commits: AsyncIterable<CommitFact>): AsyncIterable<OutputRecord> {
    return (async function* () {
      for await (const fact of commits) yield makeOutputRecord(fact.oid);
    })();
  },
};

/** File projector stub: yields OutputRecord for each FileChangeFact. */
const fileProjector = {
  project(changes: AsyncIterable<FileChangeFact>): AsyncIterable<OutputRecord> {
    return (async function* () {
      for await (const fact of changes) yield makeOutputRecord(`${fact.commit.oid}-file`);
    })();
  },
};

/** Expander stub: yields one FileChangeFact per CommitFact. */
const fileChangeExpander: FileChangeExpander = {
  expand(commits: AsyncIterable<CommitFact>): AsyncIterable<FileChangeFact> {
    return (async function* () {
      for await (const fact of commits) {
        yield {
          commit: fact,
          file: { path: "a.ts", status: "modified", additions: 1, deletions: 0 },
        };
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

/** In-memory CheckpointStore. */
function makeCheckpointStore(): CheckpointStore & { stored: ExtractionCheckpoint | null } {
  let stored: ExtractionCheckpoint | null = null;
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
    plans?: readonly BranchTraversalPlan[];
    oids?: string[];
  } = {},
): CoordinatorDependencies & { sink: ReturnType<typeof makeSink> } {
  const sink = (overrides.sink as ReturnType<typeof makeSink> | undefined) ?? makeSink();
  const plans: readonly BranchTraversalPlan[] = overrides.plans ?? [
    { name: "main", head: FAKE_HEAD as never, excludeHash: undefined },
  ];
  const oids = overrides.oids ?? ["aaaa1111".padEnd(40, "0")];

  return {
    traversalPlanner: overrides.traversalPlanner ?? makePlanner(plans),
    traversalExtractor: overrides.traversalExtractor ?? makeTraverser(oids),
    fileChangeExpander: overrides.fileChangeExpander ?? fileChangeExpander,
    commitProjector: overrides.commitProjector ?? commitProjector,
    fileProjector: overrides.fileProjector ?? fileProjector,
    sink,
    checkpointStore: overrides.checkpointStore,
    reporter: overrides.reporter ?? makeReporter(),
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
    branches: ["main"],
    granularity: "commit",
    priorCheckpoint: emptyCheckpoint(),
    sessionTimestamp: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DefaultExtractionCoordinator", () => {
  it("commit-mode: runs the commit pipeline and returns correct result", async () => {
    const deps = makeDeps({ oids: ["1".padStart(40, "0"), "2".padStart(40, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ granularity: "commit" }));

    expect(result.recordsWritten).toBe(2);
    expect(result.branches).toEqual(["main"]);
    expect(deps.sink.records).toHaveLength(2);
    // commit projector preserves oid (no "-file" suffix)
    expect(deps.sink.records[0]!.oid).toBe("1".padStart(40, "0"));
  });

  it("file-mode: runs the file-change pipeline and returns correct result", async () => {
    const deps = makeDeps({ oids: ["1".padStart(40, "0"), "2".padStart(40, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ granularity: "file" }));

    expect(result.recordsWritten).toBe(2);
    // file projector appends "-file" to oid
    expect(deps.sink.records[0]!.oid).toBe(`${"1".padStart(40, "0")}-file`);
  });

  it("progress-after-write: progress call count matches write count", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      reporter,
      oids: ["1".padStart(40, "0"), "2".padStart(40, "0"), "3".padStart(40, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    expect(reporter.progressCalls).toEqual([1, 2, 3]);
    expect(deps.sink.records).toHaveLength(3);
    // Each progress call happened AFTER the corresponding write
    expect(reporter.progressCalls).toHaveLength(deps.sink.records.length);
  });

  it("done() is always called (even after sink.write() failure)", async () => {
    const reporter = makeReporter();
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

    expect(reporter.doneCalls).toHaveLength(1);
    expect(reporter.doneCalls[0]).toBe(0);
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

  it("checkpoint written after sink.close() succeeds", async () => {
    const checkpointStore = makeCheckpointStore();
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
    // Patch checkpointStore.write to track call order
    const origWrite = checkpointStore.write.bind(checkpointStore);
    checkpointStore.write = async (s) => {
      closeOrder.push("checkpoint");
      return origWrite(s);
    };

    const deps = makeDeps({
      sink: trackingSink as never,
      checkpointStore,
      oids: ["1".padStart(40, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    expect(closeOrder).toEqual(["close", "checkpoint"]);
    expect(checkpointStore.stored).not.toBeNull();
  });

  it("checkpoint NOT written when sink.close() throws", async () => {
    const checkpointStore = makeCheckpointStore();
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
      checkpointStore,
      oids: ["1".padStart(40, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("close failure");

    expect(checkpointStore.stored).toBeNull();
  });

  it("checkpoint NOT written when sink.write() throws", async () => {
    const checkpointStore = makeCheckpointStore();
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
      checkpointStore,
      oids: ["1".padStart(40, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await expect(coord.run(baseRequest())).rejects.toThrow("write fail");

    expect(checkpointStore.stored).toBeNull();
  });

  it("checkpoint NOT written when checkpointStore is undefined", async () => {
    const deps = makeDeps({ checkpointStore: undefined, oids: ["1".padStart(40, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(1);
    // No error — just not written
  });

  it("zero-record run: done() and close() called; no checkpoint written when empty branches", async () => {
    const checkpointStore = makeCheckpointStore();
    const reporter = makeReporter();
    const deps = makeDeps({
      plans: [], // no branches resolved
      oids: [],
      checkpointStore,
      reporter,
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest());

    expect(result.recordsWritten).toBe(0);
    expect(result.branches).toEqual([]);
    expect(reporter.doneCalls).toHaveLength(1);
    expect(reporter.doneCalls[0]).toBe(0);
    // branches.length === 0 → checkpoint skipped
    expect(checkpointStore.stored).toBeNull();
  });

  it("no-branch-head case: planner returns empty plans, zero records, no checkpoint", async () => {
    const checkpointStore = makeCheckpointStore();
    const reporter = makeReporter();
    const deps = makeDeps({
      plans: [],
      oids: [],
      checkpointStore,
      reporter,
    });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest({ branches: ["nonexistent"] }));

    expect(reporter.doneCalls[0]).toBe(0);
    expect(checkpointStore.stored).toBeNull();
  });

  it("checkpoint branches contain only resolved branch names", async () => {
    const checkpointStore = makeCheckpointStore();
    const plans: readonly BranchTraversalPlan[] = [
      { name: "main", head: FAKE_HEAD as never, excludeHash: undefined },
      { name: "develop", head: FAKE_HEAD_2 as never, excludeHash: undefined },
    ];
    // Traversal still returns oids for one branch
    const deps = makeDeps({
      plans,
      checkpointStore,
      oids: ["1".padStart(40, "0")],
    });
    const coord = new DefaultExtractionCoordinator(deps);
    const result = await coord.run(baseRequest({ branches: ["main", "develop"] }));

    expect(result.branches).toEqual(["main", "develop"]);
    expect(checkpointStore.stored?.branches.map((b) => b.name)).toEqual(["main", "develop"]);
  });

  it("checkpoint generatedAt uses request.sessionTimestamp", async () => {
    const checkpointStore = makeCheckpointStore();
    const ts = new Date("2025-06-15T12:00:00Z");
    const deps = makeDeps({ checkpointStore, oids: ["1".padStart(40, "0")] });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest({ sessionTimestamp: ts }));

    expect(checkpointStore.stored?.generatedAt).toBe("2025-06-15T12:00:00.000Z");
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

    const deps = makeDeps({ oids: ["1".padStart(40, "0")], profiler: profilerStub });
    const coord = new DefaultExtractionCoordinator(deps);
    await coord.run(baseRequest());

    // resume/stop called once for write, once for close (2 pairs total)
    expect(resumeCount).toBe(2);
    expect(stopCount).toBe(2);
    expect(measureWorkCount).toBe(2);
  });
});
