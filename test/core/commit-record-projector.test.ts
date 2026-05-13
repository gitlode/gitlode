import { describe, expect, it } from "vitest";

import { DefaultCommitRecordProjector } from "../../src/core/commit-record-projector.js";
import type { CommitFact } from "../../src/core/types.js";

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

describe("DefaultCommitRecordProjector", () => {
  it("maps all OutputCommit fields from CommitFact", async () => {
    const projector = new DefaultCommitRecordProjector("repo", "https://github.com/org/repo.git");
    const fact = makeCommitFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record).toBeDefined();
    expect(record!.oid).toBe("a".repeat(40));
    expect(record!.subject).toBe("fix: correct bug");
    expect(record!.body).toBe("Detailed explanation.\n\nCloses #42");
    expect(record!.author.name).toBe("Author Name");
    expect(record!.author.email).toBe("author@example.com");
    expect(record!.committer.name).toBe("Committer Name");
    expect(record!.committer.email).toBe("committer@example.com");
    expect(record!.parents).toEqual(["p".repeat(40)]);
  });

  it("uses constructor-provided repository metadata", async () => {
    const projector = new DefaultCommitRecordProjector("my-repo", "https://github.com/org/my-repo");
    const fact = makeCommitFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("my-repo");
    expect(record!.repository.url).toBe("https://github.com/org/my-repo");
  });

  it("accepts null remoteUrl", async () => {
    const projector = new DefaultCommitRecordProjector("fallback-name", null);
    const fact = makeCommitFact();
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.repository.name).toBe("fallback-name");
    expect(record!.repository.url).toBeNull();
  });

  it("formats author timestamp as ISO 8601 with timezone offset (JST)", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    // 1705276800 = 2024-01-15T00:00:00Z; with JST (UTC+9) → 2024-01-15T09:00:00+09:00
    const fact = makeCommitFact({
      author: {
        name: "Author",
        email: "a@e.com",
        timestamp: 1705276800,
        timezoneOffset: -540,
      },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.author.timestamp).toBe("2024-01-15T09:00:00+09:00");
  });

  it("formats committer timestamp as ISO 8601 with UTC offset", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    // 1705312800 = 2024-01-15T10:00:00Z; with UTC offset 0 → 2024-01-15T10:00:00+00:00
    const fact = makeCommitFact({
      committer: {
        name: "Committer",
        email: "c@e.com",
        timestamp: 1705312800,
        timezoneOffset: 0,
      },
    });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.committer.timestamp).toBe("2024-01-15T10:00:00+00:00");
  });

  it("splits message subject and body correctly", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    const fact = makeCommitFact({ message: "subject line\n\nbody content" });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.subject).toBe("subject line");
    expect(record!.body).toBe("body content");
  });

  it("sets body to empty string when commit message has no body", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    const fact = makeCommitFact({ message: "only subject" });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.subject).toBe("only subject");
    expect(record!.body).toBe("");
  });

  it("yields empty array for root commit parents field", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    const fact = makeCommitFact({ parents: [] });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.parents).toEqual([]);
  });

  it("carries two parents for a merge commit", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    const p1 = "1".repeat(40);
    const p2 = "2".repeat(40);
    const fact = makeCommitFact({ parents: [p1, p2] });
    const [record] = await collect(projector.project(toAsyncIter([fact])));

    expect(record!.parents).toEqual([p1, p2]);
  });

  it("projects multiple commits in sequence", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    const facts = [
      makeCommitFact({ oid: "a".repeat(40), message: "first" }),
      makeCommitFact({ oid: "b".repeat(40), message: "second" }),
    ];
    const records = await collect(projector.project(toAsyncIter(facts)));

    expect(records).toHaveLength(2);
    expect(records[0]!.oid).toBe("a".repeat(40));
    expect(records[0]!.subject).toBe("first");
    expect(records[1]!.oid).toBe("b".repeat(40));
    expect(records[1]!.subject).toBe("second");
  });

  it("yields no output for empty input", async () => {
    const projector = new DefaultCommitRecordProjector("repo", null);
    const records = await collect(projector.project(toAsyncIter([])));
    expect(records).toHaveLength(0);
  });
});
