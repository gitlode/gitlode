import type { CommitFact } from "@gitlode/internal-contracts/extraction";
import type { FileBlobChange, FileBlobSnapshot, GitAdapter } from "@gitlode/internal-contracts/git";
import type { LineDiffCalculator } from "@gitlode/internal-contracts/line-diff";
import type { BlobOid, CommitOid } from "@gitlode/internal-contracts/model";
import { describe, expect, it, vi } from "vitest";

import { NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER } from "../../src/extraction/file-change-fact-expander-metric-recorder.js";
import { FileChangeFactExpander } from "../../src/extraction/file-change-fact-expander.js";

const REPO_PATH = "/fake/repo";
const encoder = new TextEncoder();

const fakeLineDiffCalculator: LineDiffCalculator = {
  computeLineDiff(before, after) {
    const lines = (content: Uint8Array): string[] =>
      new TextDecoder().decode(content).split("\n").filter(Boolean);
    const beforeLines = lines(before);
    const afterLines = lines(after);
    return {
      additions: afterLines.filter((line) => !beforeLines.includes(line)).length,
      deletions: beforeLines.filter((line) => !afterLines.includes(line)).length,
    };
  },
};

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
    readonly metricRecorder?: ConstructorParameters<typeof FileChangeFactExpander>[2];
  } = {},
): FileChangeFactExpander {
  return new FileChangeFactExpander(
    makeSource(changes),
    options.lineDiffCalculator ?? fakeLineDiffCalculator,
    options.metricRecorder ?? NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
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
      fakeLineDiffCalculator,
      NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
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

  it("applies maxDiffSize before binary detection and line diff without legacy observations", async () => {
    const computeLineDiff = vi.fn(() => ({ additions: 1, deletions: 1 }));
    const content = new Uint8Array([0, 1, 2, 3]);
    const recorder = {
      ...NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
      recordDiffSkipped: vi.fn(),
    };
    const expander = makeExpander(
      [{ status: "added", before: null, after: snapshot("large.bin", content) }],
      { lineDiffCalculator: { computeLineDiff }, maxDiffSize: 3, metricRecorder: recorder },
    );

    const [result] = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(result?.file.additions).toBeNull();
    expect(computeLineDiff).not.toHaveBeenCalled();
    expect(expander.skippedDiffCount).toBe(1);
    expect(recorder.recordDiffSkipped).toHaveBeenCalledWith("size");
  });

  it("records skipped expansion inputs through the domain recorder", async () => {
    const recordDiffSkipped = vi.fn();
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
      lineDiffCalculator: fakeLineDiffCalculator,
      maxDiffSize: 4,
      metricRecorder: {
        ...NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
        recordDiffSkipped,
      },
    });

    const results = await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));
    expect(results.map(({ file }) => file)).toEqual([
      { path: "text.txt", status: "modified", additions: 1, deletions: 1 },
      { path: "large.txt", status: "added", additions: null, deletions: null },
      { path: "binary.bin", status: "added", additions: null, deletions: null },
    ]);
    expect(expander.skippedDiffCount).toBe(2);
    expect(recordDiffSkipped).toHaveBeenNthCalledWith(1, "size");
    expect(recordDiffSkipped).toHaveBeenNthCalledWith(2, "binary");
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

  it("records one expansion lifecycle with size and completed partial facts", async () => {
    const startExpansion = vi.fn(() => ({ token: true }) as never);
    const completeExpansion = vi.fn();
    const recordExpanded = vi.fn();
    const recorder = {
      ...NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
      startExpansion,
      completeExpansion,
      recordExpanded,
    };
    const expander = makeExpander(
      [
        { status: "added", before: null, after: snapshot("a", "a") },
        { status: "modified", before: snapshot("b", "b"), after: snapshot("b", "bb") },
        { status: "deleted", before: snapshot("c", "c"), after: null },
      ],
      { metricRecorder: recorder },
    );

    await collect(expander.expand(toAsyncIter([makeCommitFact()]), REPO_PATH));

    expect(startExpansion).toHaveBeenCalledTimes(1);
    expect(completeExpansion).toHaveBeenCalledWith(startExpansion.mock.results[0]?.value, {
      outcome: "success",
      size: 3,
    });
    expect(recordExpanded.mock.calls.map(([type]) => type)).toEqual([
      "added",
      "modified",
      "deleted",
    ]);
  });
});
