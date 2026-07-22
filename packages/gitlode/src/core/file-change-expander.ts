import type { DiffAdapter, FileBlobChange, GitAdapter } from "../git/index.js";
import type { Instrumentation, InstrumentationSpan } from "../instrumentation/index.js";
import type { CommitFact, FileChangeExpander, FileChangeFact } from "./types.js";

const EMPTY_CONTENT = new Uint8Array(0);
const BINARY_SCAN_LIMIT = 8_000;

export class DefaultFileChangeExpander implements FileChangeExpander {
  private readonly adapter: Pick<GitAdapter, "getFileBlobChanges">;
  private readonly diffAdapter: DiffAdapter;
  private readonly instrumentation: Instrumentation;
  private readonly maxDiffSize: number | undefined;
  private _skippedDiffCount = 0;

  constructor(
    adapter: Pick<GitAdapter, "getFileBlobChanges">,
    diffAdapter: DiffAdapter,
    instrumentation: Instrumentation,
    maxDiffSize?: number,
  ) {
    this.adapter = adapter;
    this.diffAdapter = diffAdapter;
    this.instrumentation = instrumentation;
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
      const span = this.instrumentation.startSpan("git.file_changes");
      const facts: FileChangeFact[] = [];
      let spanError: unknown;
      try {
        const parentOid = commit.parents[0];
        for await (const change of this.adapter.getFileBlobChanges(
          repositoryPath,
          commit.oid,
          parentOid,
        )) {
          const file = this.buildFile(change, span);
          span.incrementCounter("changes");
          facts.push({ type: "file-change", commit, file });
        }
      } catch (error) {
        spanError = error;
        throw error;
      } finally {
        span.end(spanError);
      }
      yield* facts;
    }
  }

  private buildFile(change: FileBlobChange, span: InstrumentationSpan): FileChangeFact["file"] {
    const beforeContent = change.before?.content ?? EMPTY_CONTENT;
    const afterContent = change.after?.content ?? EMPTY_CONTENT;
    const path = fileChangePath(change);

    if (this.exceedsMaxDiffSize(beforeContent, afterContent)) {
      this._skippedDiffCount++;
      span.incrementCounter("skipped_size");
      return { path, status: change.status, additions: null, deletions: null };
    }

    if (isBinary(beforeContent) || isBinary(afterContent)) {
      this._skippedDiffCount++;
      span.incrementCounter("skipped_binary");
      return { path, status: change.status, additions: null, deletions: null };
    }

    const { additions, deletions } = this.instrumentation.run("git.diff", () =>
      this.diffAdapter.computeLineDiff(beforeContent, afterContent),
    );
    validateDiffResult(additions, deletions);
    span.incrementCounter("diffs");
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
      `DiffAdapter returned invalid values: additions=${String(additions)}, deletions=${String(deletions)}`,
    );
  }
}
