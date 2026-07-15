import { describe, expect, it } from "vitest";

import type { DagTopologyPort, WalkDagContext } from "../../../src/dag/index.js";
import { walkDagNodeIdsPhaseCertifiedDifference } from "../../../src/dag/index.js";
import { createCommitTimestampPhaseCertifiedStrategyOptions } from "../../../src/git-impl/commit-traversal/index.js";
import type { CommitPathSchedulingHint } from "../../../src/git-impl/commit-traversal/index.js";
import { LocalInstrumentationRecorder } from "../../../src/instrumentation/index.js";

interface Fixture {
  readonly successors: Record<string, readonly string[]>;
  readonly timestamps: Record<string, number>;
  readonly start: string;
  readonly exclude: string;
  readonly timestampAnomalyEdges?: ReadonlySet<string>;
}

interface RunResult {
  readonly yielded: readonly string[];
  readonly counters: Record<string, number>;
  readonly reads: readonly string[];
}

describe("phase-certified timestamp-priority efficiency validation", () => {
  it("reduces graph work on a favorable Git-like topology", async () => {
    const fixture = createFavorableFixture("favorable");
    expectGitLikeFixture(fixture);
    expectParentTimestampsToBeNonIncreasing(fixture);

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.reads).toEqual([
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
      "EXCLUDE_MERGE",
      "MAIN_BASE",
      "TOPIC_TIP",
      "MAIN_OLDER",
      "SHARED_JOIN",
      "MAIN_TIP",
      "ROOT",
    ]);
    expect(fifo.reads).toEqual([
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
      "EXCLUDE_MERGE",
      "MAIN_BASE",
      "TOPIC_TIP",
      "MAIN_OLDER",
      "ROOT",
      "SHARED_JOIN",
      "MAIN_TIP",
      "ROOT",
    ]);
    expect(priority.counters.traversal_steps).toBeLessThan(fifo.counters.traversal_steps);
    expect(priority.counters.successor_expansions).toBeLessThan(fifo.counters.successor_expansions);
    expect(priority.counters.exclude_expansions).toBeLessThan(fifo.counters.exclude_expansions);
    expect(priority.counters.main_expansions).toBe(fifo.counters.main_expansions);
  });

  it("uses equal timestamps as a stable-tie control for both frontiers", async () => {
    const favorable = createFavorableFixture("favorable");
    const equal = createFavorableFixture("equal");
    expectGitLikeFixture(equal);

    const favorableFifo = await runFixture(favorable, "fifo");
    const fifo = await runFixture(equal, "fifo");
    const priority = await runFixture(equal, "priority");

    expectMembershipAndOracle(equal, fifo);
    expectMembershipAndOracle(equal, priority);
    expect(priority.yielded).toHaveLength(new Set(priority.yielded).size);
    expect(fifo.reads).toEqual(favorableFifo.reads);
    expect(fifo.counters).toEqual(favorableFifo.counters);
    expect(priority.reads).toEqual(fifo.reads);
    expect(priority.counters).toEqual(fifo.counters);
  });

  it("increases graph work when non-monotonic timestamps favor an unhelpful path", async () => {
    const fixture = createNonMonotonicFixture();
    expectGitLikeFixture(fixture);
    expectParentTimestampsToBeNonIncreasing(fixture);

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.reads).toEqual([
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
      "TOPIC_TIP",
      "MAIN_BASE",
      "ROOT",
      "TOPIC_BASE",
      "ROOT",
    ]);
    expect(fifo.reads).toEqual([
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
      "TOPIC_TIP",
      "MAIN_BASE",
      "TOPIC_BASE",
      "ROOT",
    ]);
    expect(priority.counters.traversal_steps).toBeGreaterThan(fifo.counters.traversal_steps);
    expect(priority.counters.successor_expansions).toBeGreaterThan(
      fifo.counters.successor_expansions,
    );
    expect(priority.counters.exclude_expansions).toBeGreaterThan(fifo.counters.exclude_expansions);
    expect(priority.counters.main_expansions).toBe(fifo.counters.main_expansions);
  });
});

