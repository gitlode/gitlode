import { describe, expect, it, vi } from "vitest";

import { DefaultCommitTraversalExtractor } from "../../src/core/commit-traversal-extractor.js";
import type {
  CommitFact,
  CommitHash,
  CommitTraversalRequest,
  Reporter,
} from "../../src/core/index.js";
import { GitAdapterError } from "../../src/git/index.js";
import type { GitAdapter, RawCommit } from "../../src/git/index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeHash(n: number): CommitHash {
  return n.toString(16).padStart(40, "0") as CommitHash;
}

function makeRawCommit(n: number, parents: number[] = []): RawCommit {
  return {
    oid: makeHash(n),
    message: `commit ${n}`,
    author: { name: "A", email: "a@a.com", timestamp: 1_000_000 + n, timezoneOffset: 0 },
    committer: { name: "A", email: "a@a.com", timestamp: 1_000_000 + n, timezoneOffset: 0 },
    parents: parents.map(makeHash),
  };
}

function makeReporter(): Reporter & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    warn: (msg) => {
      warnings.push(msg);
    },
    progress: vi.fn(),
    done: vi.fn(),
  };
}

/** Builds a minimal mock GitAdapter from an iterable of commits per branch. */
function makeAdapter(options: {
  refs?: Record<string, CommitHash>;
  commits?: Record<CommitHash, AsyncIterable<RawCommit>>;
  mergeBase?: CommitHash | null;
  resolveRefError?: { branch: string; code: "REF_NOT_FOUND" };
  walkError?: { head: CommitHash; excludeHash: CommitHash; code: "COMMIT_NOT_FOUND" };
}): GitAdapter {
  const adapter: GitAdapter = {
    async resolveRef(_repo, ref) {
      if (options.resolveRefError && ref === options.resolveRefError.branch) {
        throw new GitAdapterError(`Ref not found: ${ref}`, options.resolveRefError.code);
      }
      const hash = options.refs?.[ref];
      if (!hash) throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND");
      return hash;
    },

    async *walkCommits(_repo, head, excludeHash) {
      if (
        options.walkError &&
        head === options.walkError.head &&
        excludeHash === options.walkError.excludeHash
      ) {
        throw new GitAdapterError(`Commit not found`, options.walkError.code);
      }
      const iter = options.commits?.[head];
      if (!iter) return;
      yield* iter;
    },

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
  return adapter;
}

async function* toAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function collectFacts(iterable: AsyncIterable<CommitFact>): Promise<CommitFact[]> {
  const result: CommitFact[] = [];
  for await (const fact of iterable) result.push(fact);
  return result;
}

function baseRequest(overrides: Partial<CommitTraversalRequest> = {}): CommitTraversalRequest {
  return {
    repositoryPath: "/repo",
    repoName: "test-repo",
    remoteUrl: null,
    branches: ["main"],
    mode: "snapshot",
    priorBranchMap: new Map(),
    generatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DefaultCommitTraversalExtractor", () => {
  describe("snapshot mode - single branch", () => {
    it("yields all commits and returns candidateCheckpoint with resolved head", async () => {
      const commits = [makeRawCommit(3, [2]), makeRawCommit(2, [1]), makeRawCommit(1)];
      const head = makeHash(3);
      const adapter = makeAdapter({
        refs: { main: head },
        commits: { [head]: toAsyncIter(commits) },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const reporter = makeReporter();
      const result = await traverser.extract(baseRequest(), reporter);

      const facts = await collectFacts(result.commitFacts);
      expect(facts).toHaveLength(3);
      expect(facts.map((f) => f.oid)).toEqual([makeHash(3), makeHash(2), makeHash(1)]);

      expect(result.candidateCheckpoint.branches).toEqual([{ name: "main", lastCommitHash: head }]);
      expect(result.candidateCheckpoint.generatedAt).toBe("2024-01-01T00:00:00.000Z");
      expect(result.candidateCheckpoint.repositoryPath).toBe("/repo");
      expect(result.candidateCheckpoint.version).toBe(1);
    });

    it("maps repoName and remoteUrl onto CommitFact.repository", async () => {
      const head = makeHash(1);
      const adapter = makeAdapter({
        refs: { main: head },
        commits: { [head]: toAsyncIter([makeRawCommit(1)]) },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ repoName: "my-repo", remoteUrl: "https://github.com/org/my-repo" }),
        makeReporter(),
      );
      const facts = await collectFacts(result.commitFacts);
      expect(facts[0]?.repository).toEqual({
        name: "my-repo",
        url: "https://github.com/org/my-repo",
      });
    });
  });

  describe("branch ordering and non-interleaving", () => {
    it("yields branch1 commits then branch2 commits in declaration order", async () => {
      const h1 = makeHash(100);
      const h2 = makeHash(200);
      const commits1 = [makeRawCommit(100), makeRawCommit(101)];
      const commits2 = [makeRawCommit(200), makeRawCommit(201)];
      const adapter = makeAdapter({
        refs: { main: h1, develop: h2 },
        commits: {
          [h1]: toAsyncIter(commits1),
          [h2]: toAsyncIter(commits2),
        },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ branches: ["main", "develop"] }),
        makeReporter(),
      );
      const facts = await collectFacts(result.commitFacts);
      const oids = facts.map((f) => f.oid);
      // Branch1 oids must all appear before branch2 oids
      expect(oids.indexOf(makeHash(100))).toBeLessThan(oids.indexOf(makeHash(200)));
      expect(oids.indexOf(makeHash(101))).toBeLessThan(oids.indexOf(makeHash(200)));
    });
  });

  describe("cross-branch deduplication", () => {
    it("emits shared commits only once", async () => {
      const shared = makeRawCommit(1);
      const h1 = makeHash(10);
      const h2 = makeHash(20);
      // Both branches share commit 1
      const adapter = makeAdapter({
        refs: { main: h1, develop: h2 },
        commits: {
          [h1]: toAsyncIter([makeRawCommit(10, [1]), shared]),
          [h2]: toAsyncIter([makeRawCommit(20, [1]), shared]),
        },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ branches: ["main", "develop"] }),
        makeReporter(),
      );
      const facts = await collectFacts(result.commitFacts);
      const oids = facts.map((f) => f.oid);
      // shared commit appears exactly once
      expect(oids.filter((o) => o === makeHash(1))).toHaveLength(1);
      // total: 2 unique from branch1 + 1 unique from branch2 = 3
      expect(oids).toHaveLength(3);
    });
  });

  describe("--since-date skip-and-continue", () => {
    it("skips commits at or before the date boundary without terminating traversal", async () => {
      const boundary = new Date("2024-01-15T00:00:00Z");
      const head = makeHash(1);
      // Commits in arbitrary order (BFS-like): new, old, newer
      const newCommit = {
        ...makeRawCommit(10),
        committer: {
          name: "A",
          email: "a@a.com",
          timestamp: Math.floor(boundary.getTime() / 1000) + 1,
          timezoneOffset: 0,
        },
      };
      const oldCommit = {
        ...makeRawCommit(5),
        committer: {
          name: "A",
          email: "a@a.com",
          timestamp: Math.floor(boundary.getTime() / 1000) - 100,
          timezoneOffset: 0,
        },
      };
      const newerCommit = {
        ...makeRawCommit(20),
        committer: {
          name: "A",
          email: "a@a.com",
          timestamp: Math.floor(boundary.getTime() / 1000) + 999,
          timezoneOffset: 0,
        },
      };

      const adapter = makeAdapter({
        refs: { main: head },
        commits: { [head]: toAsyncIter([newCommit, oldCommit, newerCommit]) },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ range: { type: "date", since: boundary } }),
        makeReporter(),
      );
      const facts = await collectFacts(result.commitFacts);
      // Only commits with timestamp * 1000 > boundary.getTime() are included
      expect(facts.map((f) => f.oid)).toEqual([makeHash(10), makeHash(20)]);
      // The old commit is skipped, but traversal continues to yield newerCommit
      expect(facts.map((f) => f.oid)).not.toContain(makeHash(5));
    });

    it("skips commits exactly at the boundary (committer.timestamp * 1000 === since.getTime())", async () => {
      const boundary = new Date("2024-01-15T00:00:00Z");
      const boundaryTs = boundary.getTime() / 1000;
      const head = makeHash(1);
      const exactBoundaryCommit = {
        ...makeRawCommit(1),
        committer: { name: "A", email: "a@a.com", timestamp: boundaryTs, timezoneOffset: 0 },
      };
      const afterBoundaryCommit = {
        ...makeRawCommit(2),
        committer: { name: "A", email: "a@a.com", timestamp: boundaryTs + 1, timezoneOffset: 0 },
      };
      const adapter = makeAdapter({
        refs: { main: head },
        commits: { [head]: toAsyncIter([exactBoundaryCommit, afterBoundaryCommit]) },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ range: { type: "date", since: boundary } }),
        makeReporter(),
      );
      const facts = await collectFacts(result.commitFacts);
      expect(facts.map((f) => f.oid)).toEqual([makeHash(2)]);
    });
  });

  describe("--since-ref range", () => {
    it("passes the resolved ref hash as excludeHash to walkCommits", async () => {
      const head = makeHash(5);
      const sinceRef = makeHash(2);
      const walkSpy = vi.fn(async function* () {});
      const adapter: GitAdapter = {
        async resolveRef(_repo, ref) {
          if (ref === "main") return head;
          if (ref === "v1.0") return sinceRef;
          throw new GitAdapterError("not found", "REF_NOT_FOUND");
        },
        walkCommits: walkSpy,
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return null;
        },
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ range: { type: "ref", ref: sinceRef } }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      expect(walkSpy).toHaveBeenCalledWith("/repo", head, sinceRef);
    });
  });

  describe("missing branch (REF_NOT_FOUND)", () => {
    it("emits a warning and omits the missing branch from candidateCheckpoint", async () => {
      const head = makeHash(1);
      const adapter = makeAdapter({
        refs: { main: head },
        commits: { [head]: toAsyncIter([makeRawCommit(1)]) },
        resolveRefError: { branch: "gone", code: "REF_NOT_FOUND" },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const reporter = makeReporter();
      const result = await traverser.extract(baseRequest({ branches: ["main", "gone"] }), reporter);
      await collectFacts(result.commitFacts);
      expect(reporter.warnings).toHaveLength(1);
      expect(reporter.warnings[0]).toContain("gone");
      expect(result.candidateCheckpoint.branches.map((b) => b.name)).toEqual(["main"]);
    });

    it("yields zero commits if all branches are missing", async () => {
      const adapter: GitAdapter = {
        async resolveRef(_repo, ref) {
          throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND");
        },
        async *walkCommits() {},
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return null;
        },
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(baseRequest({ branches: ["main"] }), makeReporter());
      const facts = await collectFacts(result.commitFacts);
      expect(facts).toHaveLength(0);
      expect(result.candidateCheckpoint.branches).toHaveLength(0);
    });
  });

  describe("COMMIT_NOT_FOUND fallback", () => {
    it("emits a warning and falls back to full traversal for that branch", async () => {
      const head = makeHash(5);
      const staleExclude = makeHash(99);
      const fullCommits = [makeRawCommit(5, [4]), makeRawCommit(4)];

      // First walk (with excludeHash) throws COMMIT_NOT_FOUND
      // Second walk (without excludeHash) succeeds
      let walkCallCount = 0;
      const adapter: GitAdapter = {
        async resolveRef() {
          return head;
        },
        async *walkCommits(_repo, _head, excludeHash) {
          walkCallCount++;
          if (walkCallCount === 1) {
            // First call with excludeHash
            expect(excludeHash).toBe(staleExclude);
            throw new GitAdapterError("Commit not found", "COMMIT_NOT_FOUND");
          }
          // Fallback: full traversal
          yield* fullCommits;
        },
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return null;
        },
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const reporter = makeReporter();
      const result = await traverser.extract(
        baseRequest({
          mode: "incremental",
          priorBranchMap: new Map([["main", staleExclude]]),
        }),
        reporter,
      );
      const facts = await collectFacts(result.commitFacts);
      expect(reporter.warnings).toHaveLength(1);
      expect(reporter.warnings[0]).toContain("main");
      expect(facts).toHaveLength(2);
    });
  });

  describe("incremental mode - exclude hash resolution", () => {
    it("passes stateMap hash as excludeHash for existing branches", async () => {
      const head = makeHash(5);
      const lastHash = makeHash(2);
      const walkSpy = vi.fn(async function* () {
        yield makeRawCommit(5);
      });
      const adapter: GitAdapter = {
        async resolveRef() {
          return head;
        },
        walkCommits: walkSpy,
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return null;
        },
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({
          mode: "incremental",
          priorBranchMap: new Map([["main", lastHash]]),
        }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      expect(walkSpy).toHaveBeenCalledWith("/repo", head, lastHash);
    });

    it("uses merge base as excludeHash for newly added branches when stateMap is non-empty", async () => {
      const headMain = makeHash(5);
      const headDevelop = makeHash(10);
      const existingHead = makeHash(3);
      const mergeBaseHash = makeHash(2);
      const walkSpy = vi.fn(async function* (
        _repo: string,
        _head: CommitHash,
        _excludeHash?: CommitHash,
      ) {
        yield makeRawCommit(parseInt(_head.replace(/^0+/, "") || "0", 16));
      });
      const adapter: GitAdapter = {
        async resolveRef(_repo, ref) {
          if (ref === "main") return headMain;
          if (ref === "develop") return headDevelop;
          throw new GitAdapterError("not found", "REF_NOT_FOUND");
        },
        walkCommits: walkSpy,
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return mergeBaseHash;
        },
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({
          branches: ["main", "develop"],
          mode: "incremental",
          // main is existing; develop is new
          priorBranchMap: new Map([["main", existingHead]]),
        }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      // main uses stateMap hash, develop uses mergeBase
      const mainCall = walkSpy.mock.calls.find(([, h]) => h === headMain);
      const developCall = walkSpy.mock.calls.find(([, h]) => h === headDevelop);
      expect(mainCall?.[2]).toBe(existingHead);
      expect(developCall?.[2]).toBe(mergeBaseHash);
    });

    it("falls back to full traversal for new branches when findMergeBase returns null (orphan)", async () => {
      const head = makeHash(5);
      const existingHead = makeHash(3);
      const walkSpy = vi.fn(async function* () {
        yield makeRawCommit(5);
      });
      const adapter: GitAdapter = {
        async resolveRef(_repo, ref) {
          if (ref === "main") return head;
          if (ref === "orphan") return makeHash(99);
          throw new GitAdapterError("not found", "REF_NOT_FOUND");
        },
        walkCommits: walkSpy,
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return null;
        }, // no common ancestor
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({
          branches: ["main", "orphan"],
          mode: "incremental",
          priorBranchMap: new Map([["main", existingHead]]),
        }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      // orphan branch has no excludeHash (undefined) due to null merge base
      const orphanCall = walkSpy.mock.calls.find(([, h]) => h === makeHash(99));
      expect(orphanCall?.[2]).toBeUndefined();
    });

    it("does not call findMergeBase when stateMap is empty (first incremental run)", async () => {
      const head = makeHash(1);
      const findMergeBaseSpy = vi.fn(async () => null);
      const adapter: GitAdapter = {
        async resolveRef() {
          return head;
        },
        async *walkCommits() {
          yield makeRawCommit(1);
        },
        async getRemoteUrl() {
          return null;
        },
        findMergeBase: findMergeBaseSpy,
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ mode: "incremental", priorBranchMap: new Map() }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      expect(findMergeBaseSpy).not.toHaveBeenCalled();
    });

    it("does not call findMergeBase in snapshot mode even if priorBranchMap is non-empty", async () => {
      const head = makeHash(1);
      const findMergeBaseSpy = vi.fn(async () => null);
      const adapter: GitAdapter = {
        async resolveRef() {
          return head;
        },
        async *walkCommits() {
          yield makeRawCommit(1);
        },
        async getRemoteUrl() {
          return null;
        },
        findMergeBase: findMergeBaseSpy,
        async getFileChanges() {
          return [];
        },
      };
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        // snapshot mode: priorBranchMap is always empty in practice, but even if non-empty,
        // no new-branch detection or merge-base should run
        baseRequest({ mode: "snapshot", priorBranchMap: new Map([["main", makeHash(0)]]) }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      expect(findMergeBaseSpy).not.toHaveBeenCalled();
    });
  });

  describe("candidateCheckpoint", () => {
    it("candidateCheckpoint branches list preserves the declaration order of resolved branches", async () => {
      const h1 = makeHash(1);
      const h2 = makeHash(2);
      const h3 = makeHash(3);
      const adapter = makeAdapter({
        refs: { a: h1, b: h2, c: h3 },
        commits: {
          [h1]: toAsyncIter([makeRawCommit(1)]),
          [h2]: toAsyncIter([makeRawCommit(2)]),
          [h3]: toAsyncIter([makeRawCommit(3)]),
        },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(
        baseRequest({ branches: ["a", "b", "c"] }),
        makeReporter(),
      );
      await collectFacts(result.commitFacts);
      expect(result.candidateCheckpoint.branches.map((b) => b.name)).toEqual(["a", "b", "c"]);
    });

    it("candidateCheckpoint is available before commitFacts is consumed", async () => {
      const head = makeHash(1);
      const adapter = makeAdapter({
        refs: { main: head },
        commits: { [head]: toAsyncIter([makeRawCommit(1)]) },
      });
      const traverser = new DefaultCommitTraversalExtractor(adapter);
      const result = await traverser.extract(baseRequest(), makeReporter());
      // Access candidateCheckpoint before consuming the iterable
      expect(result.candidateCheckpoint.branches[0]?.lastCommitHash).toBe(head);
    });
  });
});
