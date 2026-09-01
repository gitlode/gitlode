import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

import {
  DEFAULT_REPOSITORY_OBJECT_FORMAT,
  GitAdapterError,
  type FileBlobChange,
  type FileBlobSnapshot,
  type GitAdapter,
  type RawCommit,
  type RepositoryObjectFormat,
} from "@gitlode/internal-contracts/git";
import type { CommitOid, OidProfile, RefType } from "@gitlode/internal-contracts/model";
import { isCommitOid } from "@gitlode/internal-contracts/model";
import {
  createAsyncIterableInstrumenter,
  type InstrumentAsyncIterable,
} from "@gitlode/internal-foundation/otel-support";
import { context, trace, type Context, type Span, type Tracer } from "@opentelemetry/api";

import {
  GitCatFileBatchSession,
  parseBatchObjectStream,
  processClosed,
  type GitBatchObject,
} from "./git-cli-cat-file-batch.js";
import { parseGitCommitObject } from "./git-cli-commit-parser.js";
import {
  parseRawDiffTreeOutput,
  type CliFileBlobChangeDescriptor,
  type CliFileBlobSnapshotDescriptor,
} from "./git-cli-raw-diff.js";
import type { GitMetricRecorder } from "./git-metric-recorder.js";
import { attributeKey, setGitError, withGitAsyncSpan } from "./git-telemetry.js";

export { parseBatchObjectStream } from "./git-cli-cat-file-batch.js";
export { parseRawDiffTreeOutput } from "./git-cli-raw-diff.js";

export interface GitCliAdapterDependencies {
  readonly tracer: Tracer;
  readonly metricRecorder: GitMetricRecorder;
  readonly parentContext: Context;
  readonly gitExecutable?: string;
}

interface GitCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

interface GitCommandBufferResult {
  readonly stdout: Buffer;
  readonly stderr: Buffer;
  readonly code: number;
}

const DEFAULT_GIT_EXECUTABLE = "git";

export class GitCliAdapter implements GitAdapter {
  private readonly _tracer: Tracer;
  private readonly _parentContext: Context;
  private readonly _metricRecorder: GitMetricRecorder;
  private readonly _gitExecutable: string;
  private readonly _instrumentWalk: InstrumentAsyncIterable;
  private readonly _fileBlobBatchSessions = new Map<string, GitCatFileBatchSession>();
  private _disposed = false;

  constructor(dependencies: GitCliAdapterDependencies) {
    this._tracer = dependencies.tracer;
    this._parentContext = dependencies.parentContext;
    this._metricRecorder = dependencies.metricRecorder;
    this._gitExecutable = dependencies.gitExecutable ?? DEFAULT_GIT_EXECUTABLE;
    this._instrumentWalk = createAsyncIterableInstrumenter((span, completion) => {
      span.setAttribute(attributeKey("stream_completion"), completion);
    });
  }

  supportedObjectFormats(): readonly OidProfile[] {
    return ["sha1"];
  }

  async validateGitExecutable(): Promise<string> {
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.cli.version.check",
      async (span) => {
        const result = await this._validateGitExecutable();
        span.setAttribute(attributeKey("git_cli_version"), sanitizeGitVersion(result));
        return result;
      },
      { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
      this._parentContext,
    );
  }

  private async _validateGitExecutable(): Promise<string> {
    try {
      const result = await this._runGitRaw(["--version"]);
      if (result.code !== 0) {
        throw new GitAdapterError(
          `Git command failed: ${formatCommandFailure(result)}`,
          "NOT_A_REPOSITORY",
        );
      }
      return result.stdout.trim();
    } catch (error) {
      if (error instanceof GitAdapterError) throw error;
      throw new GitAdapterError(
        `Git command is not available: ${this._gitExecutable}`,
        "NOT_A_REPOSITORY",
        error,
      );
    }
  }

  async resolveRef(repoPath: string, ref: string): Promise<CommitOid> {
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.resolve_ref",
      async () => await this._resolveRef(repoPath, ref),
      { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
      context.active(),
    );
  }

