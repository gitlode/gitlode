import { describe, expect, it } from "vitest";

import { DefaultFileChangeExpander } from "../../src/core/file-change-expander.js";
import type { CommitFact } from "../../src/core/types.js";
import type { FileChange, GitAdapter } from "../../src/git/types.js";

const REPO_PATH = "/fake/repo";

function makeCommitFact(overrides: Partial<CommitFact> = {}): CommitFact {
  return {
    type: "commit",
    oid: "a".repeat(40),
    message: "commit message",
    author: { name: "Author", email: "author@example.com", timestamp: 1000, timezoneOffset: 0 },
    committer: {
      name: "Committer",
      email: "committer@example.com",
      timestamp: 1000,
      timezoneOffset: 0,
    },
    parents: ["p".repeat(40)],
    repository: { name: "repo", url: null },
    ...overrides,
  };
}

async function* toAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iter) results.push(item);
  return results;
}

function makeAdapter(fileChanges: FileChange[]): GitAdapter {
  return {
    supportedObjectFormats: () => ["sha1"],
    resolveRef: async () => "a".repeat(40),
    getRepositoryObjectFormat: async () => "sha1",
    classifyRefType: async () => "branch",
    walkCommits: async function* () {},
    getRemoteUrl: async () => null,
    getFileChanges: async () => fileChanges,
    findMergeBase: async () => null,
  };
}

