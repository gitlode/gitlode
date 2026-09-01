import { spawn } from "node:child_process";
import { once } from "node:events";
import type { Readable, Writable } from "node:stream";

import { GitAdapterError } from "@gitlode/internal-contracts/git";
import type { BlobOid } from "@gitlode/internal-contracts/model";
import { captureGroupOrThrow } from "@gitlode/internal-foundation/support";
import { type Context, type Span, type Tracer } from "@opentelemetry/api";

import type { GitMetricRecorder } from "./git-metric-recorder.js";
import { attributeKey, setGitProcessError } from "./git-telemetry.js";

export interface GitBatchObject {
  readonly oid: string;
  readonly type: string;
  readonly content: Uint8Array;
}

export interface GitCliProcess {
  readonly stdout: Readable;
  readonly stderr: Readable;
  readonly stdin: Writable | null;
  on(event: "error", listener: (error: unknown) => void): this;
  on(event: "close", listener: (code: number | null) => void): this;
  kill(): boolean;
}

interface GitCliProcessStart {
  readonly kind: "rev-list" | "commit-batch";
  readonly command: string;
  readonly args: readonly string[];
}

export type GitCliProcessFactory = (start: GitCliProcessStart) => GitCliProcess;

type ProcessCloseResult =
  | { readonly ok: true; readonly code: number }
  | { readonly ok: false; readonly error: unknown };

export function processClosed(child: GitCliProcess): Promise<ProcessCloseResult> {
  return new Promise((resolve) => {
    child.on("error", (error) => resolve({ ok: false, error }));
    child.on("close", (code) => resolve({ ok: true, code: code ?? 1 }));
  });
}

export class GitCatFileBatchSession implements AsyncDisposable {
  private readonly _command: string;
  private readonly _repoPath: string;
  private readonly _tracer: Tracer;
  private readonly _parent: Context;
  private readonly _processFactory: GitCliProcessFactory;
  private _child: GitCliProcess | undefined;
  private _closed: Promise<ProcessCloseResult> | undefined;
  private _objects: AsyncIterator<GitBatchObject> | undefined;
  private readonly _stderrChunks: Buffer[] = [];
  private _span: Span | undefined;
  private readonly _recorder: GitMetricRecorder;
  private _objectsRead = 0;
  private _bytesRead = 0;
  private _queue: Promise<void> = Promise.resolve();
  private _disposed = false;
  private _operationFailure: unknown;

  constructor(
    command: string,
    repoPath: string,
    tracer: Tracer,
    recorder: GitMetricRecorder,
    parent: Context,
    processFactory: GitCliProcessFactory = defaultProcessFactory,
  ) {
    this._command = command;
    this._repoPath = repoPath;
    this._tracer = tracer;
    this._parent = parent;
    this._processFactory = processFactory;
    this._recorder = recorder;
  }

  async readBlob(oid: BlobOid): Promise<Uint8Array> {
    if (this._disposed) {
      throw new GitAdapterError("cat-file batch session has already been disposed", "UNKNOWN");
    }
    this._start();
    const child = this._child;
    const objects = this._objects;
    if (!child || !objects) throw new Error("Git commit-batch process did not start");
    const token = this._recorder.startBlobRead();
    try {
      const content = await this._enqueue(async () => {
        if (!child.stdin || !child.stdin.write(`${oid}\n`)) {
          if (!child.stdin) throw new Error("Git commit-batch process has no stdin");
          await once(child.stdin, "drain");
        }
        const result = await objects.next();
        if (result.done) {
          throw await this._unexpectedCloseError();
        }
        if (result.value.oid !== oid || result.value.type !== "blob") {
          throw new GitAdapterError(
            `Unexpected cat-file response for blob ${oid}: ${result.value.oid} ${result.value.type}`,
            "UNKNOWN",
          );
        }
        return result.value.content;
      });
      this._objectsRead++;
      this._bytesRead += content.length;
      this._recorder.completeBlobRead(token, {
        outcome: "success",
        purpose: "file-change",
        sizeBytes: content.length,
      });
      return content;
    } catch (error) {
      this._recorder.completeBlobRead(token, { outcome: "error" });
      throw error;
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    let failure = this._operationFailure;
    try {
      await this._queue;
      failure ??= this._operationFailure;
      const child = this._child;
      const closed = this._closed;
      if (!child || !closed) return;
      if (!child.stdin) throw new Error("Git commit-batch process has no stdin");
      child.stdin.end();
      const result = await closed;
      if (!result.ok) {
        throw new GitAdapterError(
          `Unexpected error closing cat-file batch: ${formatUnknownError(result.error)}`,
          "UNKNOWN",
          result.error,
        );
      }
      if (result.code !== 0) {
        throw new GitAdapterError(
          `Unexpected error closing cat-file batch: ${this._stderrText() || `exit code ${result.code}`}`,
          "UNKNOWN",
        );
      }
    } catch (error) {
      failure = error;
      this._child?.kill();
      throw error;
    } finally {
      if (!this._span) return;
      this._span.setAttribute(
        attributeKey("git_cli_process_completion"),
        failure ? "error" : "exited",
      );
      this._span.setAttribute(attributeKey("git_object_read_count"), this._objectsRead);
      this._span.setAttribute(attributeKey("git_blob_read_size"), this._bytesRead);
      if (failure) setGitProcessError(this._span, failure);
      this._span.end();
    }
  }

  private async _enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this._queue.then(operation);
    this._queue = result.then(
      () => undefined,
      (error: unknown) => {
        this._operationFailure ??= error;
      },
    );
    return await result;
  }

