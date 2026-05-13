import { describe, expect, it } from "vitest";

import { DefaultFileChangeRecordProjector } from "../../src/core/file-change-record-projector.js";
import type { CommitFact, FileChangeFact } from "../../src/core/types.js";

async function* toAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iter) results.push(item);
  return results;
}

function makeCommitFact(overrides: Partial<CommitFact> = {}): CommitFact {
  return {
    oid: "a".repeat(40),
    message: "add feature\n\nBody text.",
    author: {
      name: "Author",
      email: "author@example.com",
      timestamp: 1705312800,
      timezoneOffset: -540,
    },
    committer: {
      name: "Committer",
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
    commit?: Partial<CommitFact>;
    file?: Partial<FileChangeFact["file"]>;
  } = {},
): FileChangeFact {
  return {
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

describe("DefaultFileChangeRecordProjector", () => {
  it("includes all OutputCommit fields denormalized into the file record", async () => {
    const projector = new DefaultFileChangeRecordProjector(
      "repo",
      "https://github.com/org/repo.git",
    );
    const fact = makeFileChangeFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record).toBeDefined();
    expect(record!.oid).toBe("a".repeat(40));
    expect(record!.subject).toBe("add feature");
    expect(record!.body).toBe("Body text.");
    expect(record!.author.name).toBe("Author");
    expect(record!.author.email).toBe("author@example.com");
    expect(record!.committer.name).toBe("Committer");
    expect(record!.committer.email).toBe("committer@example.com");
    expect(record!.parents).toEqual(["p".repeat(40)]);
  });

  it("includes all file-specific fields", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    const fact = makeFileChangeFact({
      file: { path: "src/auth/handler.ts", status: "modified", additions: 5, deletions: 2 },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.file.path).toBe("src/auth/handler.ts");
    expect(record!.file.status).toBe("modified");
    expect(record!.file.additions).toBe(5);
    expect(record!.file.deletions).toBe(2);
  });

  it("uses constructor-provided repository metadata", async () => {
    const projector = new DefaultFileChangeRecordProjector(
      "my-proj",
      "https://github.com/org/my-proj",
    );
    const fact = makeFileChangeFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("my-proj");
    expect(record!.repository.url).toBe("https://github.com/org/my-proj");
  });

  it("accepts null remoteUrl", async () => {
    const projector = new DefaultFileChangeRecordProjector("fallback", null);
    const fact = makeFileChangeFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("fallback");
    expect(record!.repository.url).toBeNull();
  });

  it("formats author timestamp as ISO 8601 with timezone offset (JST)", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    // 1705276800 = 2024-01-15T00:00:00Z; with JST (UTC+9) → 2024-01-15T09:00:00+09:00
    const fact = makeFileChangeFact({
      commit: {
        author: { name: "A", email: "a@e.com", timestamp: 1705276800, timezoneOffset: -540 },
      },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.author.timestamp).toBe("2024-01-15T09:00:00+09:00");
  });

  it("formats committer timestamp as ISO 8601 with UTC offset", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    // 1705312800 = 2024-01-15T10:00:00Z; with UTC offset 0 → 2024-01-15T10:00:00+00:00
    const fact = makeFileChangeFact({
      commit: {
        committer: { name: "C", email: "c@e.com", timestamp: 1705312800, timezoneOffset: 0 },
      },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.committer.timestamp).toBe("2024-01-15T10:00:00+00:00");
  });

  it("sets null additions and deletions for binary files", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    const fact = makeFileChangeFact({
      file: { path: "assets/logo.png", status: "added", additions: null, deletions: null },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.file.additions).toBeNull();
    expect(record!.file.deletions).toBeNull();
  });

  it("handles added file status", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    const fact = makeFileChangeFact({ file: { status: "added", additions: 10, deletions: 0 } });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.file.status).toBe("added");
    expect(record!.file.additions).toBe(10);
    expect(record!.file.deletions).toBe(0);
  });

  it("handles deleted file status", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    const fact = makeFileChangeFact({ file: { status: "deleted", additions: 0, deletions: 7 } });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.file.status).toBe("deleted");
    expect(record!.file.additions).toBe(0);
    expect(record!.file.deletions).toBe(7);
  });

  it("projects multiple file change facts in sequence", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    const facts = [
      makeFileChangeFact({ file: { path: "a.ts", status: "added", additions: 1, deletions: 0 } }),
      makeFileChangeFact({
        file: { path: "b.ts", status: "modified", additions: 2, deletions: 1 },
      }),
    ];
    const records = await collect(projector.project(toAsyncIter(facts)));

    expect(records).toHaveLength(2);
    expect(records[0]!.file.path).toBe("a.ts");
    expect(records[1]!.file.path).toBe("b.ts");
  });

  it("yields no output for empty input", async () => {
    const projector = new DefaultFileChangeRecordProjector("repo", null);
    const records = await collect(projector.project(toAsyncIter([])));
    expect(records).toHaveLength(0);
  });
});
