import { describe, expect, it } from "vitest";

import type {
  TraversalPlanningRequest,
  CommitOid,
  ProgressEvent,
  ProgressReporter,
} from "../../src/core/index.js";
import { DefaultTraversalPlanner } from "../../src/core/traversal-planner.js";
import { GitAdapterError } from "../../src/git/index.js";
import type { GitAdapter } from "../../src/git/index.js";

function makeHash(n: number): CommitOid {
  return n.toString(16).padStart(40, "0") as CommitOid;
}

function makeReporter(): ProgressReporter & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    emit(event: ProgressEvent) {
      if (event.type === "warning") warnings.push(event.message);
    },
  };
}

function makeAdapter(options: {
  refs?: Record<string, CommitOid>;
  mergeBase?: CommitOid | null;
  resolveRefError?: { branch: string; code: "REF_NOT_FOUND" };
  branchRefs?: Set<string>;
}): GitAdapter {
  const branchRefs = options.branchRefs ?? new Set(Object.keys(options.refs ?? {}));
  return {
    supportedObjectFormats() {
      return ["sha1"];
    },
    async resolveRef(_repo, ref) {
      if (options.resolveRefError && ref === options.resolveRefError.branch) {
        throw new GitAdapterError(`Ref not found: ${ref}`, options.resolveRefError.code);
      }
      const hash = options.refs?.[ref];
      if (!hash) throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND");
      return hash;
    },
    async isRefBranch(_repo, ref) {
      return branchRefs.has(ref);
    },
    async getRepositoryObjectFormat() {
      return "sha1";
    },
    async *walkCommits() {},
    async getRemoteUrl() {
      return null;
    },
    async findMergeBase() {
      return options.mergeBase !== undefined ? options.mergeBase : null;
    },
    async getFileChanges() {
      return [];
    },
  };
}

function baseRequest(overrides: Partial<TraversalPlanningRequest> = {}): TraversalPlanningRequest {
  return {
    repositoryPath: "/repo",
    refs: ["main"],
    mode: "snapshot",
    priorRefMap: new Map(),
    ...overrides,
  };
}

describe("DefaultTraversalPlanner", () => {
  it("resolves branch heads into traversal plans in declaration order", async () => {
    const headMain = makeHash(5);
    const headDevelop = makeHash(10);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({ refs: { main: headMain, develop: headDevelop } }),
    );

    const plans = await planner.plan(baseRequest({ refs: ["main", "develop"] }), makeReporter());

    expect(plans).toEqual([
      { name: "main", head: headMain, excludeHash: undefined, isBranch: true },
      { name: "develop", head: headDevelop, excludeHash: undefined, isBranch: true },
    ]);
  });

  it("emits a warning and omits missing branches", async () => {
    const head = makeHash(1);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({
        refs: { main: head },
        resolveRefError: { branch: "gone", code: "REF_NOT_FOUND" },
      }),
    );
    const reporter = makeReporter();

    const plans = await planner.plan(baseRequest({ refs: ["main", "gone"] }), reporter);

    expect(reporter.warnings).toHaveLength(1);
    expect(reporter.warnings[0]).toContain("gone");
    expect(plans).toEqual([{ name: "main", head, excludeHash: undefined, isBranch: true }]);
  });

  it("returns no plans when all branches are missing", async () => {
    const planner = new DefaultTraversalPlanner(
      makeAdapter({ resolveRefError: { branch: "main", code: "REF_NOT_FOUND" } }),
    );

    const plans = await planner.plan(baseRequest(), makeReporter());

    expect(plans).toEqual([]);
  });

  it("uses prior checkpoint hashes for existing branches in incremental mode", async () => {
    const head = makeHash(5);
    const lastHash = makeHash(2);
    const planner = new DefaultTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({
        mode: "incremental",
        priorRefMap: new Map([["main", lastHash]]),
      }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", head, excludeHash: lastHash, isBranch: true }]);
  });

  it("uses merge base as excludeHash for newly added branches when prior state exists", async () => {
    const headMain = makeHash(5);
    const headDevelop = makeHash(10);
    const existingHead = makeHash(3);
    const mergeBaseHash = makeHash(2);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({
        refs: { main: headMain, develop: headDevelop },
        mergeBase: mergeBaseHash,
      }),
    );

    const plans = await planner.plan(
      baseRequest({
        refs: ["main", "develop"],
        mode: "incremental",
        priorRefMap: new Map([["main", existingHead]]),
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", head: headMain, excludeHash: existingHead, isBranch: true },
      { name: "develop", head: headDevelop, excludeHash: mergeBaseHash, isBranch: true },
    ]);
  });

  it("falls back to full traversal for new branches when no merge base exists", async () => {
    const headMain = makeHash(5);
    const headOrphan = makeHash(99);
    const existingHead = makeHash(3);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({
        refs: { main: headMain, orphan: headOrphan },
        mergeBase: null,
      }),
    );

    const plans = await planner.plan(
      baseRequest({
        refs: ["main", "orphan"],
        mode: "incremental",
        priorRefMap: new Map([["main", existingHead]]),
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", head: headMain, excludeHash: existingHead, isBranch: true },
      { name: "orphan", head: headOrphan, excludeHash: undefined, isBranch: true },
    ]);
  });

  it("uses the explicit ref range as excludeHash for every planned branch", async () => {
    const head = makeHash(5);
    const sinceRef = makeHash(2);
    const planner = new DefaultTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({ range: { type: "ref", ref: sinceRef } }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", head, excludeHash: sinceRef, isBranch: true }]);
  });

  it("does not set excludeHash for since-date planning", async () => {
    const head = makeHash(5);
    const planner = new DefaultTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({ range: { type: "date", since: new Date("2024-01-15T00:00:00Z") } }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", head, excludeHash: undefined, isBranch: true }]);
  });

  it("isBranch is false for a tag ref (not under refs/heads/)", async () => {
    const head = makeHash(5);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({ refs: { "v1.0": head }, branchRefs: new Set() }),
    );

    const plans = await planner.plan(baseRequest({ refs: ["v1.0"] }), makeReporter());

    expect(plans).toEqual([{ name: "v1.0", head, excludeHash: undefined, isBranch: false }]);
  });
});