  private async _unexpectedCloseError(): Promise<GitAdapterError> {
    const closed = this._closed;
    if (!closed) throw new GitAdapterError("cat-file batch process was not started", "UNKNOWN");
    const result = await closed;
    if (!result.ok) {
      return new GitAdapterError(
        `Unexpected error reading cat-file batch: ${formatUnknownError(result.error)}`,
        "UNKNOWN",
        result.error,
      );
    }
    return new GitAdapterError(
      `Unexpected end of cat-file batch output: ${this._stderrText() || `exit code ${result.code}`}`,
      "UNKNOWN",
    );
  }

  private _start(): void {
    if (this._child) return;
    this._span = this._tracer.startSpan(
      "gitlode.git.cli.file_blob_batch",
      { attributes: { [attributeKey("git_adapter")]: "git-cli" } },
      this._parent,
    );
    const child = this._processFactory({
      kind: "commit-batch",
      command: this._command,
      args: ["-C", this._repoPath, "cat-file", "--batch"],
    });
    this._child = child;
    child.stderr.on("data", (chunk: Buffer) => this._stderrChunks.push(chunk));
    child.stdin?.on("error", () => undefined);
    this._closed = processClosed(child);
    this._objects = parseBatchObjectStream(child.stdout)[Symbol.asyncIterator]();
  }

  private _stderrText(): string {
    return Buffer.concat(this._stderrChunks).toString("utf8").trim();
  }
}

function defaultProcessFactory(start: GitCliProcessStart): GitCliProcess {
  return spawn(start.command, start.args, {
    stdio: ["pipe", "pipe", "pipe"],
  }) as unknown as GitCliProcess;
}

export async function* parseBatchObjectStream(stream: Readable): AsyncIterable<GitBatchObject> {
  let buffer: Buffer = Buffer.alloc(0);
  let expectedSize: number | undefined;
  let content: Uint8Array | undefined;
  let contentLength = 0;
  let currentOid = "";
  let currentType = "";

  for await (const chunk of stream) {
    const incoming = chunk as Buffer;
    buffer = buffer.length === 0 ? incoming : Buffer.concat([buffer, incoming]);
    while (true) {
      if (expectedSize === undefined) {
        const headerEnd = buffer.indexOf(0x0a);
        if (headerEnd < 0) break;
        const header = buffer.subarray(0, headerEnd).toString("utf8");
        buffer = buffer.subarray(headerEnd + 1);
        const missingMatch = /^([0-9a-f]+) missing$/.exec(header);
        if (missingMatch) {
          throw new GitAdapterError(
            `Object not found: ${captureGroupOrThrow(missingMatch, 1)}`,
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
        content = new Uint8Array(expectedSize);
        contentLength = 0;
      }

      const remainingContent = expectedSize - contentLength;
      const contentBytes = Math.min(remainingContent, buffer.length);
      if (contentBytes > 0) {
        content?.set(buffer.subarray(0, contentBytes), contentLength);
        contentLength += contentBytes;
        buffer = buffer.subarray(contentBytes);
      }
      if (contentLength < expectedSize || buffer.length === 0) break;
      if (buffer[0] !== 0x0a) {
        throw new GitAdapterError(
          `Unexpected cat-file batch delimiter for ${currentOid}`,
          "UNKNOWN",
        );
      }
      buffer = buffer.subarray(1);
      if (content === undefined) {
        throw new GitAdapterError(`Unexpected cat-file batch state for ${currentOid}`, "UNKNOWN");
      }
      yield { oid: currentOid, type: currentType, content };
      expectedSize = undefined;
      content = undefined;
      contentLength = 0;
      currentOid = "";
      currentType = "";
    }
  }

  if (expectedSize !== undefined || buffer.length > 0) {
    throw new GitAdapterError("Unexpected truncated cat-file batch output", "UNKNOWN");
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
