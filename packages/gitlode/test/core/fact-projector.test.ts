import { describe, expect, it } from "vitest";

import {
  DefaultFactProjector,
  projectCommit,
  projectFileChange,
} from "../../src/core/fact-projector.js";
import type { CommitFact, Fact, FileChangeFact } from "../../src/core/types.js";
import { noopInstrumentation } from "../../src/instrumentation/index.js";

async function* toAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iter) results.push(item);
  return results;
}

function makeCommitFact(overrides: Partial<Omit<CommitFact, "type">> = {}): CommitFact {
  return {
    type: "commit",
    oid: "a".repeat(40),
    message: "fix: correct bug\n\nDetailed explanation.\n\nCloses #42",
    author: {
      name: "Author Name",
      email: "author@example.com",
      timestamp: 1705312800,
      timezoneOffset: -540, // JST = UTC+9
    },
    committer: {
      name: "Committer Name",
      email: "committer@example.com",
      timestamp: 1705316400,
      timezoneOffset: 0,
    },
    parents: ["p".repeat(40)],
    repository: { name: "repo", url: "https://github.com/org/repo.git" },
    ...overrides,
  };
}

function makeFileChangeFact(
  overrides: {
    commit?: Partial<Omit<CommitFact, "type">>;
    file?: Partial<FileChangeFact["file"]>;
  } = {},
): FileChangeFact {
  return {
    type: "file-change",
    commit: makeCommitFact(overrides.commit),
    file: {
      path: "src/index.ts",
      status: "modified",
      additions: 5,
      deletions: 2,
      ...overrides.file,
    },
  };
}

function makeProjector(repoName: string, repoUrl: string | null): DefaultFactProjector {
  return new DefaultFactProjector(repoName, repoUrl, noopInstrumentation);
}

// ---------------------------------------------------------------------------
// Commit-mode projection
// ---------------------------------------------------------------------------

