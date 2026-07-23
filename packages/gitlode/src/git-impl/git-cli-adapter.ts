import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

import {
  DEFAULT_REPOSITORY_OBJECT_FORMAT,
  GitAdapterError,
  type FileBlobChange,
  type FileBlobSnapshot,
  type GitAdapter,
  type RawCommit,
  type RawPerson,
  type RepositoryObjectFormat,
} from "../git/index.js";
import {
  instrumentAsyncIterable,
  type Instrumentation,
  type InstrumentationSpan,
} from "../instrumentation/index.js";
import type { CommitOid, OidProfile, RefType } from "../model/index.js";
import { isCommitOid } from "../model/index.js";
import { captureGroupOrThrow } from "../support/index.js";
import {
  GitCatFileBatchSession,
  parseBatchObjectStream,
  processClosed,
  type GitBatchObject,
} from "./git-cli-cat-file-batch.js";
import {
  parseRawDiffTreeOutput,
  type CliFileBlobChangeDescriptor,
  type CliFileBlobSnapshotDescriptor,
} from "./git-cli-raw-diff.js";

export { parseBatchObjectStream } from "./git-cli-cat-file-batch.js";
export { parseRawDiffTreeOutput } from "./git-cli-raw-diff.js";

export interface GitCliAdapterDependencies {
  readonly instrumentation: Instrumentation;
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
  private readonly _instrumentation: Instrumentation;
  private readonly _gitExecutable: string;
  private readonly _fileBlobBatchSessions = new Map<string, GitCatFileBatchSession>();
  private _disposed = false;

  constructor(dependencies: GitCliAdapterDependencies) {
    this._instrumentation = dependencies.instrumentation;
    this._gitExecutable = dependencies.gitExecutable ?? DEFAULT_GIT_EXECUTABLE;
  }

  supportedObjectFormats(): readonly OidProfile[] {
    return ["sha1"];
  }

  async validateGitExecutable(): Promise<string> {
    try {
      const result = await this._instrumentation.runAsync("git.cli.version", async () =>
        this._runGitRaw(["--version"]),
      );
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
    const result = await this._instrumentation.runAsync("git.cli.resolve_ref", async () =>
      this._runGit(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`], [0, 1, 128]),
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
    const result = await this._instrumentation.runAsync(
      "git.cli.repository_object_format",
      async () => this._runGit(repoPath, ["config", "--get", "extensions.objectFormat"], [0, 1]),
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
    const branch = await this._instrumentation.runAsync("git.cli.classify_ref", async () =>
      this._runGit(repoPath, ["rev-parse", "--verify", `refs/heads/${ref}`], [0, 1, 128]),
    );
    if (branch.code === 0) return "branch";

    const tag = await this._instrumentation.runAsync("git.cli.classify_ref", async () =>
      this._runGit(repoPath, ["rev-parse", "--verify", `refs/tags/${ref}`], [0, 1, 128]),
    );
    if (tag.code === 0) {
      const tagOid = firstStdoutLine(tag.stdout);
      const tagType = await this._instrumentation.runAsync("git.cli.classify_ref", async () =>
        this._runGit(repoPath, ["cat-file", "-t", tagOid], [0, 1, 128]),
      );
      return tagType.stdout.trim() === "tag" ? "tag-annotated" : "tag-lightweight";
    }

    if (isCommitOid(ref)) return "commit-oid";

    const generic = await this._instrumentation.runAsync("git.cli.classify_ref", async () =>
      this._runGit(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`], [0, 1, 128]),
    );
    return generic.code === 0 ? "branch" : "commit-oid";
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    const result = await this._instrumentation.runAsync("git.cli.get_remote_url", async () =>
      this._runGit(repoPath, ["config", "--get", "remote.origin.url"], [0, 1]),
    );
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
    const args = ["rev-list", "--topo-order", oid];
    if (excludeOid !== undefined) args.push("--not", excludeOid);

    const revListSpan = this._instrumentation.startSpan("git.cli.rev_list");
    const catFileSpan = this._instrumentation.startSpan("git.cli.cat_file_batch");
    revListSpan.setAttribute("strategy", "git-cli-rev-list-stream");
    let spanError: unknown;
    try {
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
        revListSpan.incrementCounter("yielded");
        catFileSpan.incrementCounter("yielded");
        yield parseRawCommit(object.oid as CommitOid, object.content);
      }
    } catch (error) {
      spanError = error;
      throw error;
    } finally {
      revListSpan.end(spanError);
      catFileSpan.end(spanError);
    }
  }

  async findMergeBase(repoPath: string, oids: readonly CommitOid[]): Promise<CommitOid | null> {
    const result = await this._instrumentation.runAsync("git.cli.merge_base", async () =>
      this._runGit(repoPath, ["merge-base", ...oids], [0, 1]),
    );
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
    yield* instrumentAsyncIterable(this._instrumentation, "git.file_blob_changes", (span) =>
      this._materializeFileBlobChanges(repoPath, commitOid, parentOid, span),
    );
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
    span: InstrumentationSpan,
  ): AsyncIterable<FileBlobChange> {
    const descriptors = await this._readFileBlobChangeDescriptors(repoPath, commitOid, parentOid);
    let session: GitCatFileBatchSession | undefined;

    for (const descriptor of descriptors) {
      session ??= this._fileBlobBatchSession(repoPath);
      const change = await materializeCliFileBlobChange(descriptor, session, this._instrumentation);
      span.incrementCounter("yielded");
      span.incrementCounter(change.status);
      span.incrementCounter(
        "blob_bytes",
        (change.before?.content.length ?? 0) + (change.after?.content.length ?? 0),
      );
      yield change;
    }
  }

  private async _readFileBlobChangeDescriptors(
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

    const result = await this._instrumentation.runAsync("git.cli.diff_tree", async () =>
      this._runGitBuffer(repoPath, args),
    );
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
      this._instrumentation,
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
  instrumentation: Instrumentation,
): Promise<FileBlobChange> {
  switch (descriptor.status) {
    case "added":
      return {
        status: "added",
        before: null,
        after: await materializeCliFileBlobSnapshot(descriptor.after, session, instrumentation),
      };
    case "modified": {
      const [before, after] = await Promise.all([
        materializeCliFileBlobSnapshot(descriptor.before, session, instrumentation),
        materializeCliFileBlobSnapshot(descriptor.after, session, instrumentation),
      ]);
      return { status: "modified", before, after };
    }
    case "deleted":
      return {
        status: "deleted",
        before: await materializeCliFileBlobSnapshot(descriptor.before, session, instrumentation),
        after: null,
      };
  }
}