  private async _resolveRef(repoPath: string, ref: string): Promise<CommitOid> {
    const result = await this._runGit(
      repoPath,
      ["rev-parse", "--verify", `${ref}^{commit}`],
      [0, 1, 128],
    );
    if (result.code !== 0) {
      if (isNotRepositoryError(result.stderr)) {
        throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY");
      }
      throw new GitAdapterError(`Ref not found: ${ref}`, "REF_NOT_FOUND");
    }

    return firstStdoutLine(result.stdout) as CommitOid;
  }

  async getRepositoryObjectFormat(repoPath: string): Promise<RepositoryObjectFormat> {
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.repository_object_format",
      async (span) => {
        const result = await this._getRepositoryObjectFormat(repoPath);
        span.setAttribute(attributeKey("git_object_format"), result);
        return result;
      },
      { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
      context.active(),
    );
  }

  private async _getRepositoryObjectFormat(repoPath: string): Promise<RepositoryObjectFormat> {
    const result = await this._runGit(
      repoPath,
      ["config", "--get", "extensions.objectFormat"],
      [0, 1],
    );
    if (result.code === 1 && result.stdout.trim().length === 0) {
      return DEFAULT_REPOSITORY_OBJECT_FORMAT;
    }
    if (result.code !== 0) {
      if (isNotRepositoryError(result.stderr)) {
        throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY");
      }
      throw new GitAdapterError(
        `Unexpected error reading repository object format: ${formatCommandFailure(result)}`,
        "UNKNOWN",
      );
    }

    const normalized = result.stdout.trim().toLowerCase();
    return normalized.length === 0 ? DEFAULT_REPOSITORY_OBJECT_FORMAT : normalized;
  }

  async classifyRefType(repoPath: string, ref: string): Promise<RefType> {
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.classify_ref",
      async (span) => {
        const result = await this._classifyRefType(repoPath, ref);
        span.setAttribute(attributeKey("git_ref_type"), result);
        return result;
      },
      { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
      context.active(),
    );
  }

  private async _classifyRefType(repoPath: string, ref: string): Promise<RefType> {
    const branch = await this._runGit(
      repoPath,
      ["rev-parse", "--verify", `refs/heads/${ref}`],
      [0, 1, 128],
    );
    if (branch.code === 0) return "branch";

    const tag = await this._runGit(
      repoPath,
      ["rev-parse", "--verify", `refs/tags/${ref}`],
      [0, 1, 128],
    );
    if (tag.code === 0) {
      const tagOid = firstStdoutLine(tag.stdout);
      const tagType = await this._runGit(repoPath, ["cat-file", "-t", tagOid], [0, 1, 128]);
      return tagType.stdout.trim() === "tag" ? "tag-annotated" : "tag-lightweight";
    }

    if (isCommitOid(ref)) return "commit-oid";

    const generic = await this._runGit(
      repoPath,
      ["rev-parse", "--verify", `${ref}^{commit}`],
      [0, 1, 128],
    );
    return generic.code === 0 ? "branch" : "commit-oid";
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.remote_url.resolve",
      async (span) => {
        const result = await this._getRemoteUrl(repoPath);
        span.setAttribute(
          attributeKey("git_remote_url_result"),
          result === null ? "missing" : "found",
        );
        return result;
      },
      { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
      context.active(),
    );
  }

  private async _getRemoteUrl(repoPath: string): Promise<string | null> {
    const result = await this._runGit(repoPath, ["config", "--get", "remote.origin.url"], [0, 1]);
    if (result.code === 1 && result.stdout.trim().length === 0) return null;
    if (result.code !== 0) {
      if (isNotRepositoryError(result.stderr)) {
        throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY");
      }
      return null;
    }
    const value = result.stdout.trim();
    return value.length > 0 ? value : null;
  }