describe("DefaultFactProjector — commit mode", () => {
  it("maps all ProjectedCommit fields from CommitFact", async () => {
    const projector = makeProjector("repo", "https://github.com/org/repo.git");
    const fact = makeCommitFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record).toBeDefined();
    expect(record!.oid).toBe("a".repeat(40));
    expect(record!.message).toBe("fix: correct bug\n\nDetailed explanation.\n\nCloses #42");
    expect(record!.author.name).toBe("Author Name");
    expect(record!.author.email).toBe("author@example.com");
    expect(record!.committer.name).toBe("Committer Name");
    expect(record!.committer.email).toBe("committer@example.com");
    expect(record!.parents).toEqual(["p".repeat(40)]);
  });

  it("uses constructor-provided repository metadata", async () => {
    const projector = makeProjector("my-repo", "https://github.com/org/my-repo");
    const fact = makeCommitFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("my-repo");
    expect(record!.repository.url).toBe("https://github.com/org/my-repo");
  });

  it("accepts null remoteUrl", async () => {
    const projector = makeProjector("fallback-name", null);
    const fact = makeCommitFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("fallback-name");
    expect(record!.repository.url).toBeNull();
  });

  it("formats author timestamp as ISO 8601 with timezone offset (JST)", async () => {
    const projector = makeProjector("repo", null);
    // 1705276800 = 2024-01-15T00:00:00Z; with JST (UTC+9) → 2024-01-15T09:00:00+09:00
    const fact = makeCommitFact({
      author: { name: "Author", email: "a@e.com", timestamp: 1705276800, timezoneOffset: 540 },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.author.timestamp).toBe("2024-01-15T09:00:00+09:00");
  });

  it("formats committer timestamp as ISO 8601 with UTC offset", async () => {
    const projector = makeProjector("repo", null);
    // 1705312800 = 2024-01-15T10:00:00Z; with UTC offset 0 → 2024-01-15T10:00:00+00:00
    const fact = makeCommitFact({
      committer: { name: "Committer", email: "c@e.com", timestamp: 1705312800, timezoneOffset: 0 },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.committer.timestamp).toBe("2024-01-15T10:00:00+00:00");
  });

  it("yields empty array for root commit parents field", async () => {
    const projector = makeProjector("repo", null);
    const fact = makeCommitFact({ parents: [] });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.parents).toEqual([]);
  });

  it("carries two parents for a merge commit", async () => {
    const projector = makeProjector("repo", null);
    const p1 = "1".repeat(40);
    const p2 = "2".repeat(40);
    const fact = makeCommitFact({ parents: [p1, p2] });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.parents).toEqual([p1, p2]);
  });

  it("projects multiple commits in sequence", async () => {
    const projector = makeProjector("repo", null);
    const facts = [
      makeCommitFact({ oid: "a".repeat(40), message: "first" }),
      makeCommitFact({ oid: "b".repeat(40), message: "second" }),
    ];
    const records = await collect(projector.project(toAsyncIter(facts)));

    expect(records).toHaveLength(2);
    expect(records[0]!.oid).toBe("a".repeat(40));
    expect(records[0]!.message).toBe("first");
    expect(records[1]!.oid).toBe("b".repeat(40));
    expect(records[1]!.message).toBe("second");
  });

  it("yields no output for empty input", async () => {
    const projector = makeProjector("repo", null);
    const records = await collect(projector.project(toAsyncIter([])));
    expect(records).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// File-change-mode projection
// ---------------------------------------------------------------------------

describe("DefaultFactProjector — file-change mode", () => {
  it("includes all ProjectedCommit fields denormalized into the file record", async () => {
    const projector = makeProjector("repo", "https://github.com/org/repo.git");
    const fact = makeFileChangeFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record).toBeDefined();
    expect(record!.oid).toBe("a".repeat(40));
    expect(record!.message).toBe("fix: correct bug\n\nDetailed explanation.\n\nCloses #42");
    expect(record!.author.name).toBe("Author Name");
    expect(record!.author.email).toBe("author@example.com");
    expect(record!.committer.name).toBe("Committer Name");
    expect(record!.committer.email).toBe("committer@example.com");
    expect(record!.parents).toEqual(["p".repeat(40)]);
  });

  it("includes all file-specific fields", async () => {
    const projector = makeProjector("repo", null);
    const fact = makeFileChangeFact({
      file: { path: "src/auth/handler.ts", status: "modified", additions: 5, deletions: 2 },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect((record as { file?: { path: string } })!.file!.path).toBe("src/auth/handler.ts");
    expect((record as { file?: { status: string } })!.file!.status).toBe("modified");
    expect((record as { file?: { additions: number } })!.file!.additions).toBe(5);
    expect((record as { file?: { deletions: number } })!.file!.deletions).toBe(2);
  });

  it("uses constructor-provided repository metadata", async () => {
    const projector = makeProjector("my-proj", "https://github.com/org/my-proj");
    const fact = makeFileChangeFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("my-proj");
    expect(record!.repository.url).toBe("https://github.com/org/my-proj");
  });

  it("accepts null remoteUrl", async () => {
    const projector = makeProjector("fallback", null);
    const fact = makeFileChangeFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("fallback");
    expect(record!.repository.url).toBeNull();
  });

  it("formats author timestamp as ISO 8601 with timezone offset (JST)", async () => {
    const projector = makeProjector("repo", null);
    const fact = makeFileChangeFact({
      commit: {
        author: { name: "A", email: "a@e.com", timestamp: 1705276800, timezoneOffset: 540 },
      },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.author.timestamp).toBe("2024-01-15T09:00:00+09:00");
  });

  it("formats committer timestamp as ISO 8601 with UTC offset", async () => {
    const projector = makeProjector("repo", null);
    const fact = makeFileChangeFact({
      commit: {
        committer: { name: "C", email: "c@e.com", timestamp: 1705312800, timezoneOffset: 0 },
      },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.committer.timestamp).toBe("2024-01-15T10:00:00+00:00");
  });

  it("sets null additions and deletions for binary files", async () => {
    const projector = makeProjector("repo", null);
    const fact = makeFileChangeFact({
      file: { path: "assets/logo.png", status: "added", additions: null, deletions: null },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect((record as { file?: { additions: null } })!.file!.additions).toBeNull();
    expect((record as { file?: { deletions: null } })!.file!.deletions).toBeNull();
  });

  it("projects multiple file change facts in sequence", async () => {
    const projector = makeProjector("repo", null);
    const facts = [
      makeFileChangeFact({ file: { path: "a.ts", status: "added", additions: 1, deletions: 0 } }),
      makeFileChangeFact({
        file: { path: "b.ts", status: "modified", additions: 2, deletions: 1 },
      }),
    ];
    const records = await collect(projector.project(toAsyncIter(facts)));

    expect(records).toHaveLength(2);
    expect((records[0] as { file?: { path: string } })!.file!.path).toBe("a.ts");
    expect((records[1] as { file?: { path: string } })!.file!.path).toBe("b.ts");
  });

  it("yields no output for empty input", async () => {
    const projector = makeProjector("repo", null);
    const records = await collect(projector.project(toAsyncIter([])));
    expect(records).toHaveLength(0);
  });
});

describe("DefaultFactProjector — exhaustive dispatch", () => {
  it("dispatches commit and file-change facts correctly in separate project() calls", async () => {
    const projector = makeProjector("repo", null);

    // Commit-mode call
    const commitFact = makeCommitFact({ oid: "c".repeat(40), message: "commit msg" });
    const commitRecords = await collect(projector.project(toAsyncIter<Fact>([commitFact])));
    expect(commitRecords).toHaveLength(1);
    expect(commitRecords[0]!.oid).toBe("c".repeat(40));
    expect(commitRecords[0]!.message).toBe("commit msg");

    // File-change-mode call
    const fileFact = makeFileChangeFact({
      commit: { oid: "f".repeat(40) },
      file: { path: "x.ts", status: "added", additions: 3, deletions: 0 },
    });
    const fileRecords = await collect(projector.project(toAsyncIter<Fact>([fileFact])));
    expect(fileRecords).toHaveLength(1);
    expect(fileRecords[0]!.oid).toBe("f".repeat(40));
    expect((fileRecords[0] as { file?: { path: string } })!.file!.path).toBe("x.ts");
  });
});

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe("projectCommit — pure function", () => {
  it("returns the same fields as DefaultFactProjector for a commit fact", () => {
    const fact = makeCommitFact();
    const record = projectCommit(fact, "my-repo", "https://github.com/org/my-repo");
    expect(record.oid).toBe(fact.oid);
    expect(record.repository.name).toBe("my-repo");
    expect(record.repository.url).toBe("https://github.com/org/my-repo");
    expect(record.message).toBe("fix: correct bug\n\nDetailed explanation.\n\nCloses #42");
    expect(record.parents).toEqual(fact.parents);
  });

  it("accepts null remoteUrl", () => {
    const fact = makeCommitFact();
    const record = projectCommit(fact, "repo", null);
    expect(record.repository.url).toBeNull();
  });
});

describe("projectFileChange — pure function", () => {
  it("returns the same fields as DefaultFactProjector for a file-change fact", () => {
    const fact = makeFileChangeFact();
    const record = projectFileChange(fact, "my-repo", "https://github.com/org/my-repo");
    expect(record.oid).toBe(fact.commit.oid);
    expect(record.repository.name).toBe("my-repo");
    expect((record as { file?: { path: string } }).file?.path).toBe("src/index.ts");
  });

  it("accepts null remoteUrl", () => {
    const fact = makeFileChangeFact();
    const record = projectFileChange(fact, "repo", null);
    expect(record.repository.url).toBeNull();
  });
});
