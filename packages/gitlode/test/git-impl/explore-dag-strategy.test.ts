import { describe, expect, it } from "vitest";

import {
  type DagTopologyPort,
  type WalkDagContext,
  walkDagNodeIdsEagerExclude,
  type DagFrontier,
} from "../../src/git-impl/dag-traversal-strategy.js";
import {
  type CertifiedClosurePhaseResult,
  type ClosureFrontierItem,
  type DifferenceFrontierItem,
  IntegratedDifferenceState,
  resolveDagCertifiedClosurePhase,
  walkDagNodeIdsPhaseCertifiedDifference,
} from "../../src/git-impl/explore-dag-strategy.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "../../src/instrumentation/index.js";
import { OrderedQueue, PriorityQueue } from "../../src/support/index.js";

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

  it("certifies only the reached closed region when split/rejoin is nested", async () => {
    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort({
          OUTER: ["LEFT", "RIGHT"],
          LEFT: ["LEFT_INNER"],
          LEFT_INNER: ["LEFT_A", "LEFT_B"],
          LEFT_A: ["LEFT_JOIN"],
          LEFT_B: ["LEFT_JOIN"],
          LEFT_JOIN: ["OUTER_JOIN"],
          RIGHT: ["OUTER_JOIN"],
          OUTER_JOIN: ["ROOT"],
          ROOT: [],
        }),
      ),
      "OUTER",
    );

    expect(result.kind).toBe("closed-boundary");
    expect(result.certifiedNodes).toEqual(
      new Set([
        "OUTER",
        "LEFT",
        "RIGHT",
        "LEFT_INNER",
        "LEFT_A",
        "LEFT_B",
        "LEFT_JOIN",
        "OUTER_JOIN",
      ]),
    );
    if (result.kind === "closed-boundary") {
      expect(result.closedBoundary).toBe("OUTER_JOIN");
    }
  });

  it("keeps a partially rejoined split exhausted when one branch remains terminal", async () => {
    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort({
          SPLIT: ["LEFT", "MIDDLE", "RIGHT"],
          LEFT: ["JOIN"],
          MIDDLE: ["JOIN"],
          RIGHT: ["RIGHT_ROOT"],
          JOIN: ["JOIN_ROOT"],
          RIGHT_ROOT: [],
          JOIN_ROOT: [],
        }),
      ),
      "SPLIT",
    );

    expect(result.kind).toBe("exhausted");
    expect(result.certifiedNodes).toEqual(
      new Set(["SPLIT", "LEFT", "MIDDLE", "RIGHT", "JOIN", "RIGHT_ROOT", "JOIN_ROOT"]),
    );
    if (result.kind === "exhausted") {
      expect(new Set(result.terminalNodes)).toEqual(new Set(["RIGHT_ROOT", "JOIN_ROOT"]));
    }
  });

  it("preserves closure results under a one-to-one node id rename", async () => {
    const dag = {
      MERGE: ["LEFT", "RIGHT"],
      LEFT: ["JOIN"],
      RIGHT: ["JOIN"],
      JOIN: ["ROOT"],
      ROOT: [],
    };
    const renamedDag = renameDag(dag, (nodeId) => `renamed:${nodeId}`);

    const original = await resolveDagCertifiedClosurePhase(
      createContext(createDagPort(dag)),
      "MERGE",
    );
    const renamed = await resolveDagCertifiedClosurePhase(
      createContext(createDagPort(renamedDag)),
      "renamed:MERGE",
    );

    expect(renameClosureResult(original, (nodeId) => `renamed:${nodeId}`)).toEqual(renamed);
  });
});

