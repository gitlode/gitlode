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
): Promise<Node[]> {
  const strategy = createCommitTraversalStrategy(strategyName);
  const result: Node[] = [];
  for await (const node of strategy.walk(
    { graph, instrumentation: noopInstrumentation },
    oid("M"),
    oid("E"),
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
    const result = await collect("certified-lazy", makeGraph());
    expect(result).toEqual([oid("M"), oid("A"), oid("B"), oid("D")]);
  });

  it("binds phase-certified-fifo to the generic FIFO/preserve phase-certified walker", async () => {
    const result = await collect("phase-certified-fifo", makeGraph());
    expect(result).toEqual([oid("A"), oid("M"), oid("D"), oid("B")]);
  });

  it("binds phase-certified-timestamp to the Git timestamp priority policy", async () => {
    const graph = makeGraph({ M: 100, A: 1, B: 10, E: 50 });
    const result = await collect("phase-certified-timestamp", graph);
    expect(result).toEqual([oid("A"), oid("M"), oid("D"), oid("B")]);
  });

  it("keeps reachable difference membership equal and duplicate-free across modes", async () => {
    const expected = new Set([oid("M"), oid("A"), oid("B"), oid("D")]);
    for (const name of [
      "certified-lazy",
      "phase-certified-fifo",
      "phase-certified-timestamp",
    ] as const) {
      const result = await collect(name, makeGraph({ A: 1, B: 10, C: 100, D: 5 }));
      expect(new Set(result)).toEqual(expected);
      expect(result).toHaveLength(new Set(result).size);
    }
  });

  it("does not let timestamp assignment change membership", async () => {
    const first = await collect("phase-certified-timestamp", makeGraph({ A: 1, B: 10, C: 100 }));
    const second = await collect("phase-certified-timestamp", makeGraph({ A: 100, B: 1, C: 2 }));
    expect(new Set(first)).toEqual(new Set(second));
  });
});
