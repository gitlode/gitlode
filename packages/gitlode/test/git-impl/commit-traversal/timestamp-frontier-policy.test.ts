import { describe, expect, it } from "vitest";

import {
  type ClosureFrontierItem,
  type DagFrontier,
  type DagTopologyPort,
  type DifferenceFrontierItem,
  type WalkDagContext,
  walkDagNodeIdsPhaseCertifiedDifference,
} from "../../../src/dag/index.js";
import {
  type CommitPathSchedulingHint,
  createCommitTimestampPhaseCertifiedStrategyOptions,
  createCommitTimestampPriorityFrontier,
} from "../../../src/git-impl/commit-traversal/index.js";
import { noopInstrumentation } from "../../../src/instrumentation/index.js";

describe("Git commit timestamp priority frontier policy", () => {
  it("orders hintless bootstrap work before hinted work and keeps stable hintless order", () => {
    const queue =
      createCommitTimestampPriorityFrontier<
        DifferenceFrontierItem<string, CommitPathSchedulingHint>
      >();

    queue.enqueue(
      { role: "main", nodeId: "hinted", domainHint: { sourceCommitterTimestamp: 100 } },
      { role: "main", nodeId: "main-start" },
      { role: "exclude", nodeId: "exclude-start" },
    );

    expect(dequeueNodeIds(queue)).toEqual(["main-start", "exclude-start", "hinted"]);
  });

  it("orders hinted paths newest-first while keeping equal timestamps stable", () => {
    const queue =
      createCommitTimestampPriorityFrontier<
        DifferenceFrontierItem<string, CommitPathSchedulingHint>
      >();

    queue.enqueueMany([
      { role: "main", nodeId: "older", domainHint: { sourceCommitterTimestamp: 10 } },
      { role: "main", nodeId: "equal-a", domainHint: { sourceCommitterTimestamp: 50 } },
      { role: "main", nodeId: "newer", domainHint: { sourceCommitterTimestamp: 100 } },
      { role: "main", nodeId: "equal-b", domainHint: { sourceCommitterTimestamp: 50 } },
    ]);

    expect(dequeueNodeIds(queue)).toEqual(["newer", "equal-a", "equal-b", "older"]);
  });

  it("keeps duplicate node paths separate and orders by each path hint", () => {
    const queue =
      createCommitTimestampPriorityFrontier<
        DifferenceFrontierItem<string, CommitPathSchedulingHint>
      >();

    queue.enqueue(
      { role: "main", nodeId: "JOIN", domainHint: { sourceCommitterTimestamp: 10 } },
      { role: "main", nodeId: "JOIN", domainHint: { sourceCommitterTimestamp: 20 } },
    );

    expect(queue.dequeueOrThrow()).toEqual({
      role: "main",
      nodeId: "JOIN",
      domainHint: { sourceCommitterTimestamp: 20 },
    });
    expect(queue.dequeueOrThrow()).toEqual({
      role: "main",
      nodeId: "JOIN",
      domainHint: { sourceCommitterTimestamp: 10 },
    });
  });

  it("keeps enqueueMany equal-priority items stable and resets stability after clear", () => {
    const queue =
      createCommitTimestampPriorityFrontier<
        DifferenceFrontierItem<string, CommitPathSchedulingHint>
      >();

    queue.enqueueMany([
      { role: "main", nodeId: "before-clear-a", domainHint: { sourceCommitterTimestamp: 1 } },
      { role: "main", nodeId: "before-clear-b", domainHint: { sourceCommitterTimestamp: 1 } },
    ]);
    queue.clear();
    queue.enqueueMany([
      { role: "main", nodeId: "after-clear-a", domainHint: { sourceCommitterTimestamp: 1 } },
      { role: "main", nodeId: "after-clear-b", domainHint: { sourceCommitterTimestamp: 1 } },
    ]);

    expect(dequeueNodeIds(queue)).toEqual(["after-clear-a", "after-clear-b"]);
  });

  it("does not use role or branch id as priority tie-breakers", () => {
    const queue = createCommitTimestampPriorityFrontier<
      | DifferenceFrontierItem<string, CommitPathSchedulingHint>
      | ClosureFrontierItem<string, CommitPathSchedulingHint>
    >();

    queue.enqueueMany([
      { role: "exclude", nodeId: "exclude", domainHint: { sourceCommitterTimestamp: 5 } },
      {
        nodeId: "closure",
        branchId: 999 as ClosureFrontierItem<string>["branchId"],
        domainHint: { sourceCommitterTimestamp: 5 },
      },
      { role: "main", nodeId: "main", domainHint: { sourceCommitterTimestamp: 5 } },
    ]);

    expect(dequeueNodeIds(queue)).toEqual(["exclude", "closure", "main"]);
  });

  it("creates fresh phase-certified frontier instances for each factory call", () => {
    const options = createCommitTimestampPhaseCertifiedStrategyOptions<string>();

    const firstDifference = options.createDifferenceFrontier?.();
    const secondDifference = options.createDifferenceFrontier?.();
    const firstClosure = options.createClosureFrontier?.();
    const secondClosure = options.createClosureFrontier?.();

    expect(firstDifference).toBeDefined();
    expect(secondDifference).toBeDefined();
    expect(firstClosure).toBeDefined();
    expect(secondClosure).toBeDefined();
    expect(firstDifference).not.toBe(secondDifference);
    expect(firstClosure).not.toBe(secondClosure);
    expect(firstDifference).not.toBe(firstClosure);
  });

  it("injects the same policy into phase-certified difference and closure frontiers", async () => {
    const successors = {
      HEAD: ["LOW", "HIGH", "EQUAL_A", "EQUAL_B"],
      LOW: ["LOW_NEXT"],
      HIGH: ["HIGH_NEXT"],
      EQUAL_A: ["EQUAL_A_NEXT"],
      EQUAL_B: ["EQUAL_B_NEXT"],
      LOW_NEXT: ["MERGE"],
      HIGH_NEXT: ["MERGE"],
      EQUAL_A_NEXT: ["MERGE"],
      EQUAL_B_NEXT: ["MERGE"],
      MERGE: ["LEFT", "RIGHT"],
      LEFT: ["JOIN"],
      RIGHT: ["JOIN"],
      JOIN: ["OLD"],
      OLD: [],
    };
    const reads: string[] = [];
    const differenceFrontiers: RecordingFrontier<
      DifferenceFrontierItem<string, CommitPathSchedulingHint>
    >[] = [];
    const closureFrontiers: RecordingFrontier<
      ClosureFrontierItem<string, CommitPathSchedulingHint>
    >[] = [];
    const policyOptions = createCommitTimestampPhaseCertifiedStrategyOptions<string>();

    const yielded = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, CommitPathSchedulingHint>(
        createContext(
          createCommitTimestampDagPort(
            successors,
            {
              HEAD: 1,
              LOW: 10,
              HIGH: 100,
              EQUAL_A: 50,
              EQUAL_B: 50,
              LOW_NEXT: 9,
              HIGH_NEXT: 99,
              EQUAL_A_NEXT: 49,
              EQUAL_B_NEXT: 49,
              MERGE: 80,
              LEFT: 70,
              RIGHT: 60,
              JOIN: 500,
              OLD: 0,
            },
            reads,
          ),
        ),
        "HEAD",
        "MERGE",
        {
          createDifferenceFrontier: () => {
            const frontier = new RecordingFrontier(policyOptions.createDifferenceFrontier!());
            differenceFrontiers.push(frontier);
            return frontier;
          },
          createClosureFrontier: () => {
            const frontier = new RecordingFrontier(policyOptions.createClosureFrontier!());
            closureFrontiers.push(frontier);
            return frontier;
          },
        },
      ),
    );

    expect(differenceFrontiers).toHaveLength(1);
    expect(closureFrontiers).toHaveLength(1);
    expect(differenceFrontiers[0]).not.toBe(closureFrontiers[0]);
    expect(differenceFrontiers[0]?.dequeued.slice(0, 2)).toEqual([
      { role: "main", nodeId: "HEAD" },
      { role: "exclude", nodeId: "MERGE" },
    ]);
    expect(reads.indexOf("HIGH_NEXT")).toBeLessThan(reads.indexOf("EQUAL_A"));
    expect(reads.indexOf("EQUAL_A_NEXT")).toBeLessThan(reads.indexOf("EQUAL_B_NEXT"));
    expect(closureFrontiers[0]?.dequeued.map((item) => item.nodeId)).toEqual(["LEFT", "RIGHT"]);
    expect(differenceFrontiers[0]?.blocks).toContainEqual([
      { role: "exclude", nodeId: "JOIN", domainHint: { sourceCommitterTimestamp: 60 } },
    ]);
    expect(differenceFrontiers[0]?.blocks).toContainEqual([
      { role: "exclude", nodeId: "OLD", domainHint: { sourceCommitterTimestamp: 500 } },
    ]);
    expect(new Set(yielded)).toEqual(reachableDifference(successors, "HEAD", "MERGE"));
  });

  it("uses the phase-certified options factory for closure newest-first scheduling", async () => {
    const successors = {
      HEAD: ["MERGE"],
      MERGE: ["A", "B", "C"],
      A: ["A_NEXT"],
      A_NEXT: [],
      B: ["B_NEXT"],
      B_NEXT: [],
      C: [],
    };
    const closureFrontiers: RecordingFrontier<
      ClosureFrontierItem<string, CommitPathSchedulingHint>
    >[] = [];
    const policyOptions = createCommitTimestampPhaseCertifiedStrategyOptions<string>();

    const yielded = await collectNodeIds(
      walkDagNodeIdsPhaseCertifiedDifference<string, CommitPathSchedulingHint>(
        createContext(
          createCommitTimestampDagPort(successors, {
            HEAD: 10,
            MERGE: 1,
            A: 100,
            A_NEXT: 0,
            B: 2,
            B_NEXT: 0,
            C: 0,
          }),
        ),
        "HEAD",
        "MERGE",
        {
          createDifferenceFrontier: () => policyOptions.createDifferenceFrontier!(),
          createClosureFrontier: () => {
            const frontier = new RecordingFrontier(policyOptions.createClosureFrontier!());
            closureFrontiers.push(frontier);
            return frontier;
          },
        },
      ),
    );

    expect(closureFrontiers[0]?.dequeued.map((item) => item.nodeId)).toEqual([
      "A",
      "A_NEXT",
      "B",
      "B_NEXT",
      "C",
    ]);
    expect(new Set(yielded)).toEqual(reachableDifference(successors, "HEAD", "MERGE"));
  });

  it("keeps phase-certified membership invariant when Git timestamp assignments change", async () => {
    const successors = {
      HEAD: ["A", "B"],
      A: ["A_NEXT"],
      B: ["B_NEXT"],
      A_NEXT: ["EXCLUDE"],
      B_NEXT: ["EXCLUDE"],
      EXCLUDE: ["ROOT"],
      ROOT: [],
    };

    const collectWithTimestamps = async (timestamps: Record<string, number>): Promise<string[]> =>
      await collectNodeIds(
        walkDagNodeIdsPhaseCertifiedDifference<string, CommitPathSchedulingHint>(
          createContext(createCommitTimestampDagPort(successors, timestamps)),
          "HEAD",
          "EXCLUDE",
          {
            createDifferenceFrontier: () =>
              createCommitTimestampPriorityFrontier<
                DifferenceFrontierItem<string, CommitPathSchedulingHint>
              >(),
            createClosureFrontier: () =>
              createCommitTimestampPriorityFrontier<
                ClosureFrontierItem<string, CommitPathSchedulingHint>
              >(),
          },
        ),
      );

    const first = await collectWithTimestamps({
      HEAD: 1,
      A: 1,
      B: 100,
      A_NEXT: 1,
      B_NEXT: 100,
      EXCLUDE: 500,
      ROOT: 0,
    });
    const second = await collectWithTimestamps({
      HEAD: 1,
      A: 100,
      B: 1,
      A_NEXT: 100,
      B_NEXT: 1,
      EXCLUDE: 500,
      ROOT: 0,
    });

    expect(new Set(first)).toEqual(reachableDifference(successors, "HEAD", "EXCLUDE"));
    expect(new Set(second)).toEqual(reachableDifference(successors, "HEAD", "EXCLUDE"));
  });
});
function createCommitTimestampDagPort(
  successorsByNode: Record<string, readonly string[]>,
  timestamps: Record<string, number>,
  reads: string[] = [],
): DagTopologyPort<string, CommitPathSchedulingHint> {
  return {
    async getSuccessors(nodeId) {
      reads.push(nodeId);
      const sourceCommitterTimestamp = timestamps[nodeId];
      if (sourceCommitterTimestamp === undefined) {
        throw new Error(`Missing timestamp for ${nodeId}.`);
      }
      return (successorsByNode[nodeId] ?? []).map((successor) => ({
        nodeId: successor,
        domainHint: { sourceCommitterTimestamp },
      }));
    },
  };
}

function dequeueNodeIds<T extends { readonly nodeId: string }>(queue: DagFrontier<T>): string[] {
  const result: string[] = [];
  while (!queue.isEmpty()) {
    result.push(queue.dequeueOrThrow().nodeId);
  }
  return result;
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

async function collectNodeIds(items: AsyncIterable<string>): Promise<string[]> {
  return await collect(items);
}