describe("phase-certified prototype telemetry", () => {
  it("records standalone certified closure telemetry for exhausted closure", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort({
          EXCLUDE: ["PARENT"],
          PARENT: ["ROOT"],
          ROOT: [],
        }),
        recorder,
      ),
      "EXCLUDE",
    );

    expect(result.kind).toBe("exhausted");
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "dag.certified_closure",
        attributes: { result: "exhausted" },
        counters: {
          certified_nodes: 3,
          exclude_expansions: 3,
          successor_expansions: 3,
          terminal_nodes: 1,
          traversal_steps: 3,
        },
      }),
    ]);
  });

  it("records common counters and yield source counters for a linear difference", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const yielded = await collect(
      walkDagNodeIdsPhaseCertifiedDifference(
        createContext(
          createDagPort({
            HEAD: ["NEW"],
            NEW: ["EXCLUDE"],
            EXCLUDE: ["OLD"],
            OLD: [],
          }),
          recorder,
        ),
        "HEAD",
        "EXCLUDE",
      ),
    );

    expect(new Set(yielded)).toEqual(new Set(["HEAD", "NEW"]));
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "dag.traversal",
        attributes: { strategy: "phaseCertified" },
        counters: expect.objectContaining({
          certified_nodes: 2,
          closure_phases: 1,
          certification_yielded_nodes: 2,
          exclude_expansions: 2,
          exhausted_phases: 1,
          main_expansions: 2,
          successor_expansions: 4,
          terminal_nodes: 1,
          traversal_steps: 5,
          yielded_nodes: 2,
        }),
      }),
    ]);
    expect(
      recorder.records().filter((record) => record.name === "dag.certified_closure"),
    ).toHaveLength(0);
  });

  it("records multiple closed-boundary phases without double-counting certified nodes", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const yielded = await collect(
      walkDagNodeIdsPhaseCertifiedDifference(
        createContext(
          createDagPort({
            HEAD: ["NEW"],
            NEW: ["EXCLUDE_MERGE"],
            EXCLUDE_MERGE: ["LEFT", "RIGHT"],
            LEFT: ["JOIN"],
            RIGHT: ["JOIN"],
            JOIN: ["OLD"],
            OLD: [],
          }),
          recorder,
        ),
        "HEAD",
        "EXCLUDE_MERGE",
      ),
    );

    expect(new Set(yielded)).toEqual(new Set(["HEAD", "NEW"]));
    const record = recorder.records()[0];
    expect(record).toEqual(
      expect.objectContaining({
        name: "dag.traversal",
        counters: expect.objectContaining({
          certified_nodes: 5,
          closed_boundary_phases: 1,
          closure_phases: 2,
          exhausted_phases: 1,
        }),
      }),
    );
    expect(record?.counters["certified_nodes"]).toBeLessThan(
      (record?.counters["closure_phases"] ?? 0) + 5,
    );
  });

  it("records certified-hit classification counters and yielded-node source relationships", async () => {
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const yielded = await collect(
      walkDagNodeIdsPhaseCertifiedDifference(
        createContext(
          createDagPort({
            HEAD: ["LEFT", "RIGHT"],
            LEFT: ["EXCLUDE"],
            RIGHT: ["NEW"],
            NEW: ["EXCLUDE"],
            EXCLUDE: ["OLD"],
            OLD: [],
          }),
          recorder,
        ),
        "HEAD",
        "EXCLUDE",
      ),
    );

    expect(new Set(yielded)).toEqual(new Set(["HEAD", "LEFT", "RIGHT", "NEW"]));
    const counters = recorder.records()[0]?.counters ?? {};
    expect(counters).toEqual(
      expect.objectContaining({
        certification_yielded_nodes: 4,
        certified_hits: 2,
        classification_excluded_nodes: 2,
        classification_newer_nodes: 6,
        classification_older_nodes: 2,
        classification_runs: 2,
        yielded_nodes: 4,
      }),
    );
    expect(counters["yielded_nodes"]).toBe(
      (counters["certification_yielded_nodes"] ?? 0) + (counters["drain_yielded_nodes"] ?? 0),
    );
    expect(
      recorder.records().filter((record) => record.name === "dag.certified_closure"),
    ).toHaveLength(0);
  });
});

