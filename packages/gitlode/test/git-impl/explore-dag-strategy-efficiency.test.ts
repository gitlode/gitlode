import { describe, expect, it } from "vitest";

import { createCommitTimestampPhaseCertifiedStrategyOptions } from "../../src/git-impl/commit-timestamp-frontier-policy.js";
import type { DagTopologyPort, WalkDagContext } from "../../src/git-impl/dag-traversal-strategy.js";
import { walkDagNodeIdsPhaseCertifiedDifference } from "../../src/git-impl/explore-dag-strategy.js";
import type { CommitPathSchedulingHint } from "../../src/git-impl/isomorphic-git-adapter.js";
import { LocalInstrumentationRecorder } from "../../src/instrumentation/index.js";

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
      "OLD_MERGE",
      "OLD_SIDE",
      "OLD_MAIN",
      "OLD_SIDE",
      "FEATURE_BASE",
      "FEATURE_TIP",
      "ROOT",
    ]);
    expect(fifo.reads).toEqual([
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
      "OLD_MERGE",
      "OLD_SIDE",
      "OLD_MAIN",
      "OLD_SIDE",
      "ROOT",
      "FEATURE_BASE",
      "FEATURE_TIP",
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
      "SHARED_MERGE",
      "SHARED_SIDE",
      "ROOT",
      "SHARED_SIDE",
      "RECENT_MERGE",
      "ROOT",
    ]);
    expect(fifo.reads).toEqual([
      "INCLUDE_HEAD",
      "EXCLUDE_HEAD",
      "SHARED_MERGE",
      "SHARED_SIDE",
      "SHARED_SIDE",
      "RECENT_MERGE",
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
  const successors = {
    INCLUDE_HEAD: ["FEATURE_TIP", "EXCLUDE_HEAD"],
    FEATURE_TIP: ["FEATURE_BASE"],
    EXCLUDE_HEAD: ["OLD_MERGE", "OLD_SIDE"],
    OLD_MERGE: ["OLD_MAIN", "OLD_SIDE"],
    OLD_MAIN: ["FEATURE_BASE"],
    FEATURE_BASE: ["ROOT"],
    OLD_SIDE: ["ROOT"],
    ROOT: [],
  } satisfies Record<string, readonly string[]>;

  const timestamps = {
    INCLUDE_HEAD: 1_000,
    FEATURE_TIP: 990,
    EXCLUDE_HEAD: 980,
    OLD_MERGE: 970,
    OLD_MAIN: 960,
    FEATURE_BASE: 950,
    OLD_SIDE: 940,
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
  return {
    successors: {
      INCLUDE_HEAD: ["RECENT_MERGE", "SHARED_MERGE"],
      RECENT_MERGE: ["SHARED_MERGE", "SHARED_SIDE"],
      EXCLUDE_HEAD: ["SHARED_MERGE", "SHARED_SIDE"],
      SHARED_MERGE: ["SHARED_SIDE", "ROOT"],
      SHARED_SIDE: ["ROOT"],
      ROOT: [],
    },
    timestamps: {
      INCLUDE_HEAD: 1_000,
      RECENT_MERGE: 980,
      EXCLUDE_HEAD: 970,
      SHARED_MERGE: 250,
      SHARED_SIDE: 950,
      ROOT: 0,
    },
    timestampAnomalyEdges: new Set([edgeKey("SHARED_MERGE", "SHARED_SIDE")]),
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
