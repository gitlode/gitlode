import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  DEFAULT_REPOSITORY_OBJECT_FORMAT,
  GitAdapterError,
  type RawPerson,
  type FileBlobChange,
  type GitAdapter,
  type RawCommit,
  type RepositoryObjectFormat,
} from "../git/index.js";
import type { Instrumentation, InstrumentationSpan } from "../instrumentation/index.js";
import type { CommitOid, OidProfile, RefType } from "../model/index.js";
import { isCommitOid } from "../model/index.js";
import { captureGroupOrThrow } from "../support/index.js";

export interface GitCliAdapterDependencies {
  readonly instrumentation: Instrumentation;
  readonly fileBlobChangeAdapter: Pick<GitAdapter, "getFileBlobChanges">;
  readonly gitExecutable?: string;
}

interface GitCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

interface BatchObject {
  readonly oid: string;
  readonly type: string;
  readonly content: Buffer;
}

const DEFAULT_GIT_EXECUTABLE = "git";

export class GitCliAdapter implements GitAdapter {
  private readonly _instrumentation: Instrumentation;
  private readonly _fileBlobChangeAdapter: Pick<GitAdapter, "getFileBlobChanges">;
  private readonly _gitExecutable: string;

  constructor(dependencies: GitCliAdapterDependencies) {
    this._instrumentation = dependencies.instrumentation;
    this._fileBlobChangeAdapter = dependencies.fileBlobChangeAdapter;
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
    yield* this._fileBlobChangeAdapter.getFileBlobChanges(repoPath, commitOid, parentOid);
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
}

type ProcessCloseResult =
  | { readonly ok: true; readonly code: number }
  | { readonly ok: false; readonly error: unknown };

function processClosed(child: ChildProcess): Promise<ProcessCloseResult> {
  return new Promise((resolve) => {
    child.on("error", (error) => resolve({ ok: false, error }));
    child.on("close", (code) => resolve({ ok: true, code: code ?? 1 }));
  });
}

async function* streamRevListBatchObjects(
  command: string,
  repoPath: string,
  revListArgs: readonly string[],
  revListSpan: InstrumentationSpan,
  catFileSpan: InstrumentationSpan,
): AsyncIterable<BatchObject> {
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

export async function* parseBatchObjectStream(stream: Readable): AsyncIterable<BatchObject> {
  let buffer = Buffer.alloc(0);
  let expectedSize: number | undefined;
  let currentOid = "";
  let currentType = "";

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk as Buffer]);
    while (true) {
      if (expectedSize === undefined) {
        const headerEnd = buffer.indexOf(0x0a);
        if (headerEnd < 0) break;
        const header = buffer.subarray(0, headerEnd).toString("utf8");
        buffer = buffer.subarray(headerEnd + 1);
        const missingMatch = /^([0-9a-f]+) missing$/.exec(header);
        if (missingMatch) {
          throw new GitAdapterError(
            `Commit not found: ${captureGroupOrThrow(missingMatch, 1)}`,
            "COMMIT_NOT_FOUND",
          );
        }
        const match = /^([0-9a-f]+) (\S+) (\d+)$/.exec(header);
        if (!match) {
          throw new GitAdapterError(`Unexpected cat-file batch header: ${header}`, "UNKNOWN");
        }
        currentOid = captureGroupOrThrow(match, 1);
        currentType = captureGroupOrThrow(match, 2);
        expectedSize = Number(captureGroupOrThrow(match, 3));
        if (!Number.isSafeInteger(expectedSize) || expectedSize < 0) {
          throw new GitAdapterError(`Unexpected cat-file batch size for ${currentOid}`, "UNKNOWN");
        }
      }

      if (buffer.length <= expectedSize) break;
      if (buffer[expectedSize] !== 0x0a) {
        throw new GitAdapterError(
          `Unexpected cat-file batch delimiter for ${currentOid}`,
          "UNKNOWN",
        );
      }
      const content = buffer.subarray(0, expectedSize);
      buffer = buffer.subarray(expectedSize + 1);
      yield { oid: currentOid, type: currentType, content };
      expectedSize = undefined;
      currentOid = "";
      currentType = "";
    }
  }

  if (expectedSize !== undefined || buffer.length > 0) {
    throw new GitAdapterError("Unexpected truncated cat-file batch output", "UNKNOWN");
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

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseRawCommit(oid: CommitOid, content: Buffer): RawCommit {
  const raw = content.toString("utf8");
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