describe("phase-certified frontier injection", () => {
  it("uses the injected difference frontier and preserves enqueue blocks", async () => {
    const frontiers: RecordingFrontier<DifferenceFrontierItem<string>>[] = [];
    const successorsByNode = {
      HEAD: ["B", "A"],
      A: ["EXCLUDE"],
      B: ["EXCLUDE"],
      EXCLUDE: ["OLD"],
      OLD: [],
    };

    const yielded = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference(
        createContext(createDagPort(successorsByNode)),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () => {
            const frontier = new RecordingFrontier<DifferenceFrontierItem<string>>(
              new OrderedQueue({ dequeueOrder: "lifo", blockOrder: "reverse" }),
            );
            frontiers.push(frontier);
            return frontier;
          },
        },
      ),
    );

    expect(frontiers).toHaveLength(1);
    expect(frontiers[0]?.blocks).toContainEqual([
      { role: "main", nodeId: "HEAD" },
      { role: "exclude", nodeId: "EXCLUDE" },
    ]);
    expect(frontiers[0]?.blocks).toContainEqual([
      { role: "main", nodeId: "B" },
      { role: "main", nodeId: "A" },
    ]);
    expect(frontiers[0]?.dequeued[0]).toEqual({ role: "exclude", nodeId: "EXCLUDE" });
    expect(new Set(yielded)).toEqual(reachableDifference(successorsByNode, "HEAD", "EXCLUDE"));
  });

  it("uses the injected closure frontier for a standalone closure phase", async () => {
    const frontiers: RecordingFrontier<ClosureFrontierItem<string>>[] = [];

    const result = await resolveDagCertifiedClosurePhase(
      createContext(
        createDagPort({
          MERGE: ["LEFT", "RIGHT"],
          LEFT: ["JOIN"],
          RIGHT: ["JOIN"],
          JOIN: ["ROOT"],
          ROOT: [],
        }),
      ),
      "MERGE",
      {
        createClosureFrontier: () => {
          const frontier = new RecordingFrontier<ClosureFrontierItem<string>>(
            new OrderedQueue({ dequeueOrder: "fifo", blockOrder: "preserve" }),
          );
          frontiers.push(frontier);
          return frontier;
        },
      },
    );

    expect(result).toEqual(closedBoundaryResult(["MERGE", "LEFT", "RIGHT", "JOIN"], "JOIN"));
    expect(frontiers).toHaveLength(1);
    const rootItem = frontiers[0]?.blocks[0]?.[0];
    expect(rootItem?.nodeId).toBe("MERGE");
    expect(frontiers[0]?.blocks).toContainEqual([
      {
        nodeId: "LEFT",
        branchId: expect.any(Number) as unknown as ClosureFrontierItem<string>["branchId"],
      },
      {
        nodeId: "RIGHT",
        branchId: expect.any(Number) as unknown as ClosureFrontierItem<string>["branchId"],
      },
    ]);
    const splitBranchIds = frontiers[0]?.blocks
      .find((block) => block.length === 2)
      ?.map((item) => item.branchId);
    expect(new Set(splitBranchIds)).toHaveProperty("size", 2);
  });

  it("creates a fresh closure frontier for each difference closure phase", async () => {
    const frontiers: RecordingFrontier<ClosureFrontierItem<string>>[] = [];

    await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference(
        createContext(
          createDagPort({
            HEAD: ["NEW"],
            NEW: ["EXCLUDE_MERGE"],
            EXCLUDE_MERGE: ["LEFT", "RIGHT"],
            LEFT: ["JOIN"],
            RIGHT: ["JOIN"],
            JOIN: ["OLD"],
            OLD: [],
          }),
        ),
        "HEAD",
        "EXCLUDE_MERGE",
        {
          createClosureFrontier: () => {
            const frontier = new RecordingFrontier<ClosureFrontierItem<string>>(
              new OrderedQueue({ dequeueOrder: "fifo", blockOrder: "preserve" }),
            );
            frontiers.push(frontier);
            return frontier;
          },
        },
      ),
    );

    expect(frontiers).toHaveLength(2);
    expect(frontiers[0]).not.toBe(frontiers[1]);
    expect(frontiers.every((frontier) => frontier.dequeued.length > 0)).toBe(true);
  });

  it("keeps the result set invariant with alternative frontier policies", async () => {
    const successorsByNode = {
      HEAD: ["C", "A", "B"],
      A: ["EXCLUDE"],
      B: ["EXCLUDE"],
      C: ["D"],
      D: ["EXCLUDE"],
      EXCLUDE: ["OLD"],
      OLD: [],
    };

    const yielded = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference(
        createContext(createDagPort(successorsByNode)),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () =>
            new OrderedQueue<DifferenceFrontierItem<string>>({
              dequeueOrder: "lifo",
              blockOrder: "preserve",
            }),
          createClosureFrontier: () =>
            new OrderedQueue<ClosureFrontierItem<string>>({
              dequeueOrder: "lifo",
              blockOrder: "preserve",
            }),
        },
      ),
    );

    expect(new Set(yielded)).toEqual(reachableDifference(successorsByNode, "HEAD", "EXCLUDE"));
    expect(yielded).toHaveLength(new Set(yielded).size);
  });
});

