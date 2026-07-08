import { describe, expect, it } from "vitest";

import {
  type DagNodePort,
  type WalkDagContext,
  walkDagEagerExclude,
} from "../../src/git-impl/dag-traversal-strategy.js";
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

    expect(result.kind).toBe("exhausted");
    expect(result.certifiedNodes).toEqual(new Set(["EXCLUDE", "PARENT", "ROOT"]));
    if (result.kind === "exhausted") {
      expect(result.terminalNodes).toEqual(["ROOT"]);
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

    expect(result.kind).toBe("exhausted");
    expect(result.certifiedNodes).toEqual(
      new Set(["MERGE", "LEFT", "RIGHT", "LEFT_ROOT", "RIGHT_ROOT"]),
    );
    if (result.kind === "exhausted") {
      expect(new Set(result.terminalNodes)).toEqual(new Set(["LEFT_ROOT", "RIGHT_ROOT"]));
    }
  });
});

describe("IntegratedDifferenceState certified hit resolution", () => {
  it("yields the visited newer side of a single certified hit", async () => {
    const state = await createState({
      A: ["C"],
      C: ["HEAD"],
      HEAD: [],
    });

    const yielded = await collect(state.applyCertification(closedBoundaryResult(["A"], "A")));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["C", "HEAD"]));
  });

  it("excludes the path between simultaneous certified hits", async () => {
    const state = await createState({
      A: ["N"],
      N: ["B"],
      B: ["HEAD"],
      HEAD: [],
    });

    const yielded = await collect(state.applyCertification(closedBoundaryResult(["A", "B"], "A")));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["HEAD"]));
  });

  it("keeps sibling certified-hit regions independent", async () => {
    const state = await createState({
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

  it("prunes the successor side of a certified hit before draining remaining nodes", async () => {
    const state = await createState({
      ROOT: ["A"],
      A: ["C"],
      C: [],
    });

    const yielded = await resolveAndDrain(state, closedBoundaryResult(["A"], "A"));

    expect(new Set(yielded.map((node) => node.id))).toEqual(new Set(["C"]));
  });

  it("excludes an include merge side that is an ancestor of another certified hit", async () => {
    const state = await createState({
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
    const state = await createState({
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

  it("matches eager exclude when the exclude phase closes at a rejoined split", async () => {
    await expectPhaseDifferenceToMatchEager(
      {
        HEAD: ["NEW"],
        NEW: ["EXCLUDE_MERGE"],
        EXCLUDE_MERGE: ["LEFT", "RIGHT"],
        LEFT: ["JOIN"],
        RIGHT: ["JOIN"],
        JOIN: ["OLD"],
        OLD: [],
      },
      "HEAD",
      "EXCLUDE_MERGE",
    );
  });

  it("matches eager exclude when the exclude phase completes without a closed boundary", async () => {
    await expectPhaseDifferenceToMatchEager(
      {
        HEAD: ["NEW"],
        NEW: ["EXCLUDE_MERGE"],
        EXCLUDE_MERGE: ["LEFT", "RIGHT"],
        LEFT: ["LEFT_ROOT"],
        LEFT_ROOT: [],
        RIGHT: ["RIGHT_ROOT"],
        RIGHT_ROOT: [],
      },
      "HEAD",
      "EXCLUDE_MERGE",
    );
  });

  it("matches eager exclude when include paths hit the same exclude boundary", async () => {
    await expectPhaseDifferenceToMatchEager(
      {
        HEAD: ["LEFT", "RIGHT"],
        LEFT: ["EXCLUDE"],
        RIGHT: ["NEW"],
        NEW: ["EXCLUDE"],
        EXCLUDE: ["OLD"],
        OLD: [],
      },
      "HEAD",
      "EXCLUDE",
    );
  });

  it("matches eager exclude when the exclude side is disconnected from include", async () => {
    await expectPhaseDifferenceToMatchEager(
      {
        HEAD: ["NEW"],
        NEW: ["ROOT"],
        ROOT: [],
        EXCLUDE: ["OLD"],
        OLD: [],
      },
      "HEAD",
      "EXCLUDE",
    );
  });
});

async function createState(
  predecessorsByNode: Record<string, readonly string[]>,
): Promise<IntegratedDifferenceState<string, TestNode>> {
  const successorsByNode: Record<string, string[]> = {};

  for (const [successorId, predecessorIds] of Object.entries(predecessorsByNode)) {
    successorsByNode[successorId] ??= [];
    for (const predecessorId of predecessorIds) {
      successorsByNode[predecessorId] ??= [];
      successorsByNode[predecessorId].push(successorId);
    }
  }

  const state = new IntegratedDifferenceState<string, TestNode>(createDagPort(successorsByNode));
  for (const nodeId of Object.keys(successorsByNode)) {
    state.initializeInclude(nodeId);
  }
  for (const nodeId of Object.keys(successorsByNode)) {
    await state.expandInclude(nodeId);
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

async function expectPhaseDifferenceToMatchEager(
  successorsByNode: Record<string, readonly string[]>,
  startId: string,
  excludeStartId: string,
): Promise<void> {
  const phaseResult = await collectNodeIds(
    walkDagPhaseCertifiedDifference(
      createContext(createDagPort(successorsByNode)),
      startId,
      excludeStartId,
    ),
  );
  const eagerResult = await collectNodeIds(
    walkDagEagerExclude(createContext(createDagPort(successorsByNode)), startId, excludeStartId),
  );

  expect(new Set(phaseResult)).toEqual(new Set(eagerResult));
}

async function collectNodeIds(items: AsyncIterable<TestNode>): Promise<string[]> {
  return (await collect(items)).map((node) => node.id);
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
