import { describe, expect, it } from "vitest";

import { DefaultBranchTraversalPlanner } from "../../src/core/branch-traversal-planner.js";
import type {
  BranchTraversalPlanningRequest,
  CommitHash,
  ProgressEvent,
  ProgressReporter,
} from "../../src/core/index.js";
import { GitAdapterError } from "../../src/git/index.js";
import type { GitAdapter } from "../../src/git/index.js";

function makeHash(n: number): CommitHash {
  return n.toString(16).padStart(40, "0") as CommitHash;
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
  refs?: Record<string, CommitHash>;
  mergeBase?: CommitHash | null;
  resolveRefError?: { branch: string; code: "REF_NOT_FOUND" };
}): GitAdapter {
  return {
    async resolveRef(_repo, ref) {
      if (options.resolveRefError && ref === options.resolveRefError.branch) {
        throw new GitAdapterError(`Ref not found: ${ref}`, options.resolveRefError.code);
      }
      const hash = options.refs?.[ref];
      if (!hash) throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND");
      return hash;
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

function baseRequest(
  overrides: Partial<BranchTraversalPlanningRequest> = {},
): BranchTraversalPlanningRequest {
  return {
    repositoryPath: "/repo",
    branches: ["main"],
    mode: "snapshot",
    priorBranchMap: new Map(),
    ...overrides,
  };
}

describe("DefaultBranchTraversalPlanner", () => {
  it("resolves branch heads into traversal plans in declaration order", async () => {
    const headMain = makeHash(5);
    const headDevelop = makeHash(10);
    const planner = new DefaultBranchTraversalPlanner(
      makeAdapter({ refs: { main: headMain, develop: headDevelop } }),
    );

    const plans = await planner.plan(
      baseRequest({ branches: ["main", "develop"] }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", head: headMain, excludeHash: undefined },
      { name: "develop", head: headDevelop, excludeHash: undefined },
    ]);
  });

  it("emits a warning and omits missing branches", async () => {
    const head = makeHash(1);
    const planner = new DefaultBranchTraversalPlanner(
      makeAdapter({
        refs: { main: head },
        resolveRefError: { branch: "gone", code: "REF_NOT_FOUND" },
      }),
    );
    const reporter = makeReporter();

    const plans = await planner.plan(baseRequest({ branches: ["main", "gone"] }), reporter);

    expect(reporter.warnings).toHaveLength(1);
    expect(reporter.warnings[0]).toContain("gone");
    expect(plans).toEqual([{ name: "main", head, excludeHash: undefined }]);
  });

  it("returns no plans when all branches are missing", async () => {
    const planner = new DefaultBranchTraversalPlanner(
      makeAdapter({ resolveRefError: { branch: "main", code: "REF_NOT_FOUND" } }),
    );

    const plans = await planner.plan(baseRequest(), makeReporter());

    expect(plans).toEqual([]);
  });

  it("uses prior checkpoint hashes for existing branches in incremental mode", async () => {
    const head = makeHash(5);
    const lastHash = makeHash(2);
    const planner = new DefaultBranchTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({
        mode: "incremental",
        priorBranchMap: new Map([["main", lastHash]]),
      }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", head, excludeHash: lastHash }]);
  });

  it("uses merge base as excludeHash for newly added branches when prior state exists", async () => {
    const headMain = makeHash(5);
    const headDevelop = makeHash(10);
    const existingHead = makeHash(3);
    const mergeBaseHash = makeHash(2);
    const planner = new DefaultBranchTraversalPlanner(
      makeAdapter({
        refs: { main: headMain, develop: headDevelop },
        mergeBase: mergeBaseHash,
      }),
    );

    const plans = await planner.plan(
      baseRequest({
        branches: ["main", "develop"],
        mode: "incremental",
        priorBranchMap: new Map([["main", existingHead]]),
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", head: headMain, excludeHash: existingHead },
      { name: "develop", head: headDevelop, excludeHash: mergeBaseHash },
    ]);
  });

  it("falls back to full traversal for new branches when no merge base exists", async () => {
    const headMain = makeHash(5);
    const headOrphan = makeHash(99);
    const existingHead = makeHash(3);
    const planner = new DefaultBranchTraversalPlanner(
      makeAdapter({
        refs: { main: headMain, orphan: headOrphan },
        mergeBase: null,
      }),
    );

    const plans = await planner.plan(
      baseRequest({
        branches: ["main", "orphan"],
        mode: "incremental",
        priorBranchMap: new Map([["main", existingHead]]),
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", head: headMain, excludeHash: existingHead },
      { name: "orphan", head: headOrphan, excludeHash: undefined },
    ]);
  });

  it("uses the explicit ref range as excludeHash for every planned branch", async () => {
    const head = makeHash(5);
    const sinceRef = makeHash(2);
    const planner = new DefaultBranchTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({ range: { type: "ref", ref: sinceRef } }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", head, excludeHash: sinceRef }]);
  });

  it("does not set excludeHash for since-date planning", async () => {
    const head = makeHash(5);
    const planner = new DefaultBranchTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({ range: { type: "date", since: new Date("2024-01-15T00:00:00Z") } }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", head, excludeHash: undefined }]);
  });
});