async function materializeCliFileBlobSnapshot(
  descriptor: CliFileBlobSnapshotDescriptor,
  session: GitCatFileBatchSession,
  instrumentation: Instrumentation,
): Promise<FileBlobSnapshot> {
  const content = await instrumentation.runAsync("git.blob_read", async () =>
    session.readBlob(descriptor.oid),
  );
  return { ...descriptor, content };
}

async function* streamRevListBatchObjects(
  command: string,
  repoPath: string,
  revListArgs: readonly string[],
  revListSpan: InstrumentationSpan,
  catFileSpan: InstrumentationSpan,
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
  let yielded = false;
  let completed = false;

  try {
    for await (const object of parseBatchObjectStream(catFile.stdout)) {
      yielded = true;
      yield object;
    }
    completed = true;
  } catch (error) {
    revList.kill();
    catFile.kill();
    throw error;
  } finally {
    if (!completed) {
      revList.kill();
      catFile.kill();
    }
  }

  const [revListResult, catFileResult, pipeError] = await Promise.all([
    revListClosed,
    catFileClosed,
    pipeClosed,
  ]);
  const revListStderr = Buffer.concat(revListStderrChunks).toString("utf8");
  const catFileStderr = Buffer.concat(catFileStderrChunks).toString("utf8");

  if (!revListResult.ok) {
    throw new GitAdapterError(
      `Unexpected error walking commits: ${formatUnknownError(revListResult.error)}`,
      "UNKNOWN",
      revListResult.error,
    );
  }
  if (!catFileResult.ok) {
    throw new GitAdapterError(
      `Unexpected error reading commit batch: ${formatUnknownError(catFileResult.error)}`,
      "UNKNOWN",
      catFileResult.error,
    );
  }

  const revListCode = revListResult.code;
  const catFileCode = catFileResult.code;

  if (revListCode !== 0) {
    if (isNotRepositoryError(revListStderr)) {
      throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY");
    }
    const result = { stdout: "", stderr: revListStderr, code: revListCode };
    throw new GitAdapterError(
      `Unexpected error walking commits: ${formatCommandFailure(result)}`,
      "UNKNOWN",
    );
  }
  if (catFileCode !== 0) {
    if (isNotRepositoryError(catFileStderr)) {
      throw new GitAdapterError(`Not a Git repository: ${repoPath}`, "NOT_A_REPOSITORY");
    }
    throw new GitAdapterError(
      `Unexpected error reading commit batch: ${catFileStderr.trim()}`,
      "UNKNOWN",
    );
  }
  if (pipeError !== undefined) {
    throw new GitAdapterError(
      `Unexpected error piping rev-list output to cat-file: ${formatUnknownError(pipeError)}`,
      "UNKNOWN",
      pipeError,
    );
  }

  if (!yielded) {
    revListSpan.incrementCounter("yielded", 0);
    catFileSpan.incrementCounter("yielded", 0);
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

function parseRawCommit(oid: CommitOid, content: Uint8Array): RawCommit {
  const raw = Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString("utf8");
  const separator = raw.indexOf("\n\n");
  const headerText = separator >= 0 ? raw.slice(0, separator) : raw;
  const message = separator >= 0 ? raw.slice(separator + 2) : "";
  const parents: CommitOid[] = [];
  let author: RawPerson | undefined;
  let committer: RawPerson | undefined;

  for (const line of headerText.split("\n")) {
    if (line.startsWith("parent ")) parents.push(line.slice("parent ".length) as CommitOid);
    if (line.startsWith("author ")) author = parsePersonLine(line.slice("author ".length));
    if (line.startsWith("committer ")) committer = parsePersonLine(line.slice("committer ".length));
  }

  if (author === undefined || committer === undefined) {
    throw new GitAdapterError(`Unexpected commit object format: ${oid}`, "UNKNOWN");
  }

  return {
    oid,
    message,
    author,
    committer,
    parents,
  };
}

function parsePersonLine(line: string): RawPerson {
  const match = /^(.*) <([^<>]*)> (\d+) ([+-]\d{4})$/.exec(line);
  if (!match) {
    throw new GitAdapterError(`Unexpected commit identity line: ${line}`, "UNKNOWN");
  }
  const timezone = captureGroupOrThrow(match, 4);
  return {
    name: captureGroupOrThrow(match, 1),
    email: captureGroupOrThrow(match, 2),
    timestamp: Number(captureGroupOrThrow(match, 3)),
    timezoneOffset: parseTimezoneOffset(timezone),
  };
}

function parseTimezoneOffset(value: string): number {
  const match = /^([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new GitAdapterError(`Unexpected timezone offset: ${value}`, "UNKNOWN");
  const sign = captureGroupOrThrow(match, 1) === "+" ? 1 : -1;
  const hours = Number(captureGroupOrThrow(match, 2));
  const minutes = Number(captureGroupOrThrow(match, 3));
  return sign * (hours * 60 + minutes);
}
