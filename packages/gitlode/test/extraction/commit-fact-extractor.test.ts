import type { Diagnostic, DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  CommitFact,
  CommitTraversalRequest,
  TraversalPlan,
} from "@gitlode/internal-contracts/extraction";
import { type GitAdapter, GitAdapterError, type RawCommit } from "@gitlode/internal-contracts/git";
import type { CommitOid } from "@gitlode/internal-contracts/model";
import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

import { CommitFactExtractor } from "../../src/extraction/commit-fact-extractor.js";
import { makeTracer } from "../support/otel-fakes.js";

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

function makeReporter(): DiagnosticReporter & { diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  return {
    diagnostics,
    report(diagnostic: Diagnostic) {
      diagnostics.push(diagnostic);
    },
  };
}

function makeAdapter(
  options: {
    commits?: Record<CommitOid, AsyncIterable<RawCommit>>;
    walkError?: { head: CommitOid; excludeHash: CommitOid; code: "COMMIT_NOT_FOUND" };
    walkFailure?: Error;
  } = {},
): GitAdapter {
  return {
    [Symbol.asyncDispose]() {
      return Promise.resolve();
    },
    supportedObjectFormats() {
      return ["sha1"];
    },
    async resolveRef() {
      throw new GitAdapterError("Ref resolution is owned by TraversalPlanner", "REF_NOT_FOUND");
    },
    async getRepositoryObjectFormat() {
      return "sha1";
    },
    async classifyRefType() {
      return "branch";
    },
    async *walkCommits(_repo, head, excludeHash) {
      if (options.walkFailure) throw options.walkFailure;
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
    async *getFileBlobChanges() {},
  };
}

function makeTraverser(
  adapter: GitAdapter,
  tracer = trace.getTracer("gitlode.extraction"),
): CommitFactExtractor {
  return new CommitFactExtractor(adapter, tracer);
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
  return { name, refType: "branch", head, excludeHash };
}

function baseRequest(overrides: Partial<CommitTraversalRequest> = {}): CommitTraversalRequest {
  return {
    repositoryPath: "/repo",
    repoName: "test-repo",
    repoUrl: null,
    plans: [makePlan("main", makeOid(1))],
    ...overrides,
  };
}

describe("CommitFactExtractor traversal", () => {
  it("yields all commits for the provided plan", async () => {
    const commits = [makeRawCommit(3, [2]), makeRawCommit(2, [1]), makeRawCommit(1)];
    const head = makeOid(3);
    const traverser = makeTraverser(makeAdapter({ commits: { [head]: toAsyncIter(commits) } }));

    const facts = await collectFacts(
      traverser.extract(baseRequest({ plans: [makePlan("main", head)] }), makeReporter()),
    );

    expect(facts.map((fact) => fact.oid)).toEqual([makeOid(3), makeOid(2), makeOid(1)]);
  });

  it("starts traversal on first pull and completes exhausted with the explicit parent", async () => {
    const recording = makeTracer();
    const traverser = makeTraverser(makeAdapter(), recording.tracer);
    const parent = ROOT_CONTEXT;
    const iterable = traverser.extract(baseRequest(), makeReporter(), parent);
    expect(recording.starts).toHaveLength(0);
    await iterable[Symbol.asyncIterator]().next();
    expect(recording.starts).toHaveLength(1);
    expect(recording.starts[0]!.name).toBe("gitlode.traversal");
    expect(recording.starts[0]!.parent).toBe(parent);
    expect(recording.starts[0]!.span.attributes["gitlode.stream.completion"]).toBe("exhausted");
    expect(recording.starts[0]!.span.endCount).toBe(1);
  });

  it("completes cancellation after one yielded fact and ignores repeated termination", async () => {
    const recording = makeTracer();
    const head = makeOid(1);
    const traverser = makeTraverser(
      makeAdapter({ commits: { [head]: toAsyncIter([makeRawCommit(1)]) } }),
      recording.tracer,
    );
    const parent = ROOT_CONTEXT;
    const iterator = traverser
      .extract(baseRequest({ plans: [makePlan("main", head)] }), makeReporter(), parent)
      [Symbol.asyncIterator]();

    expect(await iterator.next()).toMatchObject({ done: false });
    await iterator.return?.();
    await iterator.next();
    await iterator.return?.();

    expect(recording.starts).toHaveLength(1);
    expect(recording.starts[0]!.parent).toBe(parent);
    expect(recording.starts[0]!.span.attributes["gitlode.stream.completion"]).toBe("cancelled");
    expect(recording.starts[0]!.span.endCount).toBe(1);
  });

  it("records source rejection as one error traversal completion", async () => {
    const recording = makeTracer();
    const failure = new Error("walk failed");
    const traverser = makeTraverser(makeAdapter({ walkFailure: failure }), recording.tracer);
    await expect(collectFacts(traverser.extract(baseRequest(), makeReporter()))).rejects.toBe(
      failure,
    );
    expect(recording.starts).toHaveLength(1);
    expect(recording.starts[0]!.span.endCount).toBe(1);
    expect(recording.starts[0]!.span.exceptions).toHaveLength(1);
    expect(recording.starts[0]!.span.statuses).toEqual([{ code: 2 }]);
  });

  it("maps repoName and remoteUrl onto CommitFact.repository", async () => {
    const head = makeOid(1);
    const traverser = makeTraverser(
      makeAdapter({ commits: { [head]: toAsyncIter([makeRawCommit(1)]) } }),
    );

    const facts = await collectFacts(
      traverser.extract(
        baseRequest({
          repoName: "my-repo",
          repoUrl: "https://github.com/org/my-repo",
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
    const traverser = makeTraverser(
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
    const traverser = makeTraverser(
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
    const traverser = makeTraverser(
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
    const traverser = makeTraverser(
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
    const traverser = makeTraverser({
      supportedObjectFormats() {
        return ["sha1"];
      },
      async resolveRef() {
        throw new GitAdapterError("Ref resolution is owned by TraversalPlanner", "REF_NOT_FOUND");
      },
      async getRepositoryObjectFormat() {
        return "sha1";
      },
      async classifyRefType() {
        return "branch";
      },
      walkCommits: walkSpy,
      async getRemoteUrl() {
        return null;
      },
      async findMergeBase() {
        return null;
      },
      async *getFileBlobChanges() {},
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
    const traverser = makeTraverser({
      supportedObjectFormats() {
        return ["sha1"];
      },
      async resolveRef() {
        throw new GitAdapterError("Ref resolution is owned by TraversalPlanner", "REF_NOT_FOUND");
      },
      async getRepositoryObjectFormat() {
        return "sha1";
      },
      async classifyRefType() {
        return "branch";
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
      async *getFileBlobChanges() {},
    });
    const reporter = makeReporter();

    const facts = await collectFacts(
      traverser.extract(baseRequest({ plans: [makePlan("main", head, staleExclude)] }), reporter),
    );

    expect(reporter.diagnostics).toEqual([
      {
        severity: "warn",
        message:
          'Warning: Last commit hash for branch "main" no longer exists. Falling back to full extraction.',
      },
    ]);
    expect(facts).toHaveLength(2);
  });

  it("yields zero commits when no plans are provided", async () => {
    const traverser = makeTraverser(makeAdapter());

    const facts = await collectFacts(traverser.extract(baseRequest({ plans: [] }), makeReporter()));

    expect(facts).toHaveLength(0);
  });

  it("sets type: 'commit' on all yielded CommitFact objects", async () => {
    const commits = [makeRawCommit(1), makeRawCommit(2)];
    const head = makeOid(1);
    const traverser = makeTraverser(makeAdapter({ commits: { [head]: toAsyncIter(commits) } }));

    const facts = await collectFacts(
      traverser.extract(baseRequest({ plans: [makePlan("main", head)] }), makeReporter()),
    );

    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      expect(fact.type).toBe("commit");
    }
  });
});
