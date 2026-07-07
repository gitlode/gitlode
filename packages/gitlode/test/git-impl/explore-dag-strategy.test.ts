import { describe, expect, it } from "vitest";

import type { DagNodePort, WalkDagContext } from "../../src/git-impl/dag-traversal-strategy.js";
import {
  type CertifiedClosurePhaseResult,
  IntegratedDifferenceState,
  resolveDagCertifiedClosurePhase,
  walkDagPhaseCertifiedDifference,
} from "../../src/git-impl/explore-dag-strategy.js";
import { noopInstrumentation } from "../../src/instrumentation/index.js";

interface TestNode {
  readonly id: string;
}

const unusedPort: DagNodePort<string, TestNode> = {
  async readNode(nodeId) {
    return { id: nodeId };
  },
  getSuccessors: () => [],
};

describe("resolveDagCertifiedClosurePhase", () => {
  it("records a complete exclude path when no split closes", async () => {
    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort({
          EXCLUDE: ["PARENT"],
          PARENT: ["ROOT"],
          ROOT: [],
        }),
      ),
      "EXCLUDE",
    );

    expect(result.kind).toBe("complete-exclude");
    expect(result.certifiedNodes).toEqual(new Set(["EXCLUDE", "PARENT", "ROOT"]));
    if (result.kind === "complete-exclude") {
      expect(result.rootTerminals).toEqual(["ROOT"]);
    }
  });

  it("certifies a closed boundary when split branches rejoin", async () => {
    const reads: string[] = [];
    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort(
          {
            MERGE: ["LEFT", "RIGHT"],
            LEFT: ["JOIN"],
            RIGHT: ["JOIN"],
            JOIN: ["ROOT"],
            ROOT: [],
          },
          reads,
        ),
      ),
      "MERGE",
    );

    expect(result.kind).toBe("closed-boundary");
    expect(result.certifiedNodes).toEqual(new Set(["MERGE", "LEFT", "RIGHT", "JOIN"]));
    if (result.kind === "closed-boundary") {
      expect(result.closedBoundary).toBe("JOIN");
    }
    expect(reads).toEqual(["MERGE", "LEFT", "RIGHT"]);
  });

  it("keeps an unclosed split as complete exclude with both root terminals", async () => {
    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort({
          MERGE: ["LEFT", "RIGHT"],
          LEFT: ["LEFT_ROOT"],
          LEFT_ROOT: [],
          RIGHT: ["RIGHT_ROOT"],
          RIGHT_ROOT: [],
        }),
      ),
      "MERGE",
    );

    expect(result.kind).toBe("complete-exclude");
    expect(result.certifiedNodes).toEqual(
      new Set(["MERGE", "LEFT", "RIGHT", "LEFT_ROOT", "RIGHT_ROOT"]),
    );
    if (result.kind === "complete-exclude") {
      expect(new Set(result.rootTerminals)).toEqual(new Set(["LEFT_ROOT", "RIGHT_ROOT"]));
    }
  });
});

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

    const yielded = await collect(
      walkDagPhaseCertifiedDifference(createContext(port), "HEAD", "C"),
    );

    expect(yielded).toEqual([{ id: "HEAD" }]);
    expect(reads).toEqual(["HEAD", "C"]);
  });
});

describe("walkDagPhaseCertifiedDifference", () => {
  it("returns the include side before a certified single-path exclude boundary", async () => {
    const port = createDagPort({
      HEAD: ["NEW"],
      NEW: ["EXCLUDE"],
      EXCLUDE: ["OLD"],
      OLD: [],
    });

    const yielded = await collect(
      walkDagPhaseCertifiedDifference(createContext(port), "HEAD", "EXCLUDE"),
    );

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["HEAD", "NEW"]));
  });

  it("returns both include merge sides before the exclude boundary", async () => {
    const port = createDagPort({
      HEAD: ["MERGE"],
      MERGE: ["LEFT", "RIGHT"],
      LEFT: ["EXCLUDE"],
      RIGHT: ["EXCLUDE"],
      EXCLUDE: ["OLD"],
      OLD: [],
    });

    const yielded = await collect(
      walkDagPhaseCertifiedDifference(createContext(port), "HEAD", "EXCLUDE"),
    );

    expect(new Set(yielded.map((node) => node.id))).toEqual(
      new Set(["HEAD", "MERGE", "LEFT", "RIGHT"]),
    );
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

function createContext<NodeId extends PropertyKey, Node>(
  nodes: DagNodePort<NodeId, Node>,
): WalkDagContext<NodeId, Node> {
  return {
    nodes,
    instrumentation: noopInstrumentation,
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
