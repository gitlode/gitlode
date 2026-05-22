import { describe, expect, it } from "vitest";

import type {
  CommitOid,
  ProgressEvent,
  ProgressReporter,
  TraversalPlanningRequest,
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
  refTypes?: Record<string, "branch" | "tag-lightweight" | "tag-annotated" | "commit-oid">;
  mergeBase?: CommitOid | null;
  resolveRefError?: { ref: string; code: "REF_NOT_FOUND" };
}): GitAdapter {
  return {
    supportedObjectFormats() {
      return ["sha1"];
    },
    async resolveRef(_repo, ref) {
      if (options.resolveRefError && ref === options.resolveRefError.ref) {
        throw new GitAdapterError(`Ref not found: ${ref}`, options.resolveRefError.code);
      }
      const hash = options.refs?.[ref];
      if (!hash) throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND");
      return hash;
    },
    async classifyRefType(_repo, ref) {
      return options.refTypes?.[ref] ?? "branch";
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
    priorRefs: [],
    ...overrides,
  };
}

describe("DefaultTraversalPlanner", () => {
  it("resolves heads in declaration order", async () => {
    const headMain = makeHash(5);
    const headDevelop = makeHash(10);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({ refs: { main: headMain, develop: headDevelop } }),
    );

    const plans = await planner.plan(baseRequest({ refs: ["main", "develop"] }), makeReporter());

    expect(plans).toEqual([
      { name: "main", refType: "branch", head: headMain, excludeHash: undefined },
      { name: "develop", refType: "branch", head: headDevelop, excludeHash: undefined },
    ]);
  });

  it("warns and skips missing refs", async () => {
    const head = makeHash(1);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({
        refs: { main: head },
        resolveRefError: { ref: "gone", code: "REF_NOT_FOUND" },
      }),
    );
    const reporter = makeReporter();

    const plans = await planner.plan(baseRequest({ refs: ["main", "gone"] }), reporter);

    expect(reporter.warnings).toHaveLength(1);
    expect(reporter.warnings[0]).toContain("gone");
    expect(plans).toEqual([{ name: "main", refType: "branch", head, excludeHash: undefined }]);
  });

  it("matches checkpoints by exact (ref, refType)", async () => {
    const head = makeHash(5);
    const checkpointTip = makeHash(2);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({ refs: { v1: head }, refTypes: { v1: "tag-annotated" } }),
    );

    const plans = await planner.plan(
      baseRequest({
        refs: ["v1"],
        mode: "incremental",
        priorRefs: [
          {
            ref: "v1",
            refType: "branch",
            tipOid: makeHash(1),
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            ref: "v1",
            refType: "tag-annotated",
            tipOid: checkpointTip,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "v1", refType: "tag-annotated", head, excludeHash: checkpointTip },
    ]);
  });

  it("uses merge base only for newly added branch refs", async () => {
    const headMain = makeHash(5);
    const headTag = makeHash(10);
    const headDevelop = makeHash(20);
    const existingMain = makeHash(3);
    const mergeBaseHash = makeHash(2);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({
        refs: { main: headMain, v1: headTag, develop: headDevelop },
        refTypes: { main: "branch", v1: "tag-lightweight", develop: "branch" },
        mergeBase: mergeBaseHash,
      }),
    );

    const plans = await planner.plan(
      baseRequest({
        refs: ["main", "v1", "develop"],
        mode: "incremental",
        priorRefs: [
          {
            ref: "main",
            refType: "branch",
            tipOid: existingMain,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", refType: "branch", head: headMain, excludeHash: existingMain },
      { name: "v1", refType: "tag-lightweight", head: headTag, excludeHash: undefined },
      { name: "develop", refType: "branch", head: headDevelop, excludeHash: mergeBaseHash },
    ]);
  });

  it("falls back to full traversal for new branch when no merge base exists", async () => {
    const headMain = makeHash(5);
    const headOrphan = makeHash(99);
    const existingHead = makeHash(3);
    const planner = new DefaultTraversalPlanner(
      makeAdapter({
        refs: { main: headMain, orphan: headOrphan },
        refTypes: { main: "branch", orphan: "branch" },
        mergeBase: null,
      }),
    );

    const plans = await planner.plan(
      baseRequest({
        refs: ["main", "orphan"],
        mode: "incremental",
        priorRefs: [
          {
            ref: "main",
            refType: "branch",
            tipOid: existingHead,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      makeReporter(),
    );

    expect(plans).toEqual([
      { name: "main", refType: "branch", head: headMain, excludeHash: existingHead },
      { name: "orphan", refType: "branch", head: headOrphan, excludeHash: undefined },
    ]);
  });

  it("uses explicit since-ref range boundary", async () => {
    const head = makeHash(5);
    const sinceRef = makeHash(2);
    const planner = new DefaultTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({ range: { type: "ref", ref: sinceRef } }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", refType: "branch", head, excludeHash: sinceRef }]);
  });

  it("since-date does not set excludeHash", async () => {
    const head = makeHash(5);
    const planner = new DefaultTraversalPlanner(makeAdapter({ refs: { main: head } }));

    const plans = await planner.plan(
      baseRequest({ range: { type: "date", since: new Date("2024-01-15T00:00:00Z") } }),
      makeReporter(),
    );

    expect(plans).toEqual([{ name: "main", refType: "branch", head, excludeHash: undefined }]);
  });
});