describe("phase-certified DomainHint scheduling", () => {
  it("starts difference with hintless main/exclude items in a stable bootstrap block", async () => {
    const frontiers: RecordingFrontier<DifferenceFrontierItem<string, PathTimestampHint>>[] = [];

    await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(createTimestampDagPort({ HEAD: [], EXCLUDE: [] }, { HEAD: 10, EXCLUDE: 1 })),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () => {
            const frontier = new RecordingFrontier(
              createTimestampPriorityQueue<DifferenceFrontierItem<string, PathTimestampHint>>(),
            );
            frontiers.push(frontier);
            return frontier;
          },
        },
      ),
    );

    expect(frontiers[0]?.blocks[0]).toEqual([
      { role: "main", nodeId: "HEAD" },
      { role: "exclude", nodeId: "EXCLUDE" },
    ]);
    expect(frontiers[0]?.dequeued.slice(0, 2)).toEqual([
      { role: "main", nodeId: "HEAD" },
      { role: "exclude", nodeId: "EXCLUDE" },
    ]);
  });

  it("copies include successor path hints without reading successor timestamps", async () => {
    const frontiers: RecordingFrontier<DifferenceFrontierItem<string, PathTimestampHint>>[] = [];

    await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(
          createTimestampDagPort(
            {
              HEAD: ["OLD_SUCCESSOR", "NEW_SUCCESSOR"],
              OLD_SUCCESSOR: [],
              NEW_SUCCESSOR: [],
              EXCLUDE: [],
            },
            { HEAD: 100, OLD_SUCCESSOR: 1, NEW_SUCCESSOR: 999, EXCLUDE: 0 },
          ),
        ),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () => {
            const frontier = new RecordingFrontier(
              new OrderedQueue<DifferenceFrontierItem<string, PathTimestampHint>>({
                dequeueOrder: "fifo",
                blockOrder: "preserve",
              }),
            );
            frontiers.push(frontier);
            return frontier;
          },
        },
      ),
    );

    expect(frontiers[0]?.blocks).toContainEqual([
      { role: "main", nodeId: "OLD_SUCCESSOR", domainHint: { sourceTimestamp: 100 } },
      { role: "main", nodeId: "NEW_SUCCESSOR", domainHint: { sourceTimestamp: 100 } },
    ]);
  });

  it("propagates closure successor path hints through split branches", async () => {
    const frontiers: RecordingFrontier<ClosureFrontierItem<string, PathTimestampHint>>[] = [];

    const result = await resolveDagCertifiedClosurePhase<string, PathTimestampHint>(
      createContext(
        createTimestampDagPort(
          { MERGE: ["LEFT", "RIGHT"], LEFT: ["JOIN"], RIGHT: ["JOIN"], JOIN: [] },
          { MERGE: 50, LEFT: 40, RIGHT: 30, JOIN: 20 },
        ),
      ),
      "MERGE",
      {
        createClosureFrontier: () => {
          const frontier = new RecordingFrontier(
            new OrderedQueue<ClosureFrontierItem<string, PathTimestampHint>>({
              dequeueOrder: "fifo",
              blockOrder: "preserve",
            }),
          );
          frontiers.push(frontier);
          return frontier;
        },
      },
    );

    expect(result).toEqual(closedBoundaryResult(["MERGE", "LEFT", "RIGHT", "JOIN"], "JOIN"));
    expect(frontiers[0]?.blocks[0]).toEqual([{ nodeId: "MERGE", branchId: expect.any(Number) }]);
    const splitBlock = frontiers[0]?.blocks.find((block) => block.length === 2);
    expect(splitBlock).toEqual([
      { nodeId: "LEFT", branchId: expect.any(Number), domainHint: { sourceTimestamp: 50 } },
      { nodeId: "RIGHT", branchId: expect.any(Number), domainHint: { sourceTimestamp: 50 } },
    ]);
    expect(frontiers[0]?.blocks).toContainEqual([
      { nodeId: "JOIN", branchId: splitBlock?.[0]?.branchId, domainHint: { sourceTimestamp: 40 } },
    ]);
  });

  it("re-expands closure nodes through compliant FIFO scheduling and preserves successor hints", async () => {
    const frontiers: RecordingFrontier<ClosureFrontierItem<string, PathTimestampHint>>[] = [];
    const reads: string[] = [];
    const recorder = new LocalInstrumentationRecorder(() => 0);

    const result = await resolveDagCertifiedClosurePhase<string, PathTimestampHint>(
      createContext(
        createTimestampDagPort(
          {
            MERGE: ["A", "B", "C"],
            A: ["JOIN"],
            B: ["JOIN"],
            C: [],
            JOIN: ["NEXT"],
            NEXT: [],
          },
          { MERGE: 100, A: 90, B: 80, C: 75, JOIN: 70, NEXT: 1 },
          reads,
        ),
        recorder,
      ),
      "MERGE",
      {
        createClosureFrontier: () => {
          const frontier = new RecordingFrontier(
            new OrderedQueue<ClosureFrontierItem<string, PathTimestampHint>>({
              dequeueOrder: "fifo",
              blockOrder: "preserve",
            }),
          );
          frontiers.push(frontier);
          return frontier;
        },
      },
    );

    expect(result.kind).toBe("exhausted");
    expect(result.certifiedNodes).toEqual(new Set(["MERGE", "A", "B", "C", "JOIN", "NEXT"]));
    if (result.kind === "exhausted") {
      expect(new Set(result.terminalNodes)).toEqual(new Set(["C", "NEXT"]));
    }
    expect(reads.filter((nodeId) => nodeId === "JOIN")).toHaveLength(2);
    expect(reads).toEqual(["MERGE", "A", "B", "C", "JOIN", "JOIN", "NEXT", "NEXT"]);
    expect(frontiers[0]?.dequeued.filter((item) => item.nodeId === "JOIN")).toEqual([
      { nodeId: "JOIN", branchId: expect.any(Number), domainHint: { sourceTimestamp: 90 } },
      { nodeId: "JOIN", branchId: expect.any(Number), domainHint: { sourceTimestamp: 80 } },
    ]);
    expect(frontiers[0]?.blocks).toContainEqual([
      { nodeId: "NEXT", branchId: expect.any(Number), domainHint: { sourceTimestamp: 70 } },
    ]);
    expect(
      frontiers[0]?.blocks.filter((block) =>
        block.some((item) => item.nodeId === "NEXT" && item.domainHint?.sourceTimestamp === 70),
      ),
    ).toHaveLength(2);
    expect(recorder.records()[0]?.counters).toEqual(
      expect.objectContaining({
        exclude_expansions: 8,
        successor_expansions: 8,
      }),
    );
  });

  it("keeps difference membership stable when compliant closure re-expansion occurs", async () => {
    const successors = {
      HEAD: ["NEW"],
      NEW: ["MERGE"],
      MERGE: ["A", "B", "C"],
      A: ["JOIN"],
      B: ["JOIN"],
      C: [],
      JOIN: ["NEXT"],
      NEXT: [],
    };
    const reads: string[] = [];

    const yielded = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(
          createTimestampDagPort(
            successors,
            { HEAD: 120, NEW: 110, MERGE: 100, A: 90, B: 80, C: 75, JOIN: 70, NEXT: 1 },
            reads,
          ),
        ),
        "HEAD",
        "MERGE",
        {
          createClosureFrontier: () =>
            new OrderedQueue<ClosureFrontierItem<string, PathTimestampHint>>({
              dequeueOrder: "fifo",
              blockOrder: "preserve",
            }),
        },
      ),
    );

    expect(new Set(yielded)).toEqual(reachableDifference(successors, "HEAD", "MERGE"));
    expect(reads.filter((nodeId) => nodeId === "JOIN")).toHaveLength(2);
  });

  it("keeps path-specific hints for duplicate node ids", async () => {
    const frontiers: RecordingFrontier<DifferenceFrontierItem<string, PathTimestampHint>>[] = [];
    await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(
          createTimestampDagPort(
            { HEAD: ["LEFT", "RIGHT"], LEFT: ["JOIN"], RIGHT: ["JOIN"], JOIN: [], EXCLUDE: [] },
            { HEAD: 100, LEFT: 10, RIGHT: 20, JOIN: 999, EXCLUDE: 0 },
          ),
        ),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () => {
            const f = new RecordingFrontier(
              new OrderedQueue<DifferenceFrontierItem<string, PathTimestampHint>>({
                dequeueOrder: "fifo",
                blockOrder: "preserve",
              }),
            );
            frontiers.push(f);
            return f;
          },
        },
      ),
    );

    const joinItems = frontiers[0]?.blocks.flat().filter((item) => item.nodeId === "JOIN") ?? [];
    expect(joinItems).toEqual([
      { role: "main", nodeId: "JOIN", domainHint: { sourceTimestamp: 10 } },
      { role: "main", nodeId: "JOIN", domainHint: { sourceTimestamp: 20 } },
    ]);
  });

  it("passes closed-boundary trigger hints to the next exclude item and closure root", async () => {
    const differenceFrontiers: RecordingFrontier<
      DifferenceFrontierItem<string, PathTimestampHint>
    >[] = [];
    const closureFrontiers: RecordingFrontier<ClosureFrontierItem<string, PathTimestampHint>>[] =
      [];

    await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(
          createTimestampDagPort(
            {
              HEAD: ["NEW"],
              NEW: ["MERGE"],
              MERGE: ["LEFT", "RIGHT"],
              LEFT: ["JOIN"],
              RIGHT: ["JOIN"],
              JOIN: ["OLD"],
              OLD: [],
            },
            { HEAD: 100, NEW: 90, MERGE: 80, LEFT: 70, RIGHT: 60, JOIN: 50, OLD: 40 },
          ),
        ),
        "HEAD",
        "MERGE",
        {
          createDifferenceFrontier: () => {
            const f = new RecordingFrontier(
              new OrderedQueue<DifferenceFrontierItem<string, PathTimestampHint>>({
                dequeueOrder: "fifo",
                blockOrder: "preserve",
              }),
            );
            differenceFrontiers.push(f);
            return f;
          },
          createClosureFrontier: () => {
            const f = new RecordingFrontier(
              new OrderedQueue<ClosureFrontierItem<string, PathTimestampHint>>({
                dequeueOrder: "fifo",
                blockOrder: "preserve",
              }),
            );
            closureFrontiers.push(f);
            return f;
          },
        },
      ),
    );

    expect(differenceFrontiers[0]?.blocks).toContainEqual([
      { role: "exclude", nodeId: "JOIN", domainHint: { sourceTimestamp: 60 } },
    ]);
    expect(closureFrontiers[1]?.blocks[0]).toEqual([
      { nodeId: "JOIN", branchId: expect.any(Number), domainHint: { sourceTimestamp: 60 } },
    ]);
    const standalone = await resolveDagCertifiedClosurePhase<string, PathTimestampHint>(
      createContext(
        createTimestampDagPort(
          { MERGE: ["A", "B"], A: ["J"], B: ["J"], J: [] },
          { MERGE: 1, A: 2, B: 3, J: 4 },
        ),
      ),
      "MERGE",
    );
    expect("closedBoundaryDomainHint" in standalone).toBe(false);
  });

  it("uses newest-first priority without changing membership, including equal and non-monotonic timestamps", async () => {
    const successors = {
      HEAD: ["LOW", "HIGH", "EQUAL_A", "EQUAL_B"],
      LOW: ["LOW_NEXT"],
      HIGH: ["HIGH_NEXT"],
      EQUAL_A: ["EQUAL_A_NEXT"],
      EQUAL_B: ["EQUAL_B_NEXT"],
      LOW_NEXT: ["EXCLUDE"],
      HIGH_NEXT: ["EXCLUDE"],
      EQUAL_A_NEXT: ["EXCLUDE"],
      EQUAL_B_NEXT: ["EXCLUDE"],
      EXCLUDE: ["OLDER"],
      OLDER: [],
    };
    const timestamps = {
      HEAD: 1,
      LOW: 10,
      HIGH: 100,
      EQUAL_A: 50,
      EQUAL_B: 50,
      LOW_NEXT: 9,
      HIGH_NEXT: 99,
      EQUAL_A_NEXT: 49,
      EQUAL_B_NEXT: 49,
      EXCLUDE: 200,
      OLDER: 300,
    };
    const reads: string[] = [];
    const frontiers: RecordingFrontier<DifferenceFrontierItem<string, PathTimestampHint>>[] = [];
    const yielded = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(createTimestampDagPort(successors, timestamps, reads)),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () => {
            const f = new RecordingFrontier(
              createTimestampPriorityQueue<DifferenceFrontierItem<string, PathTimestampHint>>(),
            );
            frontiers.push(f);
            return f;
          },
          createClosureFrontier: () =>
            createTimestampPriorityQueue<ClosureFrontierItem<string, PathTimestampHint>>(),
        },
      ),
    );

    expect(new Set(yielded)).toEqual(reachableDifference(successors, "HEAD", "EXCLUDE"));
    expect(frontiers[0]?.dequeued.map((item) => item.nodeId)).toContain("HIGH");
    expect(reads.indexOf("HIGH_NEXT")).toBeLessThan(reads.indexOf("EQUAL_A"));
    expect(reads.indexOf("EQUAL_A_NEXT")).toBeLessThan(reads.indexOf("EQUAL_B_NEXT"));
  });

  it("keeps membership invariant when timestamp assignments change", async () => {
    const successors = {
      HEAD: ["A", "B"],
      A: ["A_NEXT"],
      B: ["B_NEXT"],
      A_NEXT: ["EXCLUDE"],
      B_NEXT: ["EXCLUDE"],
      EXCLUDE: ["ROOT"],
      ROOT: [],
    };
    const firstReads: string[] = [];
    const secondReads: string[] = [];
    const first = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(
          createTimestampDagPort(
            successors,
            { HEAD: 1, A: 0, B: 20, A_NEXT: 0, B_NEXT: 0, EXCLUDE: 0, ROOT: 0 },
            firstReads,
          ),
        ),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () =>
            createTimestampPriorityQueue<DifferenceFrontierItem<string, PathTimestampHint>>(),
        },
      ),
    );
    const second = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, PathTimestampHint>(
        createContext(
          createTimestampDagPort(
            successors,
            { HEAD: 1, A: 20, B: 0, A_NEXT: 0, B_NEXT: 0, EXCLUDE: 0, ROOT: 0 },
            secondReads,
          ),
        ),
        "HEAD",
        "EXCLUDE",
        {
          createDifferenceFrontier: () =>
            createTimestampPriorityQueue<DifferenceFrontierItem<string, PathTimestampHint>>(),
        },
      ),
    );

    expect(new Set(first)).toEqual(new Set(second));
    expect(firstReads).not.toEqual(secondReads);
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

    expect(new Set(yielded)).toEqual(new Set(["C", "HEAD"]));
  });

  it("excludes the path between simultaneous certified hits", async () => {
    const state = await createState({
      A: ["N"],
      N: ["B"],
      B: ["HEAD"],
      HEAD: [],
    });

    const yielded = await collect(state.applyCertification(closedBoundaryResult(["A", "B"], "A")));

    expect(new Set(yielded)).toEqual(new Set(["HEAD"]));
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

    expect(new Set(yielded)).toEqual(new Set(["A_CHILD", "B_CHILD", "HEAD"]));
  });

  it("prunes the successor side of a certified hit before draining remaining nodes", async () => {
    const state = await createState({
      ROOT: ["A"],
      A: ["C"],
      C: [],
    });

    const yielded = await resolveAndDrain(state, closedBoundaryResult(["A"], "A"));

    expect(new Set(yielded)).toEqual(new Set(["C"]));
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

    expect(new Set(yielded)).toEqual(new Set(["HEAD"]));
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

    expect(new Set(yielded)).toEqual(new Set(["Y", "Z", "HEAD"]));
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
      walkDagNodeIdsPhaseCertifiedDifference(createContext(port), "HEAD", "C"),
    );

    expect(yielded).toEqual(["HEAD"]);
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
      walkDagNodeIdsPhaseCertifiedDifference(createContext(port), "HEAD", "EXCLUDE"),
    );

    expect(new Set(yielded)).toEqual(new Set(["HEAD", "NEW"]));
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
      walkDagNodeIdsPhaseCertifiedDifference(createContext(port), "HEAD", "EXCLUDE"),
    );

    expect(new Set(yielded)).toEqual(new Set(["HEAD", "MERGE", "LEFT", "RIGHT"]));
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

  it("matches an independent reachable-difference oracle for nested split/rejoin", async () => {
    await expectPhaseDifferenceToMatchReachableDifference(
      {
        HEAD: ["OUTER"],
        OUTER: ["LEFT", "RIGHT"],
        LEFT: ["LEFT_INNER"],
        LEFT_INNER: ["LEFT_A", "LEFT_B"],
        LEFT_A: ["LEFT_JOIN"],
        LEFT_B: ["LEFT_JOIN"],
        LEFT_JOIN: ["EXCLUDE"],
        RIGHT: ["EXCLUDE"],
        EXCLUDE: ["OLD"],
        OLD: [],
      },
      "HEAD",
      "EXCLUDE",
    );
  });

  it("matches an independent reachable-difference oracle after a rejoin then resplit", async () => {
    await expectPhaseDifferenceToMatchReachableDifference(
      {
        HEAD: ["AFTER_LEFT", "AFTER_RIGHT"],
        AFTER_LEFT: ["JOIN"],
        AFTER_RIGHT: ["JOIN"],
        JOIN: ["BEFORE_LEFT", "BEFORE_RIGHT"],
        BEFORE_LEFT: ["EXCLUDE"],
        BEFORE_RIGHT: ["EXCLUDE"],
        EXCLUDE: ["OLD"],
        OLD: [],
      },
      "HEAD",
      "EXCLUDE",
    );
  });

  it("matches an independent reachable-difference oracle for a three-way partial rejoin", async () => {
    await expectPhaseDifferenceToMatchReachableDifference(
      {
        HEAD: ["A", "B", "C"],
        A: ["AB_JOIN"],
        B: ["AB_JOIN"],
        C: ["EXCLUDE"],
        AB_JOIN: ["EXCLUDE"],
        EXCLUDE: ["OLD"],
        OLD: [],
      },
      "HEAD",
      "EXCLUDE",
    );
  });

  it("matches an independent reachable-difference oracle when include and exclude share only older history", async () => {
    await expectPhaseDifferenceToMatchReachableDifference(
      {
        INCLUDE_HEAD: ["INCLUDE_ONLY"],
        INCLUDE_ONLY: ["COMMON"],
        EXCLUDE_HEAD: ["EXCLUDE_ONLY"],
        EXCLUDE_ONLY: ["COMMON"],
        COMMON: ["ROOT"],
        ROOT: [],
      },
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
    );
  });

  it("matches an independent reachable-difference oracle when exclude starts from an include descendant", async () => {
    await expectPhaseDifferenceToMatchReachableDifference(
      {
        HEAD: ["MID"],
        MID: ["EXCLUDE"],
        EXCLUDE: ["ROOT"],
        ROOT: [],
      },
      "MID",
      "HEAD",
    );
  });

  it("matches an independent reachable-difference oracle for criss-cross-style multiple rejoin paths", async () => {
    await expectPhaseDifferenceToMatchReachableDifference(
      {
        HEAD: ["M1", "M2"],
        M1: ["A1", "B0"],
        M2: ["B1", "A0"],
        A1: ["A0"],
        B1: ["B0"],
        A0: ["BASE"],
        B0: ["BASE"],
        BASE: [],
      },
      "HEAD",
      "BASE",
    );
  });
});

