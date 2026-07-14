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
  it("compares FIFO and timestamp priority on a Git-like favorable topology", async () => {
    const fixture = createGitLikeFixture("favorable");

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.reads.indexOf("RECENT_1")).toBeLessThan(fifo.reads.indexOf("RECENT_1"));
    expect(priority.counters.successor_expansions).toBeLessThanOrEqual(
      fifo.counters.successor_expansions,
    );
    expect(priority.counters.main_expansions).toBeLessThanOrEqual(fifo.counters.main_expansions);
  });

  it("uses equal timestamps as a stable-tie control for both frontiers", async () => {
    const fixture = createGitLikeFixture("equal");

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.yielded).toHaveLength(new Set(priority.yielded).size);
    expect(priority.reads).toEqual(fifo.reads);
    expect(priority.counters).toEqual(fifo.counters);
  });

  it("shows non-monotonic timestamps are only a heuristic, not a guarantee", async () => {
    const fixture = createGitLikeFixture("non-monotonic");

    const fifo = await runFixture(fixture, "fifo");
    const priority = await runFixture(fixture, "priority");

    expectMembershipAndOracle(fixture, fifo);
    expectMembershipAndOracle(fixture, priority);
    expect(priority.reads.indexOf("DISTRACT_1")).toBeLessThan(fifo.reads.indexOf("DISTRACT_1"));
    expect(priority.counters.traversal_steps).toBeGreaterThanOrEqual(fifo.counters.traversal_steps);
    expect(priority.counters.successor_expansions).toBeGreaterThanOrEqual(
      fifo.counters.successor_expansions,
    );
  });
});

function createGitLikeFixture(kind: "favorable" | "equal" | "non-monotonic"): Fixture {
  const successors = {
    HEAD: ["DISTRACT", "RECENT"],
    EXCLUDE: ["OLD_LEFT", "OLD_RIGHT"],
    OLD_LEFT: ["JOIN"],
    OLD_RIGHT: ["JOIN"],
    JOIN: ["DISTRACT"],
    DISTRACT: ["DISTRACT_1", "DISTRACT_2", "DISTRACT_3", "DISTRACT_4"],
    DISTRACT_1: ["ROOT"],
    DISTRACT_2: ["ROOT"],
    DISTRACT_3: ["ROOT"],
    DISTRACT_4: ["ROOT"],
    ROOT: [],
    RECENT: ["RECENT_1"],
    RECENT_1: ["JOIN"],
  } satisfies Record<string, readonly string[]>;

  const favorable = {
    HEAD: 1_000,
    EXCLUDE: 900,
    OLD_LEFT: 800,
    OLD_RIGHT: 800,
    JOIN: 700,
    DISTRACT: 10,
    DISTRACT_1: 10,
    DISTRACT_2: 10,
    DISTRACT_3: 10,
    DISTRACT_4: 10,
    ROOT: 1,
    RECENT: 1_000,
    RECENT_1: 1_000,
  };

  const timestamps =
    kind === "equal"
      ? Object.fromEntries(Object.keys(successors).map((nodeId) => [nodeId, 1]))
      : kind === "non-monotonic"
        ? { ...favorable, DISTRACT: 2_000, DISTRACT_1: 2_000, DISTRACT_2: 2_000 }
        : favorable;

  return { successors, timestamps, start: "HEAD", exclude: "EXCLUDE" };
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

function normalizeCounters(counters: Record<string, number>): Record<string, number> {
  const names = [
    "traversal_steps",
    "successor_expansions",
    "main_expansions",
    "exclude_expansions",
    "stale_steps",
    "closure_phases",
    "classification_runs",
    "certified_hits",
    "certification_yielded_nodes",
    "drain_yielded_nodes",
    "yielded_nodes",
  ];
  return Object.fromEntries(names.map((name) => [name, counters[name] ?? 0]));
}