  async *walkCommits(
    repoPath: string,
    oid: CommitOid,
    excludeOid?: CommitOid,
  ): AsyncIterable<RawCommit> {
    const walkParent = context.active();
    const args = ["rev-list", "--topo-order", oid];
    if (excludeOid !== undefined) args.push("--not", excludeOid);

    const walkOptions = {
      attributes: {
        [attributeKey("git_adapter")]: "git-cli",
        [attributeKey("git_commit_walk_strategy")]: "git-cli-rev-list-stream",
        [attributeKey("git_commit_walk_has_exclusion")]: excludeOid !== undefined,
      },
    } as const;
    yield* this._instrumentWalk(
      this._tracer,
      "gitlode.git.commit.walk",
      (walkSpan) => {
        const revListSpan = this._tracer.startSpan(
          "gitlode.git.cli.rev_list",
          { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
          trace.setSpan(walkParent, walkSpan),
        );
        const catFileSpan = this._tracer.startSpan(
          "gitlode.git.cli.commit_batch",
          { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
          trace.setSpan(walkParent, walkSpan),
        );
        try {
          return async function* (this: GitCliAdapter) {
            for await (const object of streamRevListBatchObjects(
              this._gitExecutable,
              repoPath,
              args,
              revListSpan,
              catFileSpan,
            )) {
              if (object.type !== "commit") {
                throw new GitAdapterError(`Commit not found: ${object.oid}`, "COMMIT_NOT_FOUND");
              }
              this._metricRecorder.recordCommitYielded(
                "git-cli-rev-list-stream",
                excludeOid !== undefined,
              );
              yield parseGitCommitObject(object.oid as CommitOid, object.content);
            }
          }.call(this);
        } catch (error) {
          revListSpan.end();
          catFileSpan.end();
          throw error;
        }
      },
      walkOptions,
      walkParent,
    );
  }

  async findMergeBase(repoPath: string, oids: readonly CommitOid[]): Promise<CommitOid | null> {
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.merge_base",
      async (span) => {
        const result = await this._findMergeBase(repoPath, oids);
        span.setAttribute(
          attributeKey("git_merge_base_result"),
          result === null ? "missing" : "found",
        );
        return result;
      },
      {
        attributes: {
          [attributeKey("git_adapter")]: "git-cli",
          [attributeKey("git_merge_base_input_count")]: oids.length,
        },
      },
      context.active(),
    );
  }

  private async _findMergeBase(
    repoPath: string,
    oids: readonly CommitOid[],
  ): Promise<CommitOid | null> {
    const result = await this._runGit(repoPath, ["merge-base", ...oids], [0, 1]);
    if (result.code === 1 && result.stdout.trim().length === 0) return null;
    if (result.code !== 0) {
      throw new GitAdapterError(
        `Unexpected error finding merge base: ${formatCommandFailure(result)}`,
        "MERGE_BASE_NOT_FOUND",
      );
    }
    const line = firstStdoutLine(result.stdout);
    return line.length > 0 ? (line as CommitOid) : null;
  }

  async *getFileBlobChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid?: CommitOid,
  ): AsyncIterable<FileBlobChange> {
    this._throwIfDisposed();
    yield* this._materializeFileBlobChanges(repoPath, commitOid, parentOid);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    const sessions = [...this._fileBlobBatchSessions.values()];
    this._fileBlobBatchSessions.clear();
    await Promise.all(sessions.map(async (session) => await session[Symbol.asyncDispose]()));
  }

  private async *_materializeFileBlobChanges(
    repoPath: string,
    commitOid: CommitOid,
    parentOid: CommitOid | undefined,
  ): AsyncIterable<FileBlobChange> {
    const descriptors = await this._readFileBlobChangeDescriptors(repoPath, commitOid, parentOid);
    let session: GitCatFileBatchSession | undefined;

    for (const descriptor of descriptors) {
      session ??= this._fileBlobBatchSession(repoPath);
      const change = await materializeCliFileBlobChange(descriptor, session);
      this._metricRecorder.recordFileChangeYielded(change.status);
      yield change;
    }
  }

  private async _readFileBlobChangeDescriptors(
    repoPath: string,
    commitOid: CommitOid,
    parentOid: CommitOid | undefined,
  ): Promise<readonly CliFileBlobChangeDescriptor[]> {
    const mode = parentOid === undefined ? "root" : "parent";
    return await withGitAsyncSpan(
      this._tracer,
      "gitlode.git.cli.diff_tree",
      async (span) => {
        try {
          const result = await this._readFileBlobChangeDescriptorsRaw(
            repoPath,
            commitOid,
            parentOid,
          );
          span.setAttribute(attributeKey("git_cli_process_completion"), "exited");
          return result;
        } catch (error) {
          span.setAttribute(attributeKey("git_cli_process_completion"), "error");
          throw error;
        }
      },
      {
        attributes: {
          [attributeKey("git_adapter")]: "git-cli",
          [attributeKey("git_diff_mode")]: mode,
        },
      },
      context.active(),
    );
  }