interface PathTimestampHint {
  readonly sourceTimestamp: number;
}

function createTimestampDagPort(
  successorsByNode: Record<string, readonly string[]>,
  timestamps: Record<string, number>,
  reads: string[] = [],
): DagTopologyPort<string, PathTimestampHint> {
  return {
    async getSuccessors(nodeId) {
      reads.push(nodeId);
      const sourceTimestamp = timestamps[nodeId];
      if (sourceTimestamp === undefined) throw new Error(`Missing timestamp for ${nodeId}.`);
      return (successorsByNode[nodeId] ?? []).map((successor) => ({
        nodeId: successor,
        domainHint: { sourceTimestamp },
      }));
    },
  };
}

function compareTimestampHintedItems<T extends { readonly domainHint?: PathTimestampHint }>(
  left: T,
  right: T,
): number {
  const leftPriority = left.domainHint?.sourceTimestamp;
  const rightPriority = right.domainHint?.sourceTimestamp;
  if (leftPriority === undefined && rightPriority === undefined) return 0;
  if (leftPriority === undefined) return -1;
  if (rightPriority === undefined) return 1;
  return rightPriority - leftPriority;
}

function createTimestampPriorityQueue<
  T extends { readonly domainHint?: PathTimestampHint },
>(): PriorityQueue<T> {
  return new PriorityQueue(compareTimestampHintedItems);
}

