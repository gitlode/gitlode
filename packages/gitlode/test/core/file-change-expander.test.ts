import { describe, expect, it, vi } from "vitest";

import { DefaultFileChangeExpander } from "../../src/core/file-change-expander.js";
import type { CommitFact } from "../../src/core/types.js";
import { JsDiffAdapter } from "../../src/git-impl/js-diff-adapter.js";
import type {
  DiffAdapter,
  FileBlobChange,
  FileBlobSnapshot,
  GitAdapter,
} from "../../src/git/index.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "../../src/instrumentation/index.js";
import type { BlobOid, CommitOid } from "../../src/model/index.js";

const REPO_PATH = "/fake/repo";
const encoder = new TextEncoder();

function makeCommitFact(overrides: Partial<CommitFact> = {}): CommitFact {
  return {
    type: "commit",
    oid: "a".repeat(40) as CommitOid,
    message: "commit message",
    author: { name: "Author", email: "author@example.com", timestamp: 1000, timezoneOffset: 0 },
    committer: {
      name: "Committer",
      email: "committer@example.com",
      timestamp: 1000,
      timezoneOffset: 0,
    },
    parents: ["b".repeat(40) as CommitOid],
    repository: { name: "repo", url: null },
    ...overrides,
  };
}

function snapshot(
  path: string,
  content: string | Uint8Array,
  oid = "c".repeat(40),
): FileBlobSnapshot {
  return {
    path,
    oid: oid as BlobOid,
    mode: "100644",
    content: typeof content === "string" ? encoder.encode(content) : content,
  };
}

async function* toAsyncIter<T>(items: readonly T[]): AsyncIterable<T> {
  yield* items;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iter) results.push(item);
  return results;
}

function makeSource(
  changes: readonly FileBlobChange[],
  onRequest?: (commitOid: CommitOid, parentOid: CommitOid | undefined) => void,
): Pick<GitAdapter, "getFileBlobChanges"> {
  return {
    async *getFileBlobChanges(_repoPath, commitOid, parentOid) {
      onRequest?.(commitOid, parentOid);
      yield* changes;
    },
  };
}

function makeExpander(
  changes: readonly FileBlobChange[],
  options: {
    readonly diffAdapter?: DiffAdapter;
    readonly maxDiffSize?: number;
    readonly instrumentation?: ConstructorParameters<typeof DefaultFileChangeExpander>[2];
  } = {},
): DefaultFileChangeExpander {
  return new DefaultFileChangeExpander(
    makeSource(changes),
    options.diffAdapter ?? new JsDiffAdapter(),
    options.instrumentation ?? noopInstrumentation,
    options.maxDiffSize,
  );
}

describe("DefaultFileChangeExpander", () => {
  it("yields no output for an empty commit", async () => {
    const results = await collect(
      makeExpander([]).expand(toAsyncIter([makeCommitFact()]), REPO_PATH),
    );
    expect(results).toEqual([]);
  });

  it("computes line diffs for added, modified, and deleted blobs", async () => {
    const changes: FileBlobChange[] = [
      {
        status: "added",
        before: null,
        after: snapshot("added.txt", "one\ntwo\n", "1".repeat(40)),
      },
      {
        status: "modified",
        before: snapshot("modified.txt", "one\ntwo\n", "2".repeat(40)),
        after: snapshot("modified.txt", "one\nthree\nfour\n", "3".repeat(40)),
      },
      {
        status: "deleted",
        before: snapshot("deleted.txt", "gone\n", "4".repeat(40)),
        after: null,
      },
    ];

    const results = await collect(
      makeExpander(changes).expand(toAsyncIter([makeCommitFact()]), REPO_PATH),
    );

    expect(results.map((result) => result.file)).toEqual([
      { path: "added.txt", status: "added", additions: 2, deletions: 0 },
      { path: "modified.txt", status: "modified", additions: 2, deletions: 1 },
      { path: "deleted.txt", status: "deleted", additions: 0, deletions: 1 },
    ]);
  });

  it("passes no parent for a root commit and only the first parent for a merge", async () => {
    const requests: Array<[CommitOid, CommitOid | undefined]> = [];
    const source = makeSource([], (commitOid, parentOid) => requests.push([commitOid, parentOid]));
    const expander = new DefaultFileChangeExpander(
      source,
      new JsDiffAdapter(),
      noopInstrumentation,
    );
    const root = makeCommitFact({ oid: "1".repeat(40) as CommitOid, parents: [] });
    const firstParent = "2".repeat(40) as CommitOid;
    const merge = makeCommitFact({
      oid: "3".repeat(40) as CommitOid,
      parents: [firstParent, "4".repeat(40) as CommitOid],
    });

    await collect(expander.expand(toAsyncIter([root, merge]), REPO_PATH));

    expect(requests).toEqual([
      [root.oid, undefined],
      [merge.oid, firstParent],
    ]);
  });

  it("skips binary content without invoking DiffAdapter", async () => {
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 1 }));
    const binary = new Uint8Array([0x41, 0x00, 0x42]);
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("image.bin", binary) }],
      { diffAdapter: { computeLineDiff } },
    );

    const [result] = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(result?.file).toMatchObject({ additions: null, deletions: null });
    expect(computeLineDiff).not.toHaveBeenCalled();
    expect(expander.skippedDiffCount).toBe(1);
  });

  it("only scans the first 8,000 bytes for a NUL byte", async () => {
    const content = new Uint8Array(8_001).fill(0x61);
    content[8_000] = 0;
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 0 }));
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("data.txt", content) }],
      { diffAdapter: { computeLineDiff } },
    );

    await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(computeLineDiff).toHaveBeenCalledOnce();
    expect(expander.skippedDiffCount).toBe(0);
  });

  it("applies maxDiffSize before binary detection and line diff", async () => {
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 1 }));
    const content = new Uint8Array([0, 1, 2, 3]);
    const recorder = new LocalInstrumentationRecorder(() => 1);
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("large.bin", content) }],
      { diffAdapter: { computeLineDiff }, maxDiffSize: 3, instrumentation: recorder },
    );

    const [result] = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(result?.file.additions).toBeNull();
    expect(computeLineDiff).not.toHaveBeenCalled();
    expect(expander.skippedDiffCount).toBe(1);
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "git.file_changes",
        counters: { changes: 1, skipped_size: 1 },
      }),
    ]);
  });

  it("runs the diff when content size equals maxDiffSize", async () => {
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 0 }));
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("exact.txt", "1234") }],
      { diffAdapter: { computeLineDiff }, maxDiffSize: 4 },
    );

    const [result] = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(result?.file.additions).toBe(1);
    expect(computeLineDiff).toHaveBeenCalledOnce();
  });

  it.each([
    { additions: -1, deletions: 0 },
    { additions: 0.5, deletions: 0 },
    { additions: Number.NaN, deletions: 0 },
    { additions: 0, deletions: Number.POSITIVE_INFINITY },
  ])("rejects invalid DiffAdapter results: %o", async (diffResult) => {
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("file.txt", "text\n") }],
      { diffAdapter: { computeLineDiff: () => diffResult } },
    );

    await expect(
      collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH)),
    ).rejects.toThrow("DiffAdapter returned invalid values");
  });

  it("propagates DiffAdapter errors as runtime errors", async () => {
    const failure = new Error("diff failed");
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("file.txt", "text\n") }],
      {
        diffAdapter: {
          computeLineDiff() {
            throw failure;
          },
        },
      },
    );

    await expect(collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH))).rejects.toBe(
      failure,
    );
  });
});