describe("DefaultFileChangeExpander", () => {
  it("yields no output for a commit with no file changes (empty commit)", async () => {
    const expander = new DefaultFileChangeExpander(makeAdapter([]));
    const commit = makeCommitFact();
    const results = await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));
    expect(results).toHaveLength(0);
  });

  it("expands a commit with multiple file changes into multiple FileChangeFacts", async () => {
    const fileChanges: FileChange[] = [
      {
        path: "src/a.ts",
        status: "added",
        beforeSize: 0,
        afterSize: 100,
        additions: 5,
        deletions: 0,
      },
      {
        path: "src/b.ts",
        status: "modified",
        beforeSize: 120,
        afterSize: 140,
        additions: 2,
        deletions: 1,
      },
    ];
    const expander = new DefaultFileChangeExpander(makeAdapter(fileChanges));
    const commit = makeCommitFact();
    const results = await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(results).toHaveLength(2);
    expect(results[0]!.commit).toBe(commit);
    expect(results[0]!.file.path).toBe("src/a.ts");
    expect(results[0]!.file.status).toBe("added");
    expect(results[0]!.file.additions).toBe(5);
    expect(results[0]!.file.deletions).toBe(0);
    expect(results[1]!.file.path).toBe("src/b.ts");
  });

  it("calls getFileChanges with parentOid=undefined for a root commit (no parents)", async () => {
    let capturedParentOid: string | undefined = "not-called";
    const adapter: GitAdapter = {
      supportedObjectFormats: () => ["sha1"],
      resolveRef: async () => "a".repeat(40),
      getRepositoryObjectFormat: async () => "sha1",
      classifyRefType: async () => "branch",
      walkCommits: async function* () {},
      getRemoteUrl: async () => null,
      getFileChanges: async (_repo, _oid, parentOid) => {
        capturedParentOid = parentOid;
        return [
          {
            path: "README.md",
            status: "added",
            beforeSize: 0,
            afterSize: 24,
            additions: 3,
            deletions: 0,
          },
        ];
      },
      findMergeBase: async () => null,
    };

    const expander = new DefaultFileChangeExpander(adapter);
    const rootCommit = makeCommitFact({ parents: [] });
    await collect(expander.expand(toAsyncIter([rootCommit]), REPO_PATH));

    expect(capturedParentOid).toBeUndefined();
  });

  it("uses only the first parent for a merge commit", async () => {
    const firstParent = "1".repeat(40);
    const secondParent = "2".repeat(40);
    let capturedParentOid: string | undefined;
    const adapter: GitAdapter = {
      supportedObjectFormats: () => ["sha1"],
      resolveRef: async () => "a".repeat(40),
      getRepositoryObjectFormat: async () => "sha1",
      classifyRefType: async () => "branch",
      walkCommits: async function* () {},
      getRemoteUrl: async () => null,
      getFileChanges: async (_repo, _oid, parentOid) => {
        capturedParentOid = parentOid;
        return [];
      },
      findMergeBase: async () => null,
    };

    const expander = new DefaultFileChangeExpander(adapter);
    const mergeCommit = makeCommitFact({ parents: [firstParent, secondParent] });
    await collect(expander.expand(toAsyncIter([mergeCommit]), REPO_PATH));

    expect(capturedParentOid).toBe(firstParent);
  });

  it("passes through null additions/deletions for binary files", async () => {
    const binaryFileChange: FileChange = {
      path: "assets/image.png",
      status: "added",
      beforeSize: 0,
      afterSize: 4096,
      additions: null,
      deletions: null,
    };
    const expander = new DefaultFileChangeExpander(makeAdapter([binaryFileChange]));
    const commit = makeCommitFact();
    const results = await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(results).toHaveLength(1);
    expect(results[0]!.file.additions).toBeNull();
    expect(results[0]!.file.deletions).toBeNull();
  });

  it("processes multiple commits in sequence", async () => {
    const commit1 = makeCommitFact({ oid: "a".repeat(40) });
    const commit2 = makeCommitFact({ oid: "b".repeat(40) });
    const fileChangeMap = new Map<string, FileChange[]>([
      [
        "a".repeat(40),
        [
          {
            path: "file1.ts",
            status: "added",
            beforeSize: 0,
            afterSize: 20,
            additions: 1,
            deletions: 0,
          },
        ],
      ],
      [
        "b".repeat(40),
        [
          {
            path: "file2.ts",
            status: "modified",
            beforeSize: 50,
            afterSize: 55,
            additions: 2,
            deletions: 1,
          },
          {
            path: "file3.ts",
            status: "deleted",
            beforeSize: 70,
            afterSize: 0,
            additions: 0,
            deletions: 4,
          },
        ],
      ],
    ]);
    const adapter: GitAdapter = {
      supportedObjectFormats: () => ["sha1"],
      resolveRef: async () => "a".repeat(40),
      getRepositoryObjectFormat: async () => "sha1",
      classifyRefType: async () => "branch",
      walkCommits: async function* () {},
      getRemoteUrl: async () => null,
      getFileChanges: async (_repo, oid) => fileChangeMap.get(oid) ?? [],
      findMergeBase: async () => null,
    };

    const expander = new DefaultFileChangeExpander(adapter);
    const results = await collect(expander.expand(toAsyncIter([commit1, commit2]), REPO_PATH));

    expect(results).toHaveLength(3);
    expect(results[0]!.commit.oid).toBe("a".repeat(40));
    expect(results[0]!.file.path).toBe("file1.ts");
    expect(results[1]!.commit.oid).toBe("b".repeat(40));
    expect(results[1]!.file.path).toBe("file2.ts");
    expect(results[2]!.commit.oid).toBe("b".repeat(40));
    expect(results[2]!.file.path).toBe("file3.ts");
  });

  it("calls getFileChanges with the correct commitOid", async () => {
    const commitOid = "c".repeat(40);
    let capturedOid: string | undefined;
    const adapter: GitAdapter = {
      supportedObjectFormats: () => ["sha1"],
      resolveRef: async () => "a".repeat(40),
      getRepositoryObjectFormat: async () => "sha1",
      classifyRefType: async () => "branch",
      walkCommits: async function* () {},
      getRemoteUrl: async () => null,
      getFileChanges: async (_repo, oid) => {
        capturedOid = oid;
        return [];
      },
      findMergeBase: async () => null,
    };

    const expander = new DefaultFileChangeExpander(adapter);
    const commit = makeCommitFact({ oid: commitOid });
    await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(capturedOid).toBe(commitOid);
  });

  it("sets type: 'file-change' on all yielded FileChangeFact objects", async () => {
    const fileChanges: FileChange[] = [
      {
        path: "src/a.ts",
        status: "added",
        beforeSize: 0,
        afterSize: 16,
        additions: 1,
        deletions: 0,
      },
    ];
    const expander = new DefaultFileChangeExpander(makeAdapter(fileChanges));
    const commit = makeCommitFact();
    const results = await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(results).toHaveLength(1);
    expect(results[0]!.type).toBe("file-change");
  });

  it("sets additions/deletions to null when either side exceeds maxDiffSize", async () => {
    const fileChanges: FileChange[] = [
      {
        path: "generated.txt",
        status: "modified",
        beforeSize: 150_000,
        afterSize: 2_000,
        additions: 200,
        deletions: 100,
      },
    ];
    const expander = new DefaultFileChangeExpander(makeAdapter(fileChanges), 100_000);
    const commit = makeCommitFact();
    const results = await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(results).toHaveLength(1);
    expect(results[0]!.file.additions).toBeNull();
    expect(results[0]!.file.deletions).toBeNull();
    expect(expander.skippedDiffCount).toBe(1);
  });

  it("keeps numeric additions/deletions when maxDiffSize is not exceeded", async () => {
    const fileChanges: FileChange[] = [
      {
        path: "small.txt",
        status: "modified",
        beforeSize: 80,
        afterSize: 90,
        additions: 3,
        deletions: 2,
      },
    ];
    const expander = new DefaultFileChangeExpander(makeAdapter(fileChanges), 100_000);
    const commit = makeCommitFact();
    const results = await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(results).toHaveLength(1);
    expect(results[0]!.file.additions).toBe(3);
    expect(results[0]!.file.deletions).toBe(2);
    expect(expander.skippedDiffCount).toBe(0);
  });

  it("counts binary diffs as skipped", async () => {
    const fileChanges: FileChange[] = [
      {
        path: "assets/large.bin",
        status: "added",
        beforeSize: 0,
        afterSize: 10_000,
        additions: null,
        deletions: null,
      },
    ];
    const expander = new DefaultFileChangeExpander(makeAdapter(fileChanges), 100_000);
    const commit = makeCommitFact();
    await collect(expander.expand(toAsyncIter([commit]), REPO_PATH));

    expect(expander.skippedDiffCount).toBe(1);
  });
});
