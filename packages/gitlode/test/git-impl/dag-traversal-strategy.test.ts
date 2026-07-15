import * as git from "isomorphic-git";
import { describe, expect, it } from "vitest";

import {
  type DagDifferenceWalker,
  type DagFrontier,
  type DagFrontierItem,
  type DagTopologyPort,
  type WalkDagStrategyOptions,
  walkDagReachableNodeIds,
  walkDagNodeIdsCertifiedLazy,
  walkDagNodeIdsEagerExclude,
} from "../../src/dag/index.js";
import { walkDagNodeIdsPhaseCertifiedDifference } from "../../src/dag/phase-certified.js";
import { GitAdapterError, type RawCommit } from "../../src/git/index.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "../../src/instrumentation/index.js";
import type { CommitOid } from "../../src/model/index.js";
import { OrderedQueue } from "../../src/support/index.js";
import {
  assertOidSet,
  buildDag,
  expectedLabels,
  expectedOids,
  type BuiltDag,
  type DagDefinition,
} from "../support/commit-dag.js";

type Walker = (dag: BuiltDag, head: CommitOid, exclude?: CommitOid) => Promise<CommitOid[]>;

const eagerExcludeStrategy: DagDifferenceWalker<CommitOid> = walkDagNodeIdsEagerExclude;
const certifiedLazyStrategy: DagDifferenceWalker<CommitOid> = (context, nodeId, excludeNodeId) =>
  walkDagNodeIdsCertifiedLazy(context, nodeId, excludeNodeId, certifiedLazyOptions());
const phaseCertifiedStrategy: DagDifferenceWalker<CommitOid> = (context, nodeId, excludeNodeId) =>
  walkDagNodeIdsPhaseCertifiedDifference(context, nodeId, excludeNodeId);

const walkers: readonly { readonly name: string; readonly walk: Walker }[] = [
  {
    name: "eagerExclude",
    async walk(dag, head, exclude) {
      const commits: CommitOid[] = [];
      for await (const commit of eagerExcludeStrategy(
        {
          graph: rawCommitTopologyPort(dag),
          instrumentation: noopInstrumentation,
        },
        head,
        exclude,
      )) {
        commits.push(commit);
      }
      return commits;
    },
  },
  {
    name: "certifiedLazy",
    async walk(dag, head, exclude) {
      const commits: CommitOid[] = [];
      for await (const commit of certifiedLazyStrategy(
        {
          graph: rawCommitTopologyPort(dag),
          instrumentation: noopInstrumentation,
        },
        head,
        exclude,
      )) {
        commits.push(commit);
      }
      return commits;
    },
  },
  {
    name: "phaseCertified",
    async walk(dag, head, exclude) {
      const commits: CommitOid[] = [];
      for await (const commit of phaseCertifiedStrategy(
        {
          graph: rawCommitTopologyPort(dag),
          instrumentation: noopInstrumentation,
        },
        head,
        exclude,
      )) {
        commits.push(commit);
      }
      return commits;
    },
  },
];

function rawCommitTopologyPort(dag: BuiltDag, requests?: string[]): DagTopologyPort<CommitOid> {
  return {
    async getSuccessors(oid) {
      requests?.push(oid);
      const commit = await readCommitForPort(dag, oid);
      return commit.parents.map((parent) => ({ nodeId: parent }));
    },
  };
}

function certifiedLazyOptions(): WalkDagStrategyOptions<CommitOid> {
  return {
    createFrontier: () =>
      new OrderedQueue<DagFrontierItem<CommitOid>>({
        dequeueOrder: "lifo",
        blockOrder: "preserve",
      }),
  };
}

async function readCommitForPort(dag: BuiltDag, oid: CommitOid): Promise<RawCommit> {
  try {
    const { commit } = await git.readCommit({ fs: dag.fs, dir: "/", oid });
    return toRawCommit(oid, commit);
  } catch (err) {
    if (err instanceof Error && err.name === "NotFoundError") {
      throw new GitAdapterError(`Commit not found: ${oid}`, "COMMIT_NOT_FOUND", err);
    }
    throw new GitAdapterError(
      `Unexpected error reading commit ${oid}: ${String(err)}`,
      "UNKNOWN",
      err,
    );
  }
}