function createFavorableFixture(kind: "favorable" | "equal"): Fixture {
  // INCLUDE_HEAD follows MAIN_TIP on the mainline.
  // EXCLUDE_HEAD follows EXCLUDE_MERGE, an ordinary merge of MAIN_BASE and TOPIC_TIP.
  // MAIN_BASE and TOPIC_TIP are independent parents that converge later at ROOT.
  const successors = {
    INCLUDE_HEAD: ["MAIN_TIP"],
    MAIN_TIP: ["MAIN_BASE"],
    EXCLUDE_HEAD: ["EXCLUDE_MERGE"],
    EXCLUDE_MERGE: ["MAIN_BASE", "TOPIC_TIP"],
    MAIN_BASE: ["MAIN_OLDER"],
    MAIN_OLDER: ["SHARED_JOIN"],
    TOPIC_TIP: ["ROOT"],
    SHARED_JOIN: ["ROOT"],
    ROOT: [],
  } satisfies Record<string, readonly string[]>;

  const timestamps = {
    INCLUDE_HEAD: 1_000,
    MAIN_TIP: 990,
    EXCLUDE_HEAD: 980,
    EXCLUDE_MERGE: 970,
    MAIN_BASE: 960,
    MAIN_OLDER: 950,
    TOPIC_TIP: 940,
    SHARED_JOIN: 930,
    ROOT: 0,
  };

  return {
    successors,
    timestamps: kind === "equal" ? equalTimestamps(successors) : timestamps,
    start: "INCLUDE_HEAD",
    exclude: "EXCLUDE_HEAD",
  };
}

function createNonMonotonicFixture(): Fixture {
  // INCLUDE_HEAD follows MAIN_BASE on the mainline.
  // EXCLUDE_HEAD is an ordinary merge of independent TOPIC_TIP and MAIN_BASE parents.
  // TOPIC_TIP carries the intentional timestamp anomaly on its TOPIC_BASE edge.
  return {
    successors: {
      INCLUDE_HEAD: ["MAIN_BASE"],
      EXCLUDE_HEAD: ["TOPIC_TIP", "MAIN_BASE"],
      TOPIC_TIP: ["TOPIC_BASE"],
      TOPIC_BASE: ["ROOT"],
      MAIN_BASE: ["ROOT"],
      ROOT: [],
    },
    timestamps: {
      INCLUDE_HEAD: 1_000,
      EXCLUDE_HEAD: 990,
      TOPIC_TIP: 420,
      TOPIC_BASE: 970,
      MAIN_BASE: 980,
      ROOT: 0,
    },
    timestampAnomalyEdges: new Set([edgeKey("TOPIC_TIP", "TOPIC_BASE")]),
    start: "INCLUDE_HEAD",
    exclude: "EXCLUDE_HEAD",
  };
}

async function runFixture(fixture: Fixture, policy: "fifo" | "priority"): Promise<RunResult> {
  const recorder = new LocalInstrumentationRecorder(() => 0);
  const reads: string[] = [];
  const yielded: string[] = [];
  const options =
    policy === "priority" ? createCommitTimestampPhaseCertifiedStrategyOptions<string>() : {};

  for await (const nodeId of walkDagNodeIdsPhaseCertifiedDifference<
    string,
    CommitPathSchedulingHint
  >(
    createContext(
      createCommitTimestampDagPort(fixture.successors, fixture.timestamps, reads),
      recorder,
    ),
    fixture.start,
    fixture.exclude,
    options,
  )) {
    yielded.push(nodeId);
  }

  return { yielded, counters: normalizeCounters(recorder.records()[0]?.counters ?? {}), reads };
}

function createCommitTimestampDagPort(
  successorsByNode: Record<string, readonly string[]>,
  timestamps: Record<string, number>,
  reads: string[],
): DagTopologyPort<string, CommitPathSchedulingHint> {
  return {
    async getSuccessors(nodeId) {
      reads.push(nodeId);
      const sourceCommitterTimestamp = timestamps[nodeId];
      if (sourceCommitterTimestamp === undefined)
        throw new Error(`Missing timestamp for ${nodeId}.`);
      return (successorsByNode[nodeId] ?? []).map((successor) => ({
        nodeId: successor,
        domainHint: { sourceCommitterTimestamp },
      }));
    },
  };
}

