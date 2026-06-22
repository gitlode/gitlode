import { describe, expect, it } from "vitest";

import { IsomorphicGitAdapter } from "../../src/git-impl/isomorphic-git-adapter.js";
import { JsDiffAdapter } from "../../src/git-impl/js-diff-adapter.js";
import { GitAdapterError, type RawCommit } from "../../src/git/index.js";
import type { CommitOid } from "../../src/model/index.js";
import {
  assertOidSet,
  buildDag,
  expectedLabels,
  expectedOids,
  type BuiltDag,
  type DagDefinition,
} from "../support/commit-dag.js";

type Walker = (dag: BuiltDag, head: CommitOid, exclude?: CommitOid) => Promise<RawCommit[]>;

const walkers: readonly { readonly name: string; readonly walk: Walker }[] = [
  {
    name: "legacy",
    async walk(dag, head, exclude) {
      const adapter = new IsomorphicGitAdapter({ fs: dag.fs, diffAdapter: new JsDiffAdapter() });
      const commits: RawCommit[] = [];
      for await (const commit of adapter.walkCommits("/", head, exclude)) commits.push(commit);
      return commits;
    },
  },
  // BS-04 adds the optimized walker here. Every normal-DAG case then applies unchanged.
];

const cases: readonly DagDefinition[] = [
  {
    name: "linear history",
    nodes: { root: {}, middle: { parents: ["root"] }, head: { parents: ["middle"] } },
    head: "head",
  },
  {
    name: "head equals exclude",
    nodes: { root: {}, head: { parents: ["root"] } },
    head: "head",
    exclude: "head",
  },
  {
    name: "release dominates every path to HEAD",
    nodes: {
      root: {},
      release: { parents: ["root"] },
      left: { parents: ["release"] },
      right: { parents: ["release"] },
      head: { parents: ["left", "right"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "branch created and merged after release",
    nodes: {
      root: {},
      release: { parents: ["root"] },
      main: { parents: ["release"] },
      side: { parents: ["release"] },
      head: { parents: ["main", "side"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "branch forked before release and merged afterward",
    nodes: {
      root: {},
      fork: { parents: ["root"] },
      release: { parents: ["fork"] },
      main: { parents: ["release"] },
      side1: { parents: ["fork"] },
      side2: { parents: ["side1"] },
      head: { parents: ["main", "side2"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "unreachable exclude with a common ancestor",
    nodes: {
      root: {},
      common: { parents: ["root"] },
      head: { parents: ["common"] },
      exclude: { parents: ["common"] },
    },
    head: "head",
    exclude: "exclude",
  },
  {
    name: "fully disconnected head and exclude",
    nodes: {
      headRoot: {},
      head: { parents: ["headRoot"] },
      excludeRoot: {},
      exclude: { parents: ["excludeRoot"] },
    },
    head: "head",
    exclude: "exclude",
  },
  {
    name: "multiple merges",
    nodes: {
      root: {},
      a: { parents: ["root"] },
      b: { parents: ["root"] },
      merge1: { parents: ["a", "b"] },
      c: { parents: ["a"] },
      head: { parents: ["merge1", "c"] },
    },
    head: "head",
  },
  {
    name: "three-parent merge",
    nodes: {
      root: {},
      a: { parents: ["root"] },
      b: { parents: ["root"] },
      c: { parents: ["root"] },
      head: { parents: ["a", "b", "c"] },
    },
    head: "head",
  },
  {
    name: "multiple paths converge on one ancestor",
    nodes: {
      root: {},
      common: { parents: ["root"] },
      a: { parents: ["common"] },
      b: { parents: ["common"] },
      c: { parents: ["common"] },
      head: { parents: ["a", "b", "c"] },
    },
    head: "head",
  },
  {
    name: "single-anchor certificate candidate",
    nodes: {
      old3: {},
      old2: { parents: ["old3"] },
      old1: { parents: ["old2"] },
      release: { parents: ["old1"] },
      after: { parents: ["release"] },
      head: { parents: ["after"] },
    },
    head: "head",
    exclude: "release",
    expectedRead: {
      unread: ["old1", "old2", "old3"],
      note: "A: a successful certificate must not read the long pre-release chain",
    },
  },
  {
    name: "exclude frontier has multiple anchors and falls back",
    nodes: {
      root: {},
      leftAnchor: { parents: ["root"] },
      rightAnchor: { parents: ["root"] },
      release: { parents: ["leftAnchor", "rightAnchor"] },
      main: { parents: ["release"] },
      side: { parents: ["leftAnchor"] },
      head: { parents: ["main", "side"] },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "pre-release branch converges at a single anchor",
    nodes: {
      oldRoot: {},
      old: { parents: ["oldRoot"] },
      common: { parents: ["old"] },
      release: { parents: ["common"] },
      main: { parents: ["release"] },
      deferredA: { parents: ["common"] },
      deferredB: { parents: ["deferredA"] },
      head: { parents: ["main", "deferredB"] },
    },
    head: "head",
    exclude: "release",
    expectedRead: {
      unread: ["old", "oldRoot"],
      note: "B: a pre-release branch converges with EXCLUDE at the single anchor common",
    },
  },
  {
    name: "criss-cross merge equivalent",
    nodes: {
      root: {},
      a: { parents: ["root"] },
      b: { parents: ["root"] },
      mergeA: { parents: ["a", "b"] },
      mergeB: { parents: ["b", "a"] },
      head: { parents: ["mergeA", "mergeB"] },
    },
    head: "head",
  },
  {
    name: "parent and child timestamps run backward",
    nodes: {
      root: { timestamp: 300 },
      child: { parents: ["root"], timestamp: 100 },
      head: { parents: ["child"], timestamp: 200 },
    },
    head: "head",
  },
  {
    name: "all commits have the same timestamp",
    nodes: {
      root: { timestamp: 100 },
      a: { parents: ["root"], timestamp: 100 },
      b: { parents: ["root"], timestamp: 100 },
      head: { parents: ["a", "b"], timestamp: 100 },
    },
    head: "head",
  },
  {
    name: "timestamps run backward with exclude",
    nodes: {
      root: { timestamp: 500 },
      release: { parents: ["root"], timestamp: 100 },
      side: { parents: ["release"], timestamp: 50 },
      head: { parents: ["side"], timestamp: 300 },
    },
    head: "head",
    exclude: "release",
  },
  {
    name: "exclude is a descendant of HEAD",
    nodes: {
      root: {},
      head: { parents: ["root"] },
      exclude: { parents: ["head"] },
    },
    head: "head",
    exclude: "exclude",
  },
  {
    name: "certificate failure fallback candidate",
    nodes: {
      headRoot: {},
      head: { parents: ["headRoot"] },
      excludeRoot: {},
      exclude: { parents: ["excludeRoot"] },
    },
    head: "head",
    exclude: "exclude",
    expectedRead: {
      unread: [],
      note: "C: certificate failure must fall back; record all additional reads",
    },
  },
];

describe.each(walkers)("walkCommits $name contract", ({ walk }) => {
  it.each(cases)("returns the oracle OID set: $name", async (definition) => {
    const dag = await buildDag(definition);
    const commits = await walk(
      dag,
      dag.oid(definition.head),
      definition.exclude === undefined ? undefined : dag.oid(definition.exclude),
    );
    assertOidSet(commits, expectedOids(dag));
  });

  it("keeps logical membership unchanged when timestamps change", async () => {
    const makeDefinition = (timestamps: readonly number[]): DagDefinition => ({
      name: `timestamp variant ${timestamps.join("-")}`,
      nodes: {
        root: { timestamp: timestamps[0] },
        release: { parents: ["root"], timestamp: timestamps[1] },
        side: { parents: ["release"], timestamp: timestamps[2] },
        head: { parents: ["side"], timestamp: timestamps[3] },
      },
      head: "head",
      exclude: "release",
    });
    const membership = async (timestamps: readonly number[]): Promise<Set<string>> => {
      const dag = await buildDag(makeDefinition(timestamps));
      const commits = await walk(dag, dag.oid("head"), dag.oid("release"));
      const labelsByOid = new Map([...dag.oids].map(([label, oid]) => [oid, label]));
      return new Set(commits.map((commit) => labelsByOid.get(commit.oid)!));
    };

    expect(await membership([100, 200, 300, 400])).toEqual(await membership([400, 100, 300, 200]));
  });
});

describe("walkCommits fixture and oracle", () => {
  it("computes subtraction from declared parents without Git object reads", () => {
    const definition = cases.find((item) => item.name.includes("forked before release"))!;
    expect(expectedLabels(definition)).toEqual(new Set(["head", "main", "side2", "side1"]));
  });

  it("expresses future read-set expectations as fixture metadata", () => {
    const performanceCases = cases.filter((item) => item.expectedRead !== undefined);
    expect(performanceCases.map((item) => item.expectedRead?.note[0])).toEqual(["A", "B", "C"]);

    const caseB = performanceCases[1]!;
    expect(caseB.expectedRead?.unread).toEqual(["old", "oldRoot"]);
    expect(expectedLabels(caseB)).toEqual(new Set(["head", "main", "deferredB", "deferredA"]));
  });
});

describe.each(walkers)("walkCommits $name error contract", ({ walk }) => {
  const missing = "0".repeat(40) as CommitOid;

  it("maps a missing exclude only to COMMIT_NOT_FOUND", async () => {
    const dag = await buildDag({ name: "head", nodes: { head: {} }, head: "head" });
    const error = await walk(dag, dag.oid("head"), missing).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });

  it("preserves NotFoundError when only HEAD is missing", async () => {
    const dag = await buildDag({ name: "exclude", nodes: { exclude: {} }, head: "exclude" });
    await expect(walk(dag, missing, dag.oid("exclude"))).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });

  it("checks the missing exclude before a missing HEAD", async () => {
    const dag = await buildDag({ name: "empty host", nodes: {}, head: "unused" });
    const error = await walk(dag, missing, "f".repeat(40) as CommitOid).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });

  it("maps a missing identical HEAD and exclude to COMMIT_NOT_FOUND", async () => {
    const dag = await buildDag({ name: "empty host", nodes: {}, head: "unused" });
    const error = await walk(dag, missing, missing).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });
});

describe("walkCommits legacy missing-ancestor characterization", () => {
  it("reports COMMIT_NOT_FOUND for a missing ancestor of excludeHash", async () => {
    const dag = await buildDag({
      name: "missing exclude ancestor",
      nodes: { ancestor: {}, exclude: { parents: ["ancestor"] }, head: {} },
      head: "head",
      exclude: "exclude",
    });
    dag.removeObject("ancestor");

    const error = await walkers[0]!
      .walk(dag, dag.oid("head"), dag.oid("exclude"))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });
});
