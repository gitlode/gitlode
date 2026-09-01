import { describe, expect, it } from "vitest";

import {
  resolveDagCertifiedClosurePhase,
  walkDagNodeIdsCertifiedLazy,
  walkDagNodeIdsEagerExclude,
  walkDagReachableNodeIds,
} from "../../src/dag/index.js";
import type {
  DagCertifiedClosureResult,
  DagOperationCompletion,
  DagOperationObservation,
  DagTerminationReason,
} from "../../src/dag/observations.js";
import type { DagTopologyPort, WalkDagContext } from "../../src/dag/types.js";

class RecordingDagOperationObservation implements DagOperationObservation {
  processed = 0;
  stale = 0;
  mainExpansion = 0;
  excludeExpansion = 0;
  yielded = 0;
  excluded = 0;
  fallbackReason: string | undefined;
  fallbackRemoved = 0;
  certification: string | undefined;
  termination: DagTerminationReason | undefined;
  startCount = 0;
  closureResult: DagCertifiedClosureResult | undefined;
  completions: DagOperationCompletion[] = [];

  recordStepProcessed(count = 1): void {
    this.processed += count;
  }

  recordStepStale(count = 1): void {
    this.stale += count;
  }

  recordSuccessorExpansion(role: "main" | "exclude", count = 1): void {
    if (role === "main") this.mainExpansion += count;
    else this.excludeExpansion += count;
  }

  recordNodeYielded(count = 1): void {
    this.yielded += count;
  }

  recordNodeExcluded(count = 1): void {
    this.excluded += count;
  }

  markFallback(reason: string): void {
    this.fallbackReason = reason;
    this.certification = "fallback";
  }

  recordFallbackNodeRemoved(count = 1): void {
    this.fallbackRemoved += count;
  }

  setCertificationResult(result: string): void {
    this.certification = result;
  }

  setTerminationReason(reason: DagTerminationReason): void {
    this.termination = reason;
  }

  recordStartCount(count: number): void {
    this.startCount += count;
  }

  setCertifiedClosureResult(result: DagCertifiedClosureResult): void {
    this.closureResult = result;
  }

  complete(completion: DagOperationCompletion): void {
    this.completions.push(completion);
  }
}

describe("algorithm-neutral DAG observation measurement", () => {
  it("measures reachable duplicate starts and stale work exactly", async () => {
    const observation = new RecordingDagOperationObservation();
    const values = await collect(
      walkDagReachableNodeIds(
        context(
          graph({ ROOT: ["LEFT", "RIGHT"], LEFT: ["LEAF"], RIGHT: ["LEAF"], LEAF: [] }),
          observation,
        ),
        oneShot(["ROOT", "ROOT"]),
      ),
    );

    expect(values).toEqual(["ROOT", "LEFT", "RIGHT", "LEAF"]);
    expect(observation.startCount).toBe(2);
    expect(observation.processed).toBe(6);
    expect(observation.stale).toBe(2);
    expect(observation.mainExpansion).toBe(4);
    expect(observation.yielded).toBe(4);
    expect(observation.completions).toEqual(["exhausted"]);
  });

  it("measures eager exclude terminal evidence and role-specific work", async () => {
    const observation = new RecordingDagOperationObservation();
    await collect(
      walkDagNodeIdsEagerExclude(
        context(graph({ HEAD: ["NEW"], NEW: [], EXCLUDE: ["OLD"], OLD: [] }), observation),
        "HEAD",
        "EXCLUDE",
      ),
    );

    expect(observation.processed).toBe(4);
    expect(observation.mainExpansion).toBe(2);
    expect(observation.excludeExpansion).toBe(2);
    expect(observation.yielded).toBe(2);
    expect(observation.excluded).toBe(2);
    expect(observation.certification).toBe("certified");
    expect(observation.termination).toBe("frontier-exhausted");
    expect(observation.completions).toEqual(["exhausted"]);
  });

  it("measures certified-lazy fallback evidence without losing bounded details", async () => {
    const observation = new RecordingDagOperationObservation();
    await collect(
      walkDagNodeIdsCertifiedLazy(
        context(
          graph({ HEAD: ["NEW"], NEW: [], EXCLUDE: ["LEFT", "RIGHT"], LEFT: [], RIGHT: [] }),
          observation,
        ),
        "HEAD",
        "EXCLUDE",
      ),
    );

    expect(observation.processed).toBe(5);
    expect(observation.mainExpansion).toBe(2);
    expect(observation.excludeExpansion).toBe(4);
    expect(observation.yielded).toBe(2);
    expect(observation.excluded).toBe(3);
    expect(observation.fallbackReason).toBe("open_include_path");
    expect(observation.fallbackRemoved).toBe(0);
    expect(observation.certification).toBe("fallback");
    expect(observation.termination).toBe("frontier-exhausted");
    expect(observation.completions).toEqual(["exhausted"]);
  });

  it("measures certified closure completion and exclude expansion", async () => {
    const observation = new RecordingDagOperationObservation();
    const result = await resolveDagCertifiedClosurePhase(
      context(graph({ ROOT: [] }), observation),
      "ROOT",
    );

    expect(result.kind).toBe("exhausted");
    expect(observation.processed).toBe(1);
    expect(observation.excludeExpansion).toBe(1);
    expect(observation.closureResult).toBe("exhausted");
    expect(observation.completions).toEqual(["success"]);
  });

  it("retains partial measurement through cancellation", async () => {
    const observation = new RecordingDagOperationObservation();
    const iterator = walkDagReachableNodeIds(
      context(graph({ ROOT: ["LEAF"], LEAF: [] }), observation),
      ["ROOT"],
    )[Symbol.asyncIterator]();

    expect(await iterator.next()).toEqual({ value: "ROOT", done: false });
    expect(await iterator.next()).toEqual({ value: "LEAF", done: false });
    await iterator.return?.();

    expect(observation.processed).toBe(2);
    expect(observation.mainExpansion).toBe(1);
    expect(observation.yielded).toBe(2);
    expect(observation.completions).toEqual(["cancelled"]);
  });
});

function graph(successors: Record<string, readonly string[]>): DagTopologyPort<string> {
  return {
    getSuccessors: async (nodeId) => (successors[nodeId] ?? []).map((nodeId) => ({ nodeId })),
  };
}

function context(
  graphPort: DagTopologyPort<string>,
  observation: RecordingDagOperationObservation,
): WalkDagContext<string> {
  return { graph: graphPort, observation };
}

function oneShot<T>(values: readonly T[]): Iterable<T> {
  let consumed = false;
  return {
    [Symbol.iterator](): Iterator<T> {
      if (consumed) throw new Error("one-shot iterable consumed twice");
      consumed = true;
      return values[Symbol.iterator]();
    },
  };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}
