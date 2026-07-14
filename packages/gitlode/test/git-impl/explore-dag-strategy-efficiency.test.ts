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
}

interface RunResult {
  readonly yielded: readonly string[];
  readonly counters: Record<string, number>;
  readonly reads: readonly string[];
}

describe("phase-certified timestamp-priority efficiency validation", () => {
  it("reduces graph work on a favorable Git-like topology", async () => {
    const fixture = createFavorableFixture("favorable");

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.reads).toEqual(["H", "E", "A", "G", "J", "R", "K", "L", "G", "B", "F"]);
    expect(fifo.reads).toEqual(["H", "E", "A", "G", "G", "J", "K", "L", "R", "R", "B", "F"]);
    expect(priority.counters.traversal_steps).toBeLessThan(fifo.counters.traversal_steps);
    expect(priority.counters.successor_expansions).toBeLessThan(fifo.counters.successor_expansions);
    expect(priority.counters.exclude_expansions).toBeLessThan(fifo.counters.exclude_expansions);
    expect(priority.counters.main_expansions).toBe(fifo.counters.main_expansions);
  });

  it("uses equal timestamps as a stable-tie control for both frontiers", async () => {
    const fixture = createFavorableFixture("equal");

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.yielded).toHaveLength(new Set(priority.yielded).size);
    expect(priority.reads).toEqual(fifo.reads);
    expect(priority.counters).toEqual(fifo.counters);
  });

  it("increases graph work when non-monotonic timestamps favor an unhelpful path", async () => {
    const fixture = createNonMonotonicFixture();

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.reads).toEqual([
      "H",
      "E",
      "A",
      "B",
      "C",
      "D",
      "D",
      "F",
      "J",
      "R",
      "R",
      "R",
      "J",
      "L",
      "R",
      "F",
      "F",
      "F",
      "G",
      "L",
      "R",
    ]);
    expect(fifo.reads).toEqual([
      "H",
      "E",
      "A",
      "B",
      "C",
      "D",
      "F",
      "G",
      "L",
      "J",
      "L",
      "D",
      "F",
      "J",
      "F",
      "R",
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
    H: ["B", "F", "G"],
    E: ["A", "G"],
    A: ["G", "J", "K", "L"],
    B: [],
    C: [],
    D: ["F"],
    F: ["J", "K"],
    G: [],
    J: ["R"],
    K: ["R"],
    L: [],
    R: [],
  } satisfies Record<string, readonly string[]>;

  const timestamps = {
    H: 737,
    E: 260,
    A: 770,
    B: 474,
    C: 130,
    D: 906,
    F: 24,
    G: 630,
    J: 998,
    K: 54,
    L: 880,
    R: 1,
  };

  return {
    successors,
    timestamps: kind === "equal" ? equalTimestamps(successors) : timestamps,
    start: "H",
    exclude: "E",
  };
}

function createNonMonotonicFixture(): Fixture {
  return {
    successors: {
      H: ["B", "F", "G", "J"],
      E: ["A", "B", "C", "D"],
      A: ["F", "G", "L"],
      B: ["J", "L"],
      C: ["D", "F", "J"],
      D: ["F"],
      F: ["R"],
      G: ["R"],
      J: ["R"],
      K: [],
      L: ["R"],
      R: [],
    },
    timestamps: {
      H: 365,
      E: 929,
      A: 146,
      B: 207,
      C: 925,
      D: 147,
      F: 661,
      G: 275,
      J: 240,
      K: 111,
      L: 324,
      R: 684,
    },
    start: "H",
    exclude: "E",
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
