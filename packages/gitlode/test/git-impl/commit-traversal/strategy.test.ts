import { describe, expect, it } from "vitest";

import type { DagSuccessor, DagTopologyPort } from "../../../src/dag/index.js";
import {
  EXPERIMENTAL_COMMIT_TRAVERSAL_ENV,
  createCommitTraversalStrategy,
  resolveCommitTraversalStrategyName,
  type CommitPathSchedulingHint,
  type CommitTraversalStrategyName,
} from "../../../src/git-impl/commit-traversal/index.js";
import { noopInstrumentation } from "../../../src/instrumentation/index.js";
import type { CommitOid } from "../../../src/model/index.js";

type Node = CommitOid;

const oid = (name: string): Node => name as Node;

class TestGraph implements DagTopologyPort<Node, CommitPathSchedulingHint> {
  readonly access: Node[] = [];

  constructor(
    private readonly edges: ReadonlyMap<Node, readonly Node[]>,
    private readonly timestamps: ReadonlyMap<Node, number>,
  ) {}

  async getSuccessors(
    nodeId: Node,
  ): Promise<readonly DagSuccessor<Node, CommitPathSchedulingHint>[]> {
    this.access.push(nodeId);
    const timestamp = this.timestamps.get(nodeId) ?? 0;
    return (this.edges.get(nodeId) ?? []).map((parent) => ({
      nodeId: parent,
      domainHint: { sourceCommitterTimestamp: timestamp },
    }));
  }
}

async function collect(
  strategyName: CommitTraversalStrategyName,
  graph: TestGraph,
  excludeNodeId: Node | undefined,
): Promise<Node[]> {
  const strategy = createCommitTraversalStrategy(strategyName);
  const result: Node[] = [];
  for await (const node of strategy.walk(
    { graph, instrumentation: noopInstrumentation },
    oid("M"),
    excludeNodeId,
  )) {
    result.push(node);
  }
  return result;
}

function makeGraph(timestamps: Record<string, number> = {}): TestGraph {
  return new TestGraph(
    new Map<Node, readonly Node[]>([
      [oid("M"), [oid("A"), oid("B")]],
      [oid("A"), [oid("C")]],
      [oid("B"), [oid("D")]],
      [oid("C"), [oid("R")]],
      [oid("D"), [oid("R")]],
      [oid("E"), [oid("C")]],
      [oid("R"), []],
    ]),
    new Map(Object.entries(timestamps).map(([key, value]) => [oid(key), value])),
  );
}

function makeTimestampPriorityGraph(): TestGraph {
  return new TestGraph(
    new Map<Node, readonly Node[]>([
      [oid("M"), [oid("old-child"), oid("new-child")]],
      [oid("old-child"), [oid("old-parent")]],
      [oid("new-child"), [oid("new-parent")]],
      [oid("old-parent"), []],
      [oid("new-parent"), []],
    ]),
    new Map<Node, number>([
      [oid("M"), 1_000],
      [oid("old-child"), 10],
      [oid("new-child"), 100],
      [oid("old-parent"), 1],
      [oid("new-parent"), 1],
    ]),
  );
}

function indexOfExpandedNode(graph: TestGraph, nodeId: Node): number {
  const index = graph.access.indexOf(nodeId);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("commit traversal strategy resolver", () => {
  it("resolves the default only for undefined and accepts exact strategy names", () => {
    expect(resolveCommitTraversalStrategyName(undefined)).toBe("certified-lazy");
    expect(resolveCommitTraversalStrategyName("certified-lazy")).toBe("certified-lazy");
    expect(resolveCommitTraversalStrategyName("phase-certified-fifo")).toBe("phase-certified-fifo");
    expect(resolveCommitTraversalStrategyName("phase-certified-timestamp")).toBe(
      "phase-certified-timestamp",
    );
  });

  it.each(["", " ", "CERTIFIED-LAZY", "phase-certified", "unknown"])(
    "rejects invalid value %j without normalization",
    (value) => {
      expect(() => resolveCommitTraversalStrategyName(value)).toThrow(
        EXPERIMENTAL_COMMIT_TRAVERSAL_ENV,
      );
      expect(() => resolveCommitTraversalStrategyName(value)).toThrow(JSON.stringify(value));
      expect(() => resolveCommitTraversalStrategyName(value)).toThrow("certified-lazy");
      expect(() => resolveCommitTraversalStrategyName(value)).toThrow("phase-certified-fifo");
      expect(() => resolveCommitTraversalStrategyName(value)).toThrow("phase-certified-timestamp");
    },
  );
});

describe("commit traversal strategy factory", () => {
  it.each<CommitTraversalStrategyName>([
    "certified-lazy",
    "phase-certified-fifo",
    "phase-certified-timestamp",
  ])("sets the descriptor name for %s", (name) => {
    expect(createCommitTraversalStrategy(name).name).toBe(name);
  });

  it("binds certified-lazy to the production LIFO/preserve walker", async () => {
    const result = await collect("certified-lazy", makeGraph(), oid("E"));
    expect(result).toEqual([oid("M"), oid("A"), oid("B"), oid("D")]);
  });

  it("binds phase-certified-fifo to the generic FIFO/preserve phase-certified walker", async () => {
    const result = await collect("phase-certified-fifo", makeGraph(), oid("E"));
    expect(result).toEqual([oid("A"), oid("M"), oid("D"), oid("B")]);
  });

  it("binds phase-certified-timestamp to the Git timestamp priority policy", async () => {
    const fifoGraph = makeTimestampPriorityGraph();
    const timestampGraph = makeTimestampPriorityGraph();

    const fifoResult = await collect("phase-certified-fifo", fifoGraph, undefined);
    const timestampResult = await collect("phase-certified-timestamp", timestampGraph, undefined);

    expect(new Set(timestampResult)).toEqual(new Set(fifoResult));
    expect(timestampResult).toHaveLength(new Set(timestampResult).size);
    expect(fifoResult).toHaveLength(new Set(fifoResult).size);

    expect(indexOfExpandedNode(fifoGraph, oid("old-parent"))).toBeLessThan(
      indexOfExpandedNode(fifoGraph, oid("new-parent")),
    );
    expect(indexOfExpandedNode(timestampGraph, oid("new-parent"))).toBeLessThan(
      indexOfExpandedNode(timestampGraph, oid("old-parent")),
    );
    expect(indexOfExpandedNode(timestampGraph, oid("new-child"))).toBeLessThan(
      indexOfExpandedNode(timestampGraph, oid("old-parent")),
    );
  });

  it("keeps reachable difference membership equal and duplicate-free across modes", async () => {
    const expected = new Set([oid("M"), oid("A"), oid("B"), oid("D")]);
    for (const name of [
      "certified-lazy",
      "phase-certified-fifo",
      "phase-certified-timestamp",
    ] as const) {
      const result = await collect(name, makeGraph({ A: 1, B: 10, C: 100, D: 5 }), oid("E"));
      expect(new Set(result)).toEqual(expected);
      expect(result).toHaveLength(new Set(result).size);
    }
  });

  it("does not let timestamp assignment change membership", async () => {
    const first = await collect(
      "phase-certified-timestamp",
      makeGraph({ A: 1, B: 10, C: 100 }),
      oid("E"),
    );
    const second = await collect(
      "phase-certified-timestamp",
      makeGraph({ A: 100, B: 1, C: 2 }),
      oid("E"),
    );
    expect(new Set(first)).toEqual(new Set(second));
  });
});