  private async _readFileBlobChangeDescriptorsRaw(
    repoPath: string,
    commitOid: CommitOid,
    parentOid: CommitOid | undefined,
  ): Promise<readonly CliFileBlobChangeDescriptor[]> {
    const args = [
      "diff-tree",
      "--no-commit-id",
      "--raw",
      "--no-abbrev",
      "-r",
      "-z",
      "--no-renames",
    ];
    if (parentOid === undefined) {
      args.push("--root", commitOid);
    } else {
      args.push(parentOid, commitOid);
    }

    const result = await this._runGitBuffer(repoPath, args);
    if (result.code !== 0) {
      const stderr = result.stderr.toString("utf8");
      if (isNotRepositoryError(stderr)) {
        throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY");
      }
      throw new GitAdapterError(
        `Unexpected error reading file blob changes: ${formatBufferCommandFailure(result)}`,
        "UNKNOWN",
      );
    }
    return parseRawDiffTreeOutput(result.stdout);
  }

  private _fileBlobBatchSession(repoPath: string): GitCatFileBatchSession {
    const existing = this._fileBlobBatchSessions.get(repoPath);
    if (existing !== undefined) return existing;
    const session = new GitCatFileBatchSession(
      this._gitExecutable,
      repoPath,
      this._tracer,
      this._metricRecorder,
      this._parentContext,
    );
    this._fileBlobBatchSessions.set(repoPath, session);
    return session;
  }

  private _throwIfDisposed(): void {
    if (this._disposed) {
      throw new GitAdapterError("Git CLI adapter has already been disposed", "UNKNOWN");
    }
  }

  private async _runGit(
    repoPath: string,
    args: readonly string[],
    allowedExitCodes: readonly number[] = [0],
  ): Promise<GitCommandResult> {
    const result = await this._runGitRaw(["-C", repoPath, ...args]);
    if (!allowedExitCodes.includes(result.code)) {
      throw new GitAdapterError(`Git command failed: ${formatCommandFailure(result)}`, "UNKNOWN");
    }
    return result;
  }

  private async _runGitRaw(args: readonly string[]): Promise<GitCommandResult> {
    return await runCommand(this._gitExecutable, args);
  }

  private async _runGitBuffer(
    repoPath: string,
    args: readonly string[],
  ): Promise<GitCommandBufferResult> {
    return await runCommand(this._gitExecutable, ["-C", repoPath, ...args], {
      encoding: "buffer",
    });
  }
}

async function materializeCliFileBlobChange(
  descriptor: CliFileBlobChangeDescriptor,
  session: GitCatFileBatchSession,
): Promise<FileBlobChange> {
  switch (descriptor.status) {
    case "added":
      return {
        status: "added",
        before: null,
        after: await materializeCliFileBlobSnapshot(descriptor.after, session),
      };
    case "modified": {
      const [before, after] = await Promise.all([
        materializeCliFileBlobSnapshot(descriptor.before, session),
        materializeCliFileBlobSnapshot(descriptor.after, session),
      ]);
      return { status: "modified", before, after };
    }
    case "deleted":
      return {
        status: "deleted",
        before: await materializeCliFileBlobSnapshot(descriptor.before, session),
        after: null,
      };
  }
}

async function materializeCliFileBlobSnapshot(
  descriptor: CliFileBlobSnapshotDescriptor,
  session: GitCatFileBatchSession,
): Promise<FileBlobSnapshot> {
  const content = await session.readBlob(descriptor.oid);
  return { ...descriptor, content };
}

