import { spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import type { Readable } from "node:stream";

import { GitAdapterError } from "../git/index.js";
import type { Instrumentation } from "../instrumentation/index.js";
import type { BlobOid } from "../model/index.js";
import { captureGroupOrThrow } from "../support/index.js";

export interface GitBatchObject {
  readonly oid: string;
  readonly type: string;
  readonly content: Uint8Array;
}

export type ProcessCloseResult =
  | { readonly ok: true; readonly code: number }
  | { readonly ok: false; readonly error: unknown };

export function processClosed(child: ChildProcess): Promise<ProcessCloseResult> {
  return new Promise((resolve) => {
    child.on("error", (error) => resolve({ ok: false, error }));
    child.on("close", (code) => resolve({ ok: true, code: code ?? 1 }));
  });
}

export class GitCatFileBatchSession implements AsyncDisposable {
  private readonly _child: ChildProcessWithoutNullStreams;
  private readonly _closed: Promise<ProcessCloseResult>;
  private readonly _objects: AsyncIterator<GitBatchObject>;
  private readonly _stderrChunks: Buffer[] = [];
  private readonly _span: ReturnType<Instrumentation["startSpan"]>;
  private _queue: Promise<void> = Promise.resolve();
  private _disposed = false;
  private _operationFailure: unknown;

  constructor(command: string, repoPath: string, instrumentation: Instrumentation) {
    this._span = instrumentation.startSpan("git.cli.file_blob_batch");
    this._child = spawn(command, ["-C", repoPath, "cat-file", "--batch"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this._child.stderr.on("data", (chunk: Buffer) => this._stderrChunks.push(chunk));
    this._child.stdin.on("error", () => {
      // Process termination is reported through the shared close result.
    });
    this._closed = processClosed(this._child);
    this._objects = parseBatchObjectStream(this._child.stdout)[Symbol.asyncIterator]();
  }

  async readBlob(oid: BlobOid): Promise<Uint8Array> {
    if (this._disposed) {
      throw new GitAdapterError("cat-file batch session has already been disposed", "UNKNOWN");
    }
    return await this._enqueue(async () => {
      if (!this._child.stdin.write(`${oid}\n`)) {
        await once(this._child.stdin, "drain");
      }
      const result = await this._objects.next();
      if (result.done) {
        throw await this._unexpectedCloseError();
      }
      if (result.value.oid !== oid || result.value.type !== "blob") {
        throw new GitAdapterError(
          `Unexpected cat-file response for blob ${oid}: ${result.value.oid} ${result.value.type}`,
          "UNKNOWN",
        );
      }
      this._span.incrementCounter("objects_read");
      this._span.incrementCounter("blob_bytes", result.value.content.length);
      return result.value.content;
    });
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    let failure = this._operationFailure;
    try {
      await this._queue;
      failure ??= this._operationFailure;
      this._child.stdin.end();
      const result = await this._closed;
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
      this._child.kill();
      throw error;
    } finally {
      this._span.end(failure);
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
    const result = await this._closed;
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

  private _stderrText(): string {
    return Buffer.concat(this._stderrChunks).toString("utf8").trim();
  }
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