type IsomorphicGitCommitObject = Awaited<ReturnType<typeof git.readCommit>>["commit"];

function toRawCommit(hash: CommitOid, commit: IsomorphicGitCommitObject): RawCommit {
  return {
    oid: hash,
    message: commit.message,
    author: {
      name: commit.author.name,
      email: commit.author.email,
      timestamp: commit.author.timestamp,
      timezoneOffset: -commit.author.timezoneOffset,
    },
    committer: {
      name: commit.committer.name,
      email: commit.committer.email,
      timestamp: commit.committer.timestamp,
      timezoneOffset: -commit.committer.timezoneOffset,
    },
    parents: commit.parent as unknown as readonly CommitOid[],
  };
}

function stringTopology(
  successorsByNode: Record<string, readonly string[]>,
): DagTopologyPort<string> {
  return {
    async getSuccessors(nodeId) {
      return (successorsByNode[nodeId] ?? []).map((successor) => ({ nodeId: successor }));
    },
  };
}

class RecordingFrontier<
  T extends DagFrontierItem<string, DomainHint>,
  DomainHint,
> implements DagFrontier<T> {
  private readonly items: T[] = [];
  readonly enqueued: T[] = [];

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  enqueue(...items: T[]): void {
    this.items.push(...items);
    this.enqueued.push(...items);
  }

  enqueueMany(items: Iterable<T>): void {
    const block = [...items];
    this.items.push(...block);
    this.enqueued.push(...block);
  }

  peek(): T | undefined {
    return this.items[0];
  }

  peekOrThrow(): T {
    const item = this.peek();
    if (item === undefined) throw new Error("Cannot peek from an empty queue.");
    return item;
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  dequeueOrThrow(): T {
    const item = this.dequeue();
    if (item === undefined) throw new Error("Cannot dequeue from an empty queue.");
    return item;
  }

  clear(): void {
    this.items.length = 0;
  }
}

describe("DAG traversal NodeId API and frontier metadata", () => {
  it("collects reachable node IDs from one or more starts", async () => {
    const result = new Set(
      await collect(
        walkDagReachableNodeIds(
          {
            graph: stringTopology({ left: ["root"], right: ["root"], root: [] }),
            instrumentation: noopInstrumentation,
          },
          ["left", "right"],
        ),
      ),
    );

    expect(result).toEqual(new Set(["left", "right", "root"]));
  });

  it("yields deterministic order for identical input and topology", async () => {
    const graph = stringTopology({ left: ["root"], right: ["root"], root: [] });

    const first = await collect(
      walkDagReachableNodeIds({ graph, instrumentation: noopInstrumentation }, ["left", "right"]),
    );
    const second = await collect(
      walkDagReachableNodeIds({ graph, instrumentation: noopInstrumentation }, ["left", "right"]),
    );

    expect(first).toEqual(second);
  });

  it("records scheduling metadata and copied domain hints in frontier items", async () => {
    const frontier = new RecordingFrontier<
      DagFrontierItem<string, { readonly parentIndex: number }>,
      { readonly parentIndex: number }
    >();
    const graph: DagTopologyPort<string, { readonly parentIndex: number }> = {
      async getSuccessors(nodeId) {
        if (nodeId !== "head") return [];
        return [
          { nodeId: "first", domainHint: { parentIndex: 0 } },
          { nodeId: "second", domainHint: { parentIndex: 1 } },
        ];
      },
    };

    const yielded = await collect(
      walkDagNodeIdsEagerExclude(
        { graph, instrumentation: noopInstrumentation },
        "head",
        undefined,
        { createFrontier: () => frontier },
      ),
    );

    expect(new Set(yielded)).toEqual(new Set(["head", "first", "second"]));
    expect(frontier.enqueued.map((item) => item.nodeId)).toEqual(["head", "first", "second"]);
    expect(frontier.enqueued[0]?.scheduling).toEqual({
      role: "main",
      depth: 0,
      discoveredOrder: 0,
    });
    expect(frontier.enqueued[1]?.scheduling).toEqual({
      role: "main",
      depth: 1,
      discoveredOrder: 1,
    });
    expect(frontier.enqueued[2]?.domainHint).toEqual({ parentIndex: 1 });
  });
});

describe("DAG traversal telemetry", () => {
  it("records a top-level reachable operation with yielded nodes", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const result = await collect(
      walkDagReachableNodeIds(
        {
          graph: stringTopology({ head: ["left", "right"], left: [], right: [] }),
          instrumentation: recorder,
        },
        ["head"],
      ),
    );

    expect(new Set(result)).toEqual(new Set(["head", "left", "right"]));
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "dag.reachable",
        counters: {
          main_expansions: 3,
          successor_expansions: 3,
          traversal_steps: 3,
          yielded_nodes: 3,
        },
      }),
    ]);
  });

  it("records eager-exclude traversal output separately from excluded reachable collection", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const result = await collect(
      walkDagNodeIdsEagerExclude(
        {
          graph: stringTopology({
            root: [],
            release: ["root"],
            head: ["release"],
          }),
          instrumentation: recorder,
        },
        "head",
        "release",
      ),
    );

    expect(result).toEqual(["head"]);
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "dag.traversal",
        attributes: { strategy: "eagerExclude" },
        counters: {
          exclude_expansions: 2,
          excluded_nodes: 2,
          main_expansions: 1,
          successor_expansions: 3,
          traversal_steps: 3,
          yielded_nodes: 1,
        },
      }),
    ]);
  });

  it("records certified-lazy certificate success without fallback counters", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const result = await collect(
      walkDagNodeIdsCertifiedLazy(
        {
          graph: stringTopology({
            old: [],
            release: ["old"],
            after: ["release"],
            head: ["after"],
          }),
          instrumentation: recorder,
        },
        "head",
        "release",
        certifiedLazyOptions(),
      ),
    );

    expect(new Set(result)).toEqual(new Set(["head", "after"]));
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "dag.traversal",
        attributes: { result: "certified", strategy: "certifiedLazy" },
        counters: expect.objectContaining({
          exclude_expansions: 2,
          main_expansions: 2,
          successor_expansions: 4,
          yielded_nodes: 2,
        }),
      }),
    ]);
    expect(recorder.records()[0]?.counters).not.toHaveProperty("fallback_removed");
    expect(recorder.records()[0]?.counters).not.toHaveProperty("excluded_nodes");
  });

  it("records certified-lazy fallback reason and removed candidates", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const result = await collect(
      walkDagNodeIdsCertifiedLazy(
        {
          graph: stringTopology({
            headRoot: [],
            head: ["headRoot"],
            excludeRoot: [],
            exclude: ["excludeRoot"],
          }),
          instrumentation: recorder,
        },
        "head",
        "exclude",
        certifiedLazyOptions(),
      ),
    );

    expect(new Set(result)).toEqual(new Set(["head", "headRoot"]));
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "dag.traversal",
        attributes: {
          fallback_reason: "open_include_path",
          result: "fallback",
          strategy: "certifiedLazy",
        },
        counters: expect.objectContaining({
          excluded_nodes: 2,
          fallback_removed: 0,
          yielded_nodes: 2,
        }),
      }),
    ]);
  });
});

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}

