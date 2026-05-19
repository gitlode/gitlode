import { describe, expect, it, vi } from "vitest";

import { DefaultCommitTraversalExtractor } from "../../src/core/commit-traversal-extractor.js";
import type {
  TraversalPlan,
  CommitFact,
  CommitOid,
  CommitTraversalRequest,
  ProgressEvent,
  ProgressReporter,
} from "../../src/core/index.js";
import { GitAdapterError } from "../../src/git/index.js";
import type { GitAdapter, RawCommit } from "../../src/git/index.js";

function makeOid(n: number): CommitOid {
  return n.toString(16).padStart(12, "0") as CommitOid;
}

function makeRawCommit(n: number, parents: number[] = []): RawCommit {
  return {
    oid: makeOid(n),
    message: `commit ${n}`,
    author: { name: "A", email: "a@a.com", timestamp: 1_000_000 + n, timezoneOffset: 0 },
    committer: { name: "A", email: "a@a.com", timestamp: 1_000_000 + n, timezoneOffset: 0 },
    parents: parents.map(makeOid),
  };
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

function makeAdapter(
  options: {
    commits?: Record<CommitOid, AsyncIterable<RawCommit>>;
    walkError?: { head: CommitOid; excludeHash: CommitOid; code: "COMMIT_NOT_FOUND" };
  } = {},
): GitAdapter {
  return {
    supportedObjectFormats() {
      return ["sha1"];
    },
    async resolveRef() {
      throw new GitAdapterError("Ref resolution is owned by TraversalPlanner", "REF_NOT_FOUND");
    },
    async getRepositoryObjectFormat() {
      return "sha1";
    },
    async isRefBranch() {
      return true;
    },
    async *walkCommits(_repo, head, excludeHash) {
      if (
        options.walkError &&
        head === options.walkError.head &&
        excludeHash === options.walkError.excludeHash
      ) {
        throw new GitAdapterError("Commit not found", options.walkError.code);
      }
      const iter = options.commits?.[head];
      if (!iter) {
        return;
      }
      yield* iter;
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
}

async function* toAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collectFacts(iterable: AsyncIterable<CommitFact>): Promise<CommitFact[]> {
  const result: CommitFact[] = [];
  for await (const fact of iterable) {
    result.push(fact);
  }
  return result;
}

function makePlan(name: string, head: CommitOid, excludeHash?: CommitOid): TraversalPlan {
  return { name, head, excludeHash };
}

function baseRequest(overrides: Partial<CommitTraversalRequest> = {}): CommitTraversalRequest {
  return {
    repositoryPath: "/repo",
    repoName: "test-repo",
    remoteUrl: null,
    plans: [makePlan("main", makeOid(1))],
    ...overrides,
  };
}

describe("DefaultCommitTraversalExtractor", () => {
  it("yields all commits for the provided plan", async () => {
    const commits = [makeRawCommit(3, [2]), makeRawCommit(2, [1]), makeRawCommit(1)];
    const head = makeOid(3);
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({ commits: { [head]: toAsyncIter(commits) } }),
    );

    const facts = await collectFacts(
      traverser.extract(baseRequest({ plans: [makePlan("main", head)] }), makeReporter()),
    );

    expect(facts.map((fact) => fact.oid)).toEqual([makeOid(3), makeOid(2), makeOid(1)]);
  });

  it("maps repoName and remoteUrl onto CommitFact.repository", async () => {
    const head = makeOid(1);
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({ commits: { [head]: toAsyncIter([makeRawCommit(1)]) } }),
    );

    const facts = await collectFacts(
      traverser.extract(
        baseRequest({
          repoName: "my-repo",
          remoteUrl: "https://github.com/org/my-repo",
          plans: [makePlan("main", head)],
        }),
        makeReporter(),
      ),
    );

    expect(facts[0]?.repository).toEqual({
      name: "my-repo",
      url: "https://github.com/org/my-repo",
    });
  });

  it("preserves branch order without interleaving", async () => {
    const headMain = makeOid(100);
    const headDevelop = makeOid(200);
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({
        commits: {
          [headMain]: toAsyncIter([makeRawCommit(100), makeRawCommit(101)]),
          [headDevelop]: toAsyncIter([makeRawCommit(200), makeRawCommit(201)]),
        },
      }),
    );

    const facts = await collectFacts(
      traverser.extract(
        baseRequest({ plans: [makePlan("main", headMain), makePlan("develop", headDevelop)] }),
        makeReporter(),
      ),
    );

    const oids = facts.map((fact) => fact.oid);
    expect(oids.indexOf(makeOid(100))).toBeLessThan(oids.indexOf(makeOid(200)));
    expect(oids.indexOf(makeOid(101))).toBeLessThan(oids.indexOf(makeOid(200)));
  });

  it("emits shared commits only once across plans", async () => {
    const shared = makeRawCommit(1);
    const headMain = makeOid(10);
    const headDevelop = makeOid(20);
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({
        commits: {
          [headMain]: toAsyncIter([makeRawCommit(10, [1]), shared]),
          [headDevelop]: toAsyncIter([makeRawCommit(20, [1]), shared]),
        },
      }),
    );

    const facts = await collectFacts(
      traverser.extract(
        baseRequest({ plans: [makePlan("main", headMain), makePlan("develop", headDevelop)] }),
        makeReporter(),
      ),
    );

    const oids = facts.map((fact) => fact.oid);
    expect(oids.filter((oid) => oid === makeOid(1))).toHaveLength(1);
    expect(oids).toHaveLength(3);
  });

  it("skips commits at or before the since-date boundary without terminating traversal", async () => {
    const boundary = new Date("2024-01-15T00:00:00Z");
    const head = makeOid(1);
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
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({ commits: { [head]: toAsyncIter([newCommit, oldCommit, newerCommit]) } }),
    );

    const facts = await collectFacts(
      traverser.extract(
        baseRequest({
          plans: [makePlan("main", head)],
          range: { type: "date", since: boundary },
        }),
        makeReporter(),
      ),
    );

    expect(facts.map((fact) => fact.oid)).toEqual([makeOid(10), makeOid(20)]);
  });

  it("skips commits exactly at the since-date boundary", async () => {
    const boundary = new Date("2024-01-15T00:00:00Z");
    const boundaryTs = boundary.getTime() / 1000;
    const head = makeOid(1);
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({
        commits: {
          [head]: toAsyncIter([
            {
              ...makeRawCommit(1),
              committer: {
                name: "A",
                email: "a@a.com",
                timestamp: boundaryTs,
                timezoneOffset: 0,
              },
            },
            {
              ...makeRawCommit(2),
              committer: {
                name: "A",
                email: "a@a.com",
                timestamp: boundaryTs + 1,
                timezoneOffset: 0,
              },
            },
          ]),
        },
      }),
    );

    const facts = await collectFacts(
      traverser.extract(
        baseRequest({
          plans: [makePlan("main", head)],
          range: { type: "date", since: boundary },
        }),
        makeReporter(),
      ),
    );

    expect(facts.map((fact) => fact.oid)).toEqual([makeOid(2)]);
  });

  it("passes each plan excludeHash to walkCommits", async () => {
    const head = makeOid(5);
    const excludeHash = makeOid(2);
    const walkSpy = vi.fn(async function* () {});
    const traverser = new DefaultCommitTraversalExtractor({
      supportedObjectFormats() {
        return ["sha1"];
      },
      async resolveRef() {
        throw new GitAdapterError("Ref resolution is owned by TraversalPlanner", "REF_NOT_FOUND");
      },
      async getRepositoryObjectFormat() {
        return "sha1";
      },
      async isRefBranch() {
        return true;
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
    });

    await collectFacts(
      traverser.extract(
        baseRequest({ plans: [makePlan("main", head, excludeHash)] }),
        makeReporter(),
      ),
    );

    expect(walkSpy).toHaveBeenCalledWith("/repo", head, excludeHash);
  });

  it("warns and falls back to full traversal on COMMIT_NOT_FOUND", async () => {
    const head = makeOid(5);
    const staleExclude = makeOid(99);
    const fullCommits = [makeRawCommit(5, [4]), makeRawCommit(4)];
    let walkCallCount = 0;
    const traverser = new DefaultCommitTraversalExtractor({
      supportedObjectFormats() {
        return ["sha1"];
      },
      async resolveRef() {
        throw new GitAdapterError("Ref resolution is owned by TraversalPlanner", "REF_NOT_FOUND");
      },
      async getRepositoryObjectFormat() {
        return "sha1";
      },
      async isRefBranch() {
        return true;
      },
      async *walkCommits(_repo, _head, excludeHash) {
        walkCallCount++;
        if (walkCallCount === 1) {
          expect(excludeHash).toBe(staleExclude);
          throw new GitAdapterError("Commit not found", "COMMIT_NOT_FOUND");
        }
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
    });
    const reporter = makeReporter();

    const facts = await collectFacts(
      traverser.extract(baseRequest({ plans: [makePlan("main", head, staleExclude)] }), reporter),
    );

    expect(reporter.warnings).toHaveLength(1);
    expect(reporter.warnings[0]).toContain("main");
    expect(facts).toHaveLength(2);
  });

  it("yields zero commits when no plans are provided", async () => {
    const traverser = new DefaultCommitTraversalExtractor(makeAdapter());

    const facts = await collectFacts(traverser.extract(baseRequest({ plans: [] }), makeReporter()));

    expect(facts).toHaveLength(0);
  });

  it("sets type: 'commit' on all yielded CommitFact objects", async () => {
    const commits = [makeRawCommit(1), makeRawCommit(2)];
    const head = makeOid(1);
    const traverser = new DefaultCommitTraversalExtractor(
      makeAdapter({ commits: { [head]: toAsyncIter(commits) } }),
    );

    const facts = await collectFacts(
      traverser.extract(baseRequest({ plans: [makePlan("main", head)] }), makeReporter()),
    );

    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      expect(fact.type).toBe("commit");
    }
  });
});
