import { describe, expect, it, vi } from "vitest";

import type { CommitFact } from "../../src/extraction-api/index.js";
import { FileChangeFactExpander } from "../../src/extraction/file-change-fact-expander.js";
import type { FileBlobChange, FileBlobSnapshot, GitAdapter } from "../../src/git/index.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "../../src/instrumentation/index.js";
import { JsLineDiffCalculator } from "../../src/line-diff-impl/index.js";
import type { LineDiffCalculator } from "../../src/line-diff/index.js";
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
    readonly lineDiffCalculator?: LineDiffCalculator;
    readonly maxDiffSize?: number;
    readonly instrumentation?: ConstructorParameters<typeof FileChangeFactExpander>[2];
  } = {},
): FileChangeFactExpander {
  return new FileChangeFactExpander(
    makeSource(changes),
    options.lineDiffCalculator ??
      new JsLineDiffCalculator({ instrumentation: noopInstrumentation }),
    options.instrumentation ?? noopInstrumentation,
    options.maxDiffSize,
  );
}

describe("FileChangeFactExpander expansion", () => {
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
    const expander = new FileChangeFactExpander(
      source,
      new JsLineDiffCalculator({ instrumentation: noopInstrumentation }),
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

  it("skips binary content without invoking the line-diff calculator", async () => {
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 1 }));
    const binary = new Uint8Array([0x41, 0x00, 0x42]);
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("image.bin", binary) }],
      { lineDiffCalculator: { computeLineDiff } },
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
      { lineDiffCalculator: { computeLineDiff } },
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
      { lineDiffCalculator: { computeLineDiff }, maxDiffSize: 3, instrumentation: recorder },
    );

    const [result] = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(result?.file.additions).toBeNull();
    expect(computeLineDiff).not.toHaveBeenCalled();
    expect(expander.skippedDiffCount).toBe(1);
    expect(recorder.records()).toEqual([
      expect.objectContaining({
        name: "gitlode.file_change_expansion",
        counters: { changes: 1, skipped_size: 1 },
      }),
    ]);
  });

  it("records owned spans and counters for mixed file changes", async () => {
    const instrumentation = new LocalInstrumentationRecorder(() => 1);
    const changes: FileBlobChange[] = [
      {
        status: "modified",
        before: snapshot("text.txt", "old\n"),
        after: snapshot("text.txt", "new\n"),
      },
      { status: "added", before: null, after: snapshot("large.txt", "12345") },
      { status: "added", before: null, after: snapshot("binary.bin", new Uint8Array([0, 1])) },
    ];
    const expander = makeExpander(changes, {
      lineDiffCalculator: new JsLineDiffCalculator({ instrumentation }),
      maxDiffSize: 4,
      instrumentation,
    });

    const results = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));
    expect(results.map(({ file }) => file)).toEqual([
      { path: "text.txt", status: "modified", additions: 1, deletions: 1 },
      { path: "large.txt", status: "added", additions: null, deletions: null },
      { path: "binary.bin", status: "added", additions: null, deletions: null },
    ]);
    expect(expander.skippedDiffCount).toBe(2);
    const expansion = instrumentation
      .records()
      .find(({ name }) => name === "gitlode.file_change_expansion");
    expect(expansion?.counters).toEqual({
      changes: 3,
      diffs: 1,
      skipped_size: 1,
      skipped_binary: 1,
    });
    expect(
      instrumentation.records().filter(({ name }) => name === "gitlode.file_change_expansion"),
    ).toHaveLength(1);
    expect(
      instrumentation.records().filter(({ name }) => name === "line_diff.compute"),
    ).toHaveLength(1);
    for (const rejectedName of [
      ["git", "file_changes"],
      ["git", "diff"],
      ["gitlode", "line_diff"],
    ].map((parts) => parts.join("."))) {
      expect(instrumentation.records().some(({ name }) => name === rejectedName)).toBe(false);
    }
  });

  it("runs the diff when content size equals maxDiffSize", async () => {
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 0 }));
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("exact.txt", "1234") }],
      { lineDiffCalculator: { computeLineDiff }, maxDiffSize: 4 },
    );

    const [result] = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(result?.file.additions).toBe(1);
    expect(computeLineDiff).toHaveBeenCalledOnce();
  });

  it.each([
    {
      diffResult: { additions: -1, deletions: 0 },
      expectedMessage: "LineDiffCalculator returned invalid values: additions=-1, deletions=0",
    },
    {
      diffResult: { additions: 0.5, deletions: 0 },
      expectedMessage: "LineDiffCalculator returned invalid values: additions=0.5, deletions=0",
    },
    {
      diffResult: { additions: Number.NaN, deletions: 0 },
      expectedMessage: "LineDiffCalculator returned invalid values: additions=NaN, deletions=0",
    },
    {
      diffResult: { additions: 0, deletions: Number.POSITIVE_INFINITY },
      expectedMessage:
        "LineDiffCalculator returned invalid values: additions=0, deletions=Infinity",
    },
  ])(
    "rejects invalid line-diff calculator results: %o",
    async ({ diffResult, expectedMessage }) => {
      const expander = makeExpander(
        [{ status: "added", before: null, after: snapshot("file.txt", "text\n") }],
        { lineDiffCalculator: { computeLineDiff: () => diffResult } },
      );

      await expect(
        collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH)),
      ).rejects.toThrow(expectedMessage);
    },
  );

  it("propagates line-diff calculator errors as runtime errors", async () => {
    const failure = new Error("diff failed");
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("file.txt", "text\n") }],
      {
        lineDiffCalculator: {
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