const cases: readonly DagDefinition[] = [
  {
    name: "linear history",
    nodes: { root: {}, middle: { parents: ["root"] }, head: { parents: ["middle"] } },
    head: "head",
  },
  {
    name: "head equals exclude",
    nodes: { root: {}, head: { parents: ["root"] } },
    head: "head",
    exclude: "head",
  },
  {
    name: "release dominates every path to the include-side start",
    nodes: {
      root: {},
      release: { parents: ["root"] },
      left: { parents: ["release"] },
      right: { parents: ["release"] },
      head: { parents: ["left", "right"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "branch created and merged after release",
    nodes: {
      root: {},
      release: { parents: ["root"] },
      main: { parents: ["release"] },
      side: { parents: ["release"] },
      head: { parents: ["main", "side"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "branch forked before release and merged afterward",
    nodes: {
      root: {},
      fork: { parents: ["root"] },
      release: { parents: ["fork"] },
      main: { parents: ["release"] },
      side1: { parents: ["fork"] },
      side2: { parents: ["side1"] },
      head: { parents: ["main", "side2"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "unreachable exclude with a common ancestor",
    nodes: {
      root: {},
      common: { parents: ["root"] },
      head: { parents: ["common"] },
      exclude: { parents: ["common"] },
    },
    head: "head",
    exclude: "exclude",
  },
  {
    name: "fully disconnected head and exclude",
    nodes: {
      headRoot: {},
      head: { parents: ["headRoot"] },
      excludeRoot: {},
      exclude: { parents: ["excludeRoot"] },
    },
    head: "head",
    exclude: "exclude",
  },
  {
    name: "multiple merges",
    nodes: {
      root: {},
      a: { parents: ["root"] },
      b: { parents: ["root"] },
      merge1: { parents: ["a", "b"] },
      c: { parents: ["a"] },
      head: { parents: ["merge1", "c"] },
    },
    head: "head",
  },
  {
    name: "three-parent merge",
    nodes: {
      root: {},
      a: { parents: ["root"] },
      b: { parents: ["root"] },
      c: { parents: ["root"] },
      head: { parents: ["a", "b", "c"] },
    },
    head: "head",
  },
  {
    name: "multiple paths converge on one ancestor",
    nodes: {
      root: {},
      common: { parents: ["root"] },
      a: { parents: ["common"] },
      b: { parents: ["common"] },
      c: { parents: ["common"] },
      head: { parents: ["a", "b", "c"] },
    },
    head: "head",
  },
  {
    name: "single-anchor certificate candidate",
    nodes: {
      old3: {},
      old2: { parents: ["old3"] },
      old1: { parents: ["old2"] },
      release: { parents: ["old1"] },
      after: { parents: ["release"] },
      head: { parents: ["after"] },
    },
    head: "head",
    exclude: "release",
    expectedRead: {
      unread: ["old1", "old2", "old3"],
      note: "A: a successful certificate must not read the long pre-release chain",
    },
  },
  {
    name: "exclude frontier has multiple anchors and falls back",
    nodes: {
      root: {},
      leftAnchor: { parents: ["root"] },
      rightAnchor: { parents: ["root"] },
      release: { parents: ["leftAnchor", "rightAnchor"] },
      main: { parents: ["release"] },
      side: { parents: ["leftAnchor"] },
      head: { parents: ["main", "side"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "pre-release branch converges at a single anchor",
    nodes: {
      oldRoot: {},
      old: { parents: ["oldRoot"] },
      common: { parents: ["old"] },
      release: { parents: ["common"] },
      main: { parents: ["release"] },
      deferredA: { parents: ["common"] },
      deferredB: { parents: ["deferredA"] },
      head: { parents: ["main", "deferredB"] },
    },
    head: "head",
    exclude: "release",
    expectedRead: {
      unread: ["old", "oldRoot"],
      note: "B: a pre-release branch converges with EXCLUDE at the single anchor common",
    },
  },
  {
    name: "pre-release branch forks several generations before release and merges afterward",
    nodes: {
      oldRoot: {},
      old: { parents: ["oldRoot"] },
      common: { parents: ["old"] },
      releaseBase: { parents: ["common"] },
      releasePrep: { parents: ["releaseBase"] },
      release: { parents: ["releasePrep"] },
      main: { parents: ["release"] },
      branchA: { parents: ["common"] },
      branchB: { parents: ["branchA"] },
      head: { parents: ["main", "branchB"] },
    },
    head: "head",
    exclude: "release",
    expectedRead: {
      unread: [],
      note: "D: a several-generation pre-release fork currently falls back before single-anchor advance",
    },
  },
  {
    name: "criss-cross merge equivalent",
    nodes: {
      root: {},
      a: { parents: ["root"] },
      b: { parents: ["root"] },
      mergeA: { parents: ["a", "b"] },
      mergeB: { parents: ["b", "a"] },
      head: { parents: ["mergeA", "mergeB"] },
    },
    head: "head",
  },
  {
    name: "parent and child timestamps run backward",
    nodes: {
      root: { timestamp: 300 },
      child: { parents: ["root"], timestamp: 100 },
      head: { parents: ["child"], timestamp: 200 },
    },
    head: "head",
  },
  {
    name: "all commits have the same timestamp",
    nodes: {
      root: { timestamp: 100 },
      a: { parents: ["root"], timestamp: 100 },
      b: { parents: ["root"], timestamp: 100 },
      head: { parents: ["a", "b"], timestamp: 100 },
    },
    head: "head",
  },
  {
    name: "timestamps run backward with exclude",
    nodes: {
      root: { timestamp: 500 },
      release: { parents: ["root"], timestamp: 100 },
      side: { parents: ["release"], timestamp: 50 },
      head: { parents: ["side"], timestamp: 300 },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "exclude is a descendant of the include-side start",
    nodes: {
      root: {},
      head: { parents: ["root"] },
      exclude: { parents: ["head"] },
    },
    head: "head",
    exclude: "exclude",
  },
  {
    name: "certificate failure fallback candidate",
    nodes: {
      headRoot: {},
      head: { parents: ["headRoot"] },
      excludeRoot: {},
      exclude: { parents: ["excludeRoot"] },
    },
    head: "head",
    exclude: "exclude",
    expectedRead: {
      unread: [],
      note: "C: certificate failure must fall back; record all additional reads",
    },
  },
];

describe.each(walkers)("DAG traversal $name contract", ({ walk }) => {
  it.each(cases)("returns the oracle OID set: $name", async (definition) => {
    const dag = await buildDag(definition);
    const commits = await walk(
      dag,
      dag.oid(definition.head),
      definition.exclude === undefined ? undefined : dag.oid(definition.exclude),
    );
    assertOidSet(commits, expectedOids(dag));
  });

  it("keeps logical membership unchanged when timestamps change", async () => {
    const makeDefinition = (timestamps: readonly number[]): DagDefinition => ({
      name: `timestamp variant ${timestamps.join("-")}`,
      nodes: {
        root: { timestamp: timestamps[0] },
        release: { parents: ["root"], timestamp: timestamps[1] },
        side: { parents: ["release"], timestamp: timestamps[2] },
        head: { parents: ["side"], timestamp: timestamps[3] },
      },
      head: "head",
      exclude: "release",
    });
    const membership = async (timestamps: readonly number[]): Promise<Set<string>> => {
      const dag = await buildDag(makeDefinition(timestamps));
      const commits = await walk(dag, dag.oid("head"), dag.oid("release"));
      const labelsByOid = new Map([...dag.oids].map(([label, oid]) => [oid, label]));
      return new Set(commits.map((commit) => labelsByOid.get(commit.oid)!));
    };

    expect(await membership([100, 200, 300, 400])).toEqual(await membership([400, 100, 300, 200]));
  });
});

describe("DAG traversal fixture and oracle", () => {
  it("computes subtraction from declared parents without Git object reads", () => {
    const definition = cases.find((item) => item.name.includes("forked before release"))!;
    expect(expectedLabels(definition)).toEqual(new Set(["head", "main", "side2", "side1"]));
  });

  it("expresses future read-set expectations as fixture metadata", () => {
    const performanceCases = cases.filter((item) => item.expectedRead !== undefined);
    expect(performanceCases.map((item) => item.expectedRead?.note[0])).toEqual([
      "A",
      "B",
      "D",
      "C",
    ]);

    const caseB = performanceCases[1]!;
    expect(caseB.expectedRead?.unread).toEqual(["old", "oldRoot"]);
    expect(expectedLabels(caseB)).toEqual(new Set(["head", "main", "deferredB", "deferredA"]));

    const caseD = performanceCases[2]!;
    expect(caseD.expectedRead?.unread).toEqual([]);
    expect(expectedLabels(caseD)).toEqual(new Set(["head", "main", "branchB", "branchA"]));
  });
});

describe.each(walkers)("DAG traversal $name error contract", ({ walk }) => {
  const missing = "0".repeat(40) as CommitOid;

  it("maps a missing exclude only to COMMIT_NOT_FOUND", async () => {
    const dag = await buildDag({ name: "head", nodes: { head: {} }, head: "head" });
    const error = await walk(dag, dag.oid("head"), missing).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });

  it("maps a missing include-side start to COMMIT_NOT_FOUND", async () => {
    const dag = await buildDag({ name: "exclude", nodes: { exclude: {} }, head: "exclude" });
    const error = await walk(dag, missing, dag.oid("exclude")).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });

  it("checks the missing exclude before a missing include-side start", async () => {
    const dag = await buildDag({ name: "empty host", nodes: {}, head: "unused" });
    const error = await walk(dag, missing, "f".repeat(40) as CommitOid).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });

  it("maps a missing identical include-side start and exclude to COMMIT_NOT_FOUND", async () => {
    const dag = await buildDag({ name: "empty host", nodes: {}, head: "unused" });
    const error = await walk(dag, missing, missing).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });
});

describe("DAG traversal eagerExclude missing-ancestor characterization", () => {
  it("reports COMMIT_NOT_FOUND for a missing ancestor of excludeHash", async () => {
    const dag = await buildDag({
      name: "missing exclude ancestor",
      nodes: { ancestor: {}, exclude: { parents: ["ancestor"] }, head: {} },
      head: "head",
      exclude: "exclude",
    });
    dag.removeObject("ancestor");

    const error = await walkers[0]!
      .walk(dag, dag.oid("head"), dag.oid("exclude"))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });
});

describe("DAG traversal eagerExclude read trace", () => {
  async function trace(
    dag: BuiltDag,
    head: CommitOid,
    exclude?: CommitOid,
    requests: string[] = [],
  ): Promise<readonly string[]> {
    const commits = walkDagNodeIdsEagerExclude(
      {
        graph: rawCommitTopologyPort(dag, requests),
        instrumentation: noopInstrumentation,
      },
      head,
      exclude,
    );
    for await (const _commit of commits) {
      // Consume the generator so reads and yields retain their production timing.
    }
    return requests;
  }

  it("reads the complete exclude-reachable side before the include side", async () => {
    const dag = await buildDag({
      name: "side order",
      nodes: {
        root: {},
        release: { parents: ["root"] },
        head: { parents: ["release"] },
      },
      head: "head",
      exclude: "release",
    });

    expect(await trace(dag, dag.oid("head"), dag.oid("release"))).toEqual([
      dag.oid("release"),
      dag.oid("root"),
      dag.oid("head"),
    ]);
  });

  it("reads a converged OID only once even when reached through multiple paths", async () => {
    const dag = await buildDag({
      name: "convergence",
      nodes: {
        common: {},
        left: { parents: ["common"] },
        right: { parents: ["common"] },
        head: { parents: ["left", "right"] },
      },
      head: "head",
    });

    const requests = await trace(dag, dag.oid("head"));
    expect(new Set(requests)).toEqual(
      new Set([dag.oid("head"), dag.oid("left"), dag.oid("right"), dag.oid("common")]),
    );
    expect(new Set(requests).size).toBe(requests.length);
  });

  it("reads the expected OIDs for an ordinary reachable-set subtraction", async () => {
    const dag = await buildDag({
      name: "ordinary subtraction",
      nodes: {
        root: {},
        release: { parents: ["root"] },
        main: { parents: ["release"] },
        side: { parents: ["root"] },
        head: { parents: ["main", "side"] },
      },
      head: "head",
      exclude: "release",
    });

    const requests = await trace(dag, dag.oid("head"), dag.oid("release"));
    expect(new Set(requests)).toEqual(
      new Set([
        dag.oid("release"),
        dag.oid("root"),
        dag.oid("head"),
        dag.oid("main"),
        dag.oid("side"),
      ]),
    );
    expect(new Set(requests).size).toBe(requests.length);
  });

  it("fails on a missing exclude ancestor without requesting the include side", async () => {
    const dag = await buildDag({
      name: "missing exclude ancestor trace",
      nodes: { ancestor: {}, exclude: { parents: ["ancestor"] }, head: {} },
      head: "head",
      exclude: "exclude",
    });
    dag.removeObject("ancestor");

    const requests: string[] = [];
    const error = await trace(dag, dag.oid("head"), dag.oid("exclude"), requests).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
    expect(requests).toEqual([dag.oid("exclude"), dag.oid("ancestor")]);
  });
});

describe("DAG traversal certifiedLazy read trace", () => {
  async function trace(
    dag: BuiltDag,
    head: CommitOid,
    exclude?: CommitOid,
    requests: string[] = [],
  ): Promise<readonly string[]> {
    const commits = walkDagNodeIdsCertifiedLazy(
      {
        graph: rawCommitTopologyPort(dag, requests),
        instrumentation: noopInstrumentation,
      },
      head,
      exclude,
      certifiedLazyOptions(),
    );
    for await (const _commit of commits) {
      // Consume the buffered certifiedLazy result.
    }
    return requests;
  }

  function labelsReadByCertifiedLazy(dag: BuiltDag, requests: readonly string[]): Set<string> {
    const labelsByOid = new Map([...dag.oids].map(([label, oid]) => [oid, label]));
    return new Set(requests.map((oid) => labelsByOid.get(oid)!));
  }

  it.each(cases.filter((item) => item.expectedRead !== undefined))(
    "leaves the expected commits unread for $name",
    async (definition) => {
      const dag = await buildDag(definition);
      const requests = await trace(
        dag,
        dag.oid(definition.head),
        definition.exclude === undefined ? undefined : dag.oid(definition.exclude),
      );
      const labelsRead = labelsReadByCertifiedLazy(dag, requests);
      const unread = [...dag.oids.keys()].filter((label) => !labelsRead.has(label));

      expect(new Set(unread)).toEqual(new Set(definition.expectedRead?.unread));
    },
  );

  it("falls back when the exclude frontier has multiple anchors", async () => {
    const definition = cases.find((item) => item.name.includes("multiple anchors"))!;
    const dag = await buildDag(definition);
    const requests = await trace(dag, dag.oid(definition.head), dag.oid(definition.exclude!));
    const labelsRead = labelsReadByCertifiedLazy(dag, requests);

    expect(labelsRead).toEqual(new Set(Object.keys(definition.nodes)));
  });

  it("falls back when an include path reaches a terminal node", async () => {
    const definition = cases.find((item) => item.name.includes("fully disconnected"))!;
    const dag = await buildDag(definition);
    const requests = await trace(dag, dag.oid(definition.head), dag.oid(definition.exclude!));
    const labelsRead = labelsReadByCertifiedLazy(dag, requests);

    expect(labelsRead).toEqual(new Set(Object.keys(definition.nodes)));
  });

  it("falls back when anchor advance reaches an exclude-side path split", async () => {
    const definition: DagDefinition = {
      name: "exclude-side path split anchor",
      nodes: {
        root: {},
        left: { parents: ["root"] },
        right: { parents: ["root"] },
        mergeAnchor: { parents: ["left", "right"] },
        release: { parents: ["mergeAnchor"] },
        main: { parents: ["release"] },
        side: { parents: ["left"] },
        head: { parents: ["main", "side"] },
      },
      head: "head",
      exclude: "release",
    };
    const dag = await buildDag(definition);
    const requests = await trace(dag, dag.oid("head"), dag.oid("release"));
    const labelsRead = labelsReadByCertifiedLazy(dag, requests);

    expect(labelsRead).toEqual(new Set(Object.keys(definition.nodes)));
  });

  it("falls back when a stop point is not covered by the single-anchor certificate", async () => {
    const definition: DagDefinition = {
      name: "uncertified stop point",
      nodes: {
        root: {},
        common: { parents: ["root"] },
        releaseBase: { parents: ["common"] },
        release: { parents: ["releaseBase"] },
        main: { parents: ["release"] },
        longBranchA: { parents: ["common"] },
        longBranchB: { parents: ["longBranchA"] },
        shortBranch: { parents: ["releaseBase"] },
        head: { parents: ["main", "longBranchB", "shortBranch"] },
      },
      head: "head",
      exclude: "release",
    };
    const dag = await buildDag(definition);
    const requests = await trace(dag, dag.oid("head"), dag.oid("release"));
    const labelsRead = labelsReadByCertifiedLazy(dag, requests);

    expect(labelsRead).toEqual(new Set(Object.keys(definition.nodes)));
  });
});