class RecordingFrontier<T> implements DagFrontier<T> {
  readonly blocks: T[][] = [];
  readonly dequeued: T[] = [];

  constructor(private readonly inner: DagFrontier<T>) {}

  get size(): number {
    return this.inner.size;
  }

  isEmpty(): boolean {
    return this.inner.isEmpty();
  }

  enqueue(...items: T[]): void {
    this.blocks.push([...items]);
    this.inner.enqueue(...items);
  }

  enqueueMany(items: Iterable<T>): void {
    const block = Array.from(items);
    this.blocks.push(block);
    this.inner.enqueueMany(block);
  }

  peek(): T | undefined {
    return this.inner.peek();
  }

  peekOrThrow(): T {
    return this.inner.peekOrThrow();
  }

  dequeue(): T | undefined {
    const item = this.inner.dequeue();
    if (item !== undefined) this.dequeued.push(item);
    return item;
  }

  dequeueOrThrow(): T {
    const item = this.inner.dequeueOrThrow();
    this.dequeued.push(item);
    return item;
  }

  clear(): void {
    this.inner.clear();
  }
}

async function createState(
  predecessorsByNode: Record<string, readonly string[]>,
): Promise<IntegratedDifferenceState<string>> {
  const successorsByNode: Record<string, string[]> = {};

  for (const [successorId, predecessorIds] of Object.entries(predecessorsByNode)) {
    successorsByNode[successorId] ??= [];
    for (const predecessorId of predecessorIds) {
      successorsByNode[predecessorId] ??= [];
      successorsByNode[predecessorId].push(successorId);
    }
  }

  const state = new IntegratedDifferenceState<string>(createDagPort(successorsByNode));
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
): DagTopologyPort<string> {
  return {
    async getSuccessors(nodeId) {
      reads.push(nodeId);
      return (successorsByNode[nodeId] ?? []).map((successor) => ({ nodeId: successor }));
    },
  };
}

