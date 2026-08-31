import type {
  CommitFact,
  FileChangeExpander,
  FileChangeFact,
} from "@gitlode/internal-contracts/extraction";
import type { FileBlobChange, GitAdapter } from "@gitlode/internal-contracts/git";
import type { LineDiffCalculator } from "@gitlode/internal-contracts/line-diff";

import type { FileChangeFactExpanderMetricRecorder } from "./file-change-fact-expander-metric-recorder.js";
import { NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER } from "./file-change-fact-expander-metric-recorder.js";

const EMPTY_CONTENT = new Uint8Array(0);
const BINARY_SCAN_LIMIT = 8_000;

export class FileChangeFactExpander implements FileChangeExpander {
  private readonly adapter: Pick<GitAdapter, "getFileBlobChanges">;
  private readonly lineDiffCalculator: LineDiffCalculator;
  private readonly metricRecorder: FileChangeFactExpanderMetricRecorder;
  private readonly maxDiffSize: number | undefined;
  private _skippedDiffCount = 0;

  constructor(
    adapter: Pick<GitAdapter, "getFileBlobChanges">,
    lineDiffCalculator: LineDiffCalculator,
    metricRecorder: FileChangeFactExpanderMetricRecorder,
    maxDiffSize?: number,
  ) {
    this.adapter = adapter;
    this.lineDiffCalculator = lineDiffCalculator;
    this.metricRecorder =
      typeof metricRecorder.startExpansion === "function"
        ? metricRecorder
        : NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER;
    this.maxDiffSize = maxDiffSize;
  }

  get skippedDiffCount(): number {
    return this._skippedDiffCount;
  }

  async *expand(
    commits: AsyncIterable<CommitFact>,
    repositoryPath: string,
  ): AsyncIterable<FileChangeFact> {
    for await (const commit of commits) {
      const token = this.metricRecorder.startExpansion();
      const facts: FileChangeFact[] = [];
      try {
        const parentOid = commit.parents[0];
        for await (const change of this.adapter.getFileBlobChanges(
          repositoryPath,
          commit.oid,
          parentOid,
        )) {
          const file = this.buildFile(change);
          this.metricRecorder.recordExpanded(change.status);
          facts.push({ type: "file-change", commit, file });
        }
      } catch (error) {
        this.metricRecorder.completeExpansion(token, { outcome: "error" });
        throw error;
      }
      this.metricRecorder.completeExpansion(token, { outcome: "success", size: facts.length });
      yield* facts;
    }
  }

  private buildFile(change: FileBlobChange): FileChangeFact["file"] {
    const beforeContent = change.before?.content ?? EMPTY_CONTENT;
    const afterContent = change.after?.content ?? EMPTY_CONTENT;
    const path = fileChangePath(change);

    if (this.exceedsMaxDiffSize(beforeContent, afterContent)) {
      this._skippedDiffCount++;
      this.metricRecorder.recordDiffSkipped("size");
      return { path, status: change.status, additions: null, deletions: null };
    }

    if (isBinary(beforeContent) || isBinary(afterContent)) {
      this._skippedDiffCount++;
      this.metricRecorder.recordDiffSkipped("binary");
      return { path, status: change.status, additions: null, deletions: null };
    }

    const { additions, deletions } = this.lineDiffCalculator.computeLineDiff(
      beforeContent,
      afterContent,
    );
    validateDiffResult(additions, deletions);
    return { path, status: change.status, additions, deletions };
  }

  private exceedsMaxDiffSize(before: Uint8Array, after: Uint8Array): boolean {
    return (
      this.maxDiffSize !== undefined &&
      (before.length > this.maxDiffSize || after.length > this.maxDiffSize)
    );
  }
}

function fileChangePath(change: FileBlobChange): string {
  switch (change.status) {
    case "added":
      return change.after.path;
    case "modified":
      return change.after.path;
    case "deleted":
      return change.before.path;
  }
}

function isBinary(content: Uint8Array): boolean {
  const limit = Math.min(content.length, BINARY_SCAN_LIMIT);
  for (let index = 0; index < limit; index++) {
    if (content[index] === 0) return true;
  }
  return false;
}

function validateDiffResult(additions: number, deletions: number): void {
  if (
    !Number.isFinite(additions) ||
    !Number.isInteger(additions) ||
    additions < 0 ||
    !Number.isFinite(deletions) ||
    !Number.isInteger(deletions) ||
    deletions < 0
  ) {
    throw new Error(
      `LineDiffCalculator returned invalid values: additions=${String(additions)}, deletions=${String(deletions)}`,
    );
  }
}