async function* streamRevListBatchObjects(
  command: string,
  repoPath: string,
  revListArgs: readonly string[],
  revListSpan: Span,
  catFileSpan: Span,
): AsyncIterable<GitBatchObject> {
  const revList = spawn(command, ["-C", repoPath, ...revListArgs], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const catFile = spawn(command, ["-C", repoPath, "cat-file", "--batch"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const revListStderrChunks: Buffer[] = [];
  const catFileStderrChunks: Buffer[] = [];
  revList.stderr.on("data", (chunk: Buffer) => revListStderrChunks.push(chunk));
  catFile.stderr.on("data", (chunk: Buffer) => catFileStderrChunks.push(chunk));

  const pipeClosed = pipeline(revList.stdout, catFile.stdin).then(
    () => undefined,
    (error: unknown) => error,
  );
  const revListClosed = processClosed(revList);
  const catFileClosed = processClosed(catFile);
  let finalized = false;
  const finalize = (
    revListCompletion: "exited" | "cancelled" | "error",
    catFileCompletion: "exited" | "cancelled" | "error",
    revListError?: unknown,
    catFileError?: unknown,
  ): void => {
    if (finalized) return;
    finalized = true;
    revListSpan.setAttribute(attributeKey("git_cli_process_completion"), revListCompletion);
    catFileSpan.setAttribute(attributeKey("git_cli_process_completion"), catFileCompletion);
    if (revListError !== undefined) setGitError(revListSpan, revListError);
    if (catFileError !== undefined) setGitError(catFileSpan, catFileError);
    revListSpan.end();
    catFileSpan.end();
  };
  let exited = false;
  let failure:
    | {
        readonly owner: "rev-list" | "cat-file" | "parse" | "pipeline";
        readonly outward: unknown;
        readonly revListError?: unknown;
        readonly catFileError?: unknown;
        readonly revListTelemetryError?: GitAdapterError;
        readonly catFileTelemetryError?: GitAdapterError;
      }
    | undefined;
  let closeResults:
    | readonly [
        Awaited<typeof revListClosed>,
        Awaited<typeof catFileClosed>,
        Awaited<typeof pipeClosed>,
      ]
    | undefined;
  try {
    for await (const object of parseBatchObjectStream(catFile.stdout)) yield object;
    closeResults = await Promise.all([revListClosed, catFileClosed, pipeClosed]);
    const [revListResult, catFileResult, pipeError] = closeResults;
    const revListStderr = Buffer.concat(revListStderrChunks).toString("utf8");
    const catFileStderr = Buffer.concat(catFileStderrChunks).toString("utf8");
    if (!revListResult.ok || !catFileResult.ok) {
      const revListRuntimeError = revListResult.ok ? undefined : revListResult.error;
      const catFileRuntimeError = catFileResult.ok ? undefined : catFileResult.error;
      const outward =
        revListRuntimeError !== undefined
          ? new GitAdapterError(
              `Unexpected error walking commits: ${formatUnknownError(revListRuntimeError)}`,
              "UNKNOWN",
              revListRuntimeError,
            )
          : new GitAdapterError(
              `Unexpected error reading commit batch: ${formatUnknownError(catFileRuntimeError)}`,
              "UNKNOWN",
              catFileRuntimeError,
            );
      failure = {
        owner: revListRuntimeError !== undefined ? "rev-list" : "cat-file",
        outward,
        revListError: revListRuntimeError,
        catFileError: catFileRuntimeError,
      };
      throw outward;
    }
    if (revListResult.code !== 0) {
      if (isNotRepositoryError(revListStderr)) {
        failure = {
          owner: "rev-list",
          outward: new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY"),
          revListTelemetryError: new GitAdapterError(
            "rev-list process exited unsuccessfully",
            "UNKNOWN",
          ),
        };
        throw failure.outward;
      }
      const result = { stdout: "", stderr: revListStderr, code: revListResult.code };
      failure = {
        owner: "rev-list",
        outward: new GitAdapterError(
          `Unexpected error walking commits: ${formatCommandFailure(result)}`,
          "UNKNOWN",
        ),
        revListTelemetryError: new GitAdapterError(
          "rev-list process exited unsuccessfully",
          "UNKNOWN",
        ),
      };
      throw failure.outward;
    }
    if (catFileResult.code !== 0) {
      if (isNotRepositoryError(catFileStderr)) {
        failure = {
          owner: "cat-file",
          outward: new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY"),
          catFileTelemetryError: new GitAdapterError(
            "commit-batch process exited unsuccessfully",
            "UNKNOWN",
          ),
        };
        throw failure.outward;
      }
      failure = {
        owner: "cat-file",
        outward: new GitAdapterError(
          `Unexpected error reading commit batch: ${catFileStderr.trim()}`,
          "UNKNOWN",
        ),
        catFileTelemetryError: new GitAdapterError(
          "commit-batch process exited unsuccessfully",
          "UNKNOWN",
        ),
      };
      throw failure.outward;
    }
    if (pipeError !== undefined) {
      failure = {
        owner: "pipeline",
        outward: new GitAdapterError(
          `Unexpected error piping rev-list output to cat-file: ${formatUnknownError(pipeError)}`,
          "UNKNOWN",
          pipeError,
        ),
      };
      throw failure.outward;
    }
    exited = true;
  } catch (error) {
    failure ??= {
      owner: "parse",
      outward: error,
      catFileError: error instanceof GitAdapterError ? undefined : error,
    };
    throw error;
  } finally {
    if (!exited) {
      revList.kill();
      catFile.kill();
      closeResults ??= await Promise.all([revListClosed, catFileClosed, pipeClosed]);
    }
    const [revListResult, catFileResult] =
      closeResults ?? (await Promise.all([revListClosed, catFileClosed, pipeClosed]));
    if (exited) {
      finalize("exited", "exited");
    } else if (failure === undefined) {
      finalize("cancelled", "cancelled");
    } else if (failure.owner === "pipeline") {
      finalize(
        revListResult.ok && revListResult.code === 0 ? "exited" : "cancelled",
        catFileResult.ok && catFileResult.code === 0 ? "exited" : "cancelled",
      );
    } else if (failure.owner === "parse") {
      finalize(
        revListResult.ok && revListResult.code === 0 ? "cancelled" : "error",
        catFileResult.ok && catFileResult.code === 0 ? "cancelled" : "error",
        failure.revListError ?? failure.revListTelemetryError,
        failure.catFileError ?? failure.catFileTelemetryError,
      );
    } else {
      finalize(
        revListResult.ok && revListResult.code === 0 ? "exited" : "error",
        catFileResult.ok && catFileResult.code === 0 ? "exited" : "error",
        failure.revListError ?? failure.revListTelemetryError,
        failure.catFileError ?? failure.catFileTelemetryError,
      );
    }
  }
}

function runCommand(
  command: string,
  args: readonly string[],
  options: { readonly stdin?: string; readonly encoding: "buffer" },
): Promise<{ readonly stdout: Buffer; readonly stderr: Buffer; readonly code: number }>;
function runCommand(
  command: string,
  args: readonly string[],
  options?: { readonly stdin?: string; readonly encoding?: "utf8" },
): Promise<GitCommandResult>;
function runCommand(
  command: string,
  args: readonly string[],
  options: { readonly stdin?: string; readonly encoding?: "utf8" | "buffer" } = {},
): Promise<
  GitCommandResult | { readonly stdout: Buffer; readonly stderr: Buffer; readonly code: number }
> {
  const encoding = options.encoding ?? "utf8";
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      const normalizedCode = code ?? 1;
      if (encoding === "buffer") {
        resolve({ stdout, stderr, code: normalizedCode });
        return;
      }
      resolve({
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        code: normalizedCode,
      });
    });

    if (options.stdin !== undefined) child.stdin.write(options.stdin);
    child.stdin.end();
  });
}

function firstStdoutLine(stdout: string): string {
  return stdout.split("\n")[0]?.trim() ?? "";
}

function isNotRepositoryError(stderr: string): boolean {
  return stderr.includes("not a git repository") || stderr.includes("not a gitdir");
}

function formatCommandFailure(result: GitCommandResult): string {
  const stderr = result.stderr.trim();
  return stderr.length > 0 ? stderr : `exit code ${result.code}`;
}

function formatBufferCommandFailure(result: GitCommandBufferResult): string {
  const stderr = result.stderr.toString("utf8").trim();
  return stderr.length > 0 ? stderr : `exit code ${result.code}`;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeGitVersion(value: string): string {
  const match = /^git version (\d+(?:\.\d+){1,3})/.exec(value.trim());
  return match?.[1] ?? "unknown";
}