function createContext<NodeId extends PropertyKey>(
  graph: DagTopologyPort<NodeId>,
  instrumentation = noopInstrumentation,
): WalkDagContext<NodeId> {
  return {
    graph,
    instrumentation,
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
    walkDagNodeIdsPhaseCertifiedDifference(
      createContext(createDagPort(successorsByNode)),
      startId,
      excludeStartId,
    ),
  );
  const eagerResult = await collectNodeIds(
    walkDagNodeIdsEagerExclude(
      createContext(createDagPort(successorsByNode)),
      startId,
      excludeStartId,
    ),
  );

  expect(new Set(phaseResult)).toEqual(new Set(eagerResult));
}

async function expectPhaseDifferenceToMatchReachableDifference(
  successorsByNode: Record<string, readonly string[]>,
  startId: string,
  excludeStartId: string,
): Promise<void> {
  const yielded = await collectNodeIds(
    walkDagNodeIdsPhaseCertifiedDifference(
      createContext(createDagPort(successorsByNode)),
      startId,
      excludeStartId,
    ),
  );

  expect(new Set(yielded)).toEqual(reachableDifference(successorsByNode, startId, excludeStartId));
  expect(yielded).toHaveLength(new Set(yielded).size);
}

function reachableDifference(
  successorsByNode: Record<string, readonly string[]>,
  startId: string,
  excludeStartId: string,
): Set<string> {
  const included = reachable(successorsByNode, startId);
  for (const nodeId of reachable(successorsByNode, excludeStartId)) {
    included.delete(nodeId);
  }
  return included;
}