function createContext<NodeId extends PropertyKey, DomainHint>(
  graph: DagTopologyPort<NodeId, DomainHint>,
  instrumentation: LocalInstrumentationRecorder,
): WalkDagContext<NodeId, DomainHint> {
  return { graph, instrumentation };
}

function expectMembershipAndOracle(fixture: Fixture, result: RunResult): void {
  expect(new Set(result.yielded)).toEqual(
    reachableDifference(fixture.successors, fixture.start, fixture.exclude),
  );
  expect(result.yielded).toHaveLength(new Set(result.yielded).size);
}

function expectGitLikeFixture(fixture: Fixture): void {
  const declared = new Set(Object.keys(fixture.successors));
  const reachableNodes = new Set([
    ...reachable(fixture.successors, fixture.start),
    ...reachable(fixture.successors, fixture.exclude),
  ]);

  expect(reachableNodes).toEqual(declared);
  for (const [nodeId, successors] of Object.entries(fixture.successors)) {
    expect(successors.length, `${nodeId} must have at most two parents`).toBeLessThanOrEqual(2);
    if (successors.length === 2) {
      const [leftParent, rightParent] = successors;
      if (leftParent === undefined || rightParent === undefined) {
        throw new Error(`Expected two parents for ${nodeId}.`);
      }
      expect(
        reachable(fixture.successors, leftParent).has(rightParent),
        `${nodeId} parent ${rightParent} must not be reachable from ${leftParent}`,
      ).toBe(false);
      expect(
        reachable(fixture.successors, rightParent).has(leftParent),
        `${nodeId} parent ${leftParent} must not be reachable from ${rightParent}`,
      ).toBe(false);
    }
    for (const successor of successors) {
      expect(declared.has(successor), `${nodeId} references undeclared parent ${successor}`).toBe(
        true,
      );
    }
  }
}

function expectParentTimestampsToBeNonIncreasing(fixture: Fixture): void {
  const anomalies = fixture.timestampAnomalyEdges ?? new Set<string>();
  let observedAnomalies = 0;

  for (const [child, parents] of Object.entries(fixture.successors)) {
    for (const parent of parents) {
      const key = edgeKey(child, parent);
      if (anomalies.has(key)) {
        observedAnomalies += 1;
        expect(fixture.timestamps[child]).toBeLessThan(fixture.timestamps[parent]);
        continue;
      }
      expect(
        fixture.timestamps[child],
        `${child} should not be older than ${parent}`,
      ).toBeGreaterThanOrEqual(fixture.timestamps[parent] ?? Number.POSITIVE_INFINITY);
    }
  }

  expect(observedAnomalies).toBe(anomalies.size);
}

function reachableDifference(
  successorsByNode: Record<string, readonly string[]>,
  startId: string,
  excludeStartId: string,
): Set<string> {
  const included = reachable(successorsByNode, startId);
  for (const nodeId of reachable(successorsByNode, excludeStartId)) included.delete(nodeId);
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

function equalTimestamps(
  successorsByNode: Record<string, readonly string[]>,
): Record<string, number> {
  return Object.fromEntries(Object.keys(successorsByNode).map((nodeId) => [nodeId, 1]));
}

function edgeKey(child: string, parent: string): string {
  return `${child}->${parent}`;
}

function normalizeCounters(counters: Record<string, number>): Record<string, number> {
  const names = [
    "traversal_steps",
    "successor_expansions",
    "main_expansions",
    "exclude_expansions",
    "stale_steps",
    "closure_phases",
    "classification_runs",
    "classification_newer_nodes",
    "classification_older_nodes",
    "classification_excluded_nodes",
    "certified_hits",
    "certification_yielded_nodes",
    "drain_yielded_nodes",
    "yielded_nodes",
  ];
  return Object.fromEntries(names.map((name) => [name, counters[name] ?? 0]));
}
