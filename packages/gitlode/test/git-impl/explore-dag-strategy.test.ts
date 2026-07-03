import { describe, expect, it } from "vitest";

import {
  type CertifiedClosurePhaseResult,
  type DagNodePort,
  IntegratedDifferenceState,
  exploreDagDifferenceSketch,
  type IncludeNodeState,
} from "../../src/git-impl/explore-dag-strategy.js";

interface TestNode {
  readonly id: string;
}

const unusedPort: DagNodePort<string, TestNode> = {
  async readNode(nodeId) {
    return { id: nodeId };
  },
  getSuccessors: () => [],
};

describe("IntegratedDifferenceState certified hit resolution", () => {
  it("yields the visited newer side of a single certified hit", async () => {
    const state = createState({
      A: ["C"],
      C: ["HEAD"],
      HEAD: [],
    });

    const yielded = await collect(state.applyCertification(closedBoundaryResult(["A"], "A")));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["C", "HEAD"]));
  });

  it("excludes the path between simultaneous certified hits", async () => {
    const state = createState({
      A: ["N"],
      N: ["B"],
      B: ["HEAD"],
      HEAD: [],
    });

    const yielded = await collect(state.applyCertification(closedBoundaryResult(["A", "B"], "A")));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["HEAD"]));
  });

  it("keeps sibling certified-hit regions independent", async () => {
    const state = createState({
      A: ["A_CHILD"],
      A_CHILD: ["HEAD"],
      B: ["B_CHILD"],
      B_CHILD: ["HEAD"],
      HEAD: [],
    });

    const yielded = await collect(state.applyCertification(closedBoundaryResult(["A", "B"], "A")));

    expect(new Set(yielded.map((node) => node.id))).toEqual(
      new Set(["A_CHILD", "B_CHILD", "HEAD"]),
    );
  });

  it("prunes the parent side of a certified hit before draining remaining nodes", async () => {
    const state = createState({
      ROOT: ["A"],
      A: ["C"],
      C: [],
    });

    const yielded = await resolveAndDrain(state, closedBoundaryResult(["A"], "A"));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["C"]));
  });

  it("excludes an include merge side that is an ancestor of another certified hit", async () => {
    const state = createState({
      A: ["X"],
      X: ["M"],
      Y: ["M"],
      M: ["B"],
      B: ["HEAD"],
      HEAD: [],
    });

    const yielded = await resolveAndDrain(state, closedBoundaryResult(["A", "B"], "A"));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["HEAD"]));
  });

  it("lets descendants of an excluded path yield when they are not ancestors of a hit", async () => {
    const state = createState({
      A: ["X"],
      X: ["B", "Z"],
      B: ["Y"],
      Y: ["Z"],
      Z: ["HEAD"],
      HEAD: [],
    });

    const yielded = await resolveAndDrain(state, closedBoundaryResult(["A", "B"], "A"));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["Y", "Z", "HEAD"]));
  });

  it("lazily skips a stale frontier item produced by DAG traversal", async () => {
    const reads: string[] = [];
    const port = createDagPort(
      {
        HEAD: ["C"],
        C: [],
      },
      reads,
    );

    const yielded = await collect(exploreDagDifferenceSketch("HEAD", "C", port));

    expect(yielded).toEqual([{ id: "HEAD" }]);
    expect(reads).toEqual(["HEAD", "C"]);
  });
});

function createState(
  childrenByNode: Record<string, readonly string[]>,
  port: DagNodePort<string, TestNode> = unusedPort,
): IntegratedDifferenceState<string, TestNode> {
  const state = new IntegratedDifferenceState<string, TestNode>(port);
  for (const nodeId of Object.keys(childrenByNode)) {
    const node = state.stateFor(nodeId);
    node.node = { id: nodeId };
    node.expanded = true;
  }

  for (const [parentId, childIds] of Object.entries(childrenByNode)) {
    const parent = state.stateFor(parentId);
    for (const childId of childIds) {
      const child = state.stateFor(childId);
      parent.children.add(childId);
      child.parents.add(parentId);
    }
  }

  return state;
}

function closedBoundaryResult(
  certifiedNodes: readonly string[],
  closedBoundary: string,
): CertifiedClosurePhaseResult<string> {
  return {
    kind: "closed-boundary",
    certifiedNodes: new Set(certifiedNodes),
    closedBoundary,
  };
}

function createDagPort(
  successorsByNode: Record<string, readonly string[]>,
  reads: string[] = [],
): DagNodePort<string, TestNode> {
  return {
    async readNode(nodeId) {
      reads.push(nodeId);
      return { id: nodeId };
    },
    getSuccessors: (node) => successorsByNode[node.id] ?? [],
  };
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}

async function resolveAndDrain(
  state: IntegratedDifferenceState<string, TestNode>,
  closure: CertifiedClosurePhaseResult<string>,
): Promise<TestNode[]> {
  const result = await collect(state.applyCertification(closure));
  for (const node of state.drainRemainingInclude()) {
    result.push(node);
  }
  return result;
}