function reachable(
  successorsByNode: Record<string, readonly string[]>,
  startId: string,
): Set<string> {
  const result = new Set<string>();
  const pending = [startId];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (nodeId === undefined || result.has(nodeId)) continue;
    result.add(nodeId);
    pending.push(...(successorsByNode[nodeId] ?? []));
  }
  return result;
}

function renameDag(
  successorsByNode: Record<string, readonly string[]>,
  rename: (nodeId: string) => string,
): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(successorsByNode).map(([nodeId, successors]) => [
      rename(nodeId),
      successors.map(rename),
    ]),
  );
}

function renameClosureResult(
  result: CertifiedClosurePhaseResult<string>,
  rename: (nodeId: string) => string,
): CertifiedClosurePhaseResult<string> {
  if (result.kind === "closed-boundary") {
    return {
      kind: "closed-boundary",
      certifiedNodes: new Set([...result.certifiedNodes].map(rename)),
      closedBoundary: rename(result.closedBoundary),
    };
  }

  return {
    kind: "exhausted",
    certifiedNodes: new Set([...result.certifiedNodes].map(rename)),
    terminalNodes: result.terminalNodes.map(rename),
  };
}

async function collectNodeIds(items: AsyncIterable<string>): Promise<string[]> {
  return await collect(items);
}

async function resolveAndDrain(
  state: IntegratedDifferenceState<string>,
  closure: CertifiedClosurePhaseResult<string>,
): Promise<string[]> {
  const result = await collect(state.applyCertification(closure));
  for (const nodeId of state.drainRemainingInclude()) {
    result.push(nodeId);
  }
  return result;
}
