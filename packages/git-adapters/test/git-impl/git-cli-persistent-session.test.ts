import nodeFs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import type { TimingToken } from "@gitlode/internal-contracts/telemetry";
import { context, ROOT_CONTEXT, type Context, type Span, type Tracer } from "@opentelemetry/api";
import * as git from "isomorphic-git";
import { afterEach, describe, expect, it } from "vitest";

import {
  createGitCliAdapterForTesting,
  type GitCliProcessFactory,
} from "../../src/git-impl/git-cli-adapter.js";
import type { GitCliProcess } from "../../src/git-impl/git-cli-cat-file-batch.js";
import {
  NOOP_GIT_METRIC_RECORDER,
  type GitMetricRecorder,
} from "../../src/git-impl/git-metric-recorder.js";
import { adapterTelemetry } from "../support/adapter-telemetry.js";

class RecordingSpan {
  readonly attributes: Record<string, unknown> = {};
  readonly exceptions: unknown[] = [];
  readonly events: unknown[] = [];
  readonly endSnapshots: Array<{ reaped: boolean }> = [];
  status: { code: number } | undefined;
  endCount = 0;
  reaped = false;
  setAttribute(name: string, value: unknown) {
    this.attributes[name] = value;
    return this;
  }
  setAttributes(values: Record<string, unknown>) {
    Object.assign(this.attributes, values);
    return this;
  }
  addEvent(name: string, attributes?: unknown) {
    this.events.push({ name, attributes });
    return this;
  }
  setStatus(status: { code: number }) {
    this.status = status;
    return this;
  }
  recordException(error: unknown) {
    this.exceptions.push(error);
  }
  end() {
    this.endCount++;
    this.endSnapshots.push({ reaped: this.reaped });
  }
  isRecording() {
    return this.endCount === 0;
  }
  spanContext() {
    return {
      traceId: "1".repeat(32),
      spanId: `${this.endCount + 1}`.padStart(16, "0"),
      traceFlags: 1,
    };
  }
}

class RecordingTracer {
  readonly starts: Array<{
    name: string;
    parent: Context;
    span: RecordingSpan;
    attributes: Record<string, unknown>;
  }> = [];
  startSpan(
    name: string,
    options: { attributes?: Record<string, unknown> } | undefined,
    parent = ROOT_CONTEXT,
  ) {
    const span = new RecordingSpan();
    const attributes = { ...(options?.attributes ?? {}) };
    this.starts.push({ name, parent, span, attributes });
    span.setAttributes(attributes);
    return span as unknown as Span;
  }
}

interface FakeProcess extends GitCliProcess {
  readonly process: PassThrough;
  killed: number;
  closed: boolean;
  reaped: boolean;
  mode: "success" | "runtime" | "nonzero" | "malformed";
  onReap?: () => void;
}

function fakeProcess(mode: FakeProcess["mode"] = "success"): FakeProcess {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const process = new PassThrough();
  const value = {
    stdout,
    stderr,
    stdin,
    process,
    killed: 0,
    closed: false,
    reaped: false,
    mode,
  } as FakeProcess;
  let closeListener: ((code: number | null) => void) | undefined;
  let errorListener: ((error: unknown) => void) | undefined;
  value.on = ((event: string, listener: (value: never) => void) => {
    if (event === "close") closeListener = listener as unknown as (code: number | null) => void;
    if (event === "error") errorListener = listener as unknown as (error: unknown) => void;
    return value;
  }) as FakeProcess["on"];
  value.kill = (() => {
    value.killed++;
    stdin.end();
    stdout.end();
    stderr.end();
    if (!value.closed) {
      value.closed = true;
      value.reaped = true;
      value.onReap?.();
      closeListener?.(137);
    }
    return true;
  }) as FakeProcess["kill"];
  stdin.on("data", (chunk) => {
    if (value.mode === "runtime") {
      errorListener?.(new Error("sentinel runtime failure"));
      stdout.end();
      stderr.end();
      return;
    }
    if (value.mode === "nonzero") {
      value.closed = true;
      value.reaped = true;
      value.onReap?.();
      stdout.end();
      stderr.end();
      closeListener?.(7);
      return;
    }
    if (value.mode === "malformed") stdout.write(Buffer.from("sentinel malformed output\n"));
    else {
      const oid = String(chunk).trim();
      const body = Buffer.from("blob body\n");
      stdout.write(Buffer.from(`${oid} blob ${body.length}\n`));
      stdout.write(body);
      stdout.write("\n");
    }
  });
  stdin.on("end", () => {
    if (!value.closed) {
      value.closed = true;
      value.reaped = true;
      value.onReap?.();
      stdout.end();
      stderr.end();
      closeListener?.(value.mode === "nonzero" ? 7 : 0);
    }
  });
  return value;
}

const tempDirs: string[] = [];

async function createRepository(): Promise<{ path: string; head: string }> {
  const path = await mkdtemp(join(tmpdir(), "gitlode-session-"));
  tempDirs.push(path);
  await git.init({ fs: nodeFs, dir: path, defaultBranch: "main" });
  await git.setConfig({ fs: nodeFs, dir: path, path: "user.name", value: "Test" });
  await git.setConfig({ fs: nodeFs, dir: path, path: "user.email", value: "test@example.com" });
  nodeFs.writeFileSync(join(path, "file.txt"), "hello\n");
  await git.add({ fs: nodeFs, dir: path, filepath: "file.txt" });
  const head = await git.commit({
    fs: nodeFs,
    dir: path,
    message: "initial",
    author: { name: "Test", email: "test@example.com", timestamp: 1, timezoneOffset: 0 },
  });
  return { path, head };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function makeAdapter(
  tracer: RecordingTracer,
  factory: GitCliProcessFactory,
  parent: Context,
  metricRecorder: GitMetricRecorder = NOOP_GIT_METRIC_RECORDER,
) {
  const telemetry = adapterTelemetry("git-cli");
  return createGitCliAdapterForTesting(
    {
      tracer: tracer as unknown as Tracer,
      metricRecorder,
      parentContext: parent,
      dagTelemetryBinding: telemetry.dagTelemetryBinding,
    },
    { processFactory: factory, pipeline: async () => undefined },
  );
}

class RecordingMetrics implements GitMetricRecorder {
  readonly blobCompletions: Array<{ token: TimingToken; outcome: string }> = [];
  recordCommitYielded() {}
  recordCommitObjectRead() {}
  recordObjectCacheLookup() {}
  recordFileChangeYielded() {}
  startBlobRead(): TimingToken {
    return {} as TimingToken;
  }
  completeBlobRead(token: TimingToken, completion: { outcome: "success" | "error" }): void {
    this.blobCompletions.push({ token, outcome: completion.outcome });
  }
}

describe("GitCliAdapter persistent session production matrix", () => {
  function factoryFor(
    tracer: RecordingTracer,
    processes: FakeProcess[],
    mode: FakeProcess["mode"] = "success",
    firstStartFailure?: Error,
    missingStdin = false,
  ): GitCliProcessFactory {
    let starts = 0;
    return () => {
      starts++;
      if (starts === 1 && firstStartFailure !== undefined) throw firstStartFailure;
      const process = fakeProcess(mode);
      if (missingStdin && starts === 1) {
        (process as unknown as { stdin: null }).stdin = null;
      }
      processes.push(process);
      process.onReap = () => {
        const batch = [...tracer.starts]
          .reverse()
          .find(
            (entry) =>
              entry.name === "gitlode.git.cli.file_blob_batch" && entry.span.endCount === 0,
          );
        if (batch) batch.span.reaped = true;
      };
      return process;
    };
  }

  it("starts lazily, reuses one repository session, and ends after reap", async () => {
    const repo = await createRepository();
    const tracer = new RecordingTracer();
    const parent = ROOT_CONTEXT;
    const processes: FakeProcess[] = [];
    const metrics = new RecordingMetrics();
    const adapter = makeAdapter(tracer, factoryFor(tracer, processes), parent, metrics);
    const iterator = adapter
      .getFileBlobChanges(repo.path, repo.head as never)
      [Symbol.asyncIterator]();
    expect(processes).toHaveLength(0);
    expect(
      tracer.starts.filter((entry) => entry.name === "gitlode.git.cli.file_blob_batch"),
    ).toHaveLength(0);
    await iterator.next();
    expect(processes).toHaveLength(1);
    await iterator.return?.();
    const second = adapter
      .getFileBlobChanges(repo.path, repo.head as never)
      [Symbol.asyncIterator]();
    await second.next();
    expect(processes).toHaveLength(1);
    await adapter[Symbol.asyncDispose]();
    const batch = tracer.starts.find((entry) => entry.name === "gitlode.git.cli.file_blob_batch")!;
    expect(batch.parent).toBe(parent);
    expect(batch.attributes).toEqual({ "gitlode.git.adapter": "git-cli" });
    expect(batch.span.attributes).toEqual({
      "gitlode.git.adapter": "git-cli",
      "gitlode.git.cli.process.completion": "exited",
      "gitlode.git.object.read.count": 2,
      "gitlode.git.blob.read.size": 20,
    });
    expect(batch.span.status).toBeUndefined();
    expect(batch.span.exceptions).toHaveLength(0);
    expect(batch.span.endCount).toBe(1);
    expect(batch.span.endSnapshots[0]?.reaped).toBe(true);
    expect(processes[0]?.killed).toBe(0);
    expect(metrics.blobCompletions).toHaveLength(2);
    expect(metrics.blobCompletions.every((entry) => entry.outcome === "success")).toBe(true);
    expect(JSON.stringify(batch.span)).not.toContain(repo.path);
  });

  it("serializes concurrent reads through one repository session", async () => {
    const repo = await createRepository();
    const tracer = new RecordingTracer();
    const processes: FakeProcess[] = [];
    const adapter = makeAdapter(tracer, factoryFor(tracer, processes), ROOT_CONTEXT);
    const first = adapter.getFileBlobChanges(repo.path, repo.head as never)[Symbol.asyncIterator]();
    const second = adapter
      .getFileBlobChanges(repo.path, repo.head as never)
      [Symbol.asyncIterator]();
    const results = await Promise.all([first.next(), second.next()]);
    expect(results.every((result) => result.done === false)).toBe(true);
    expect(processes).toHaveLength(1);
    await Promise.all([first.return?.(), second.return?.()]);
    await adapter[Symbol.asyncDispose]();
    const sessions = tracer.starts.filter(
      (entry) => entry.name === "gitlode.git.cli.file_blob_batch",
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.span.endCount).toBe(1);
  });

  it("keeps sessions repository-scoped and does not start one for a no-change diff", async () => {
    const firstRepo = await createRepository();
    const secondRepo = await createRepository();
    const tracer = new RecordingTracer();
    const processes: FakeProcess[] = [];
    const adapter = makeAdapter(tracer, factoryFor(tracer, processes), ROOT_CONTEXT);

    const noChange = adapter
      .getFileBlobChanges(firstRepo.path, firstRepo.head as never, firstRepo.head as never)
      [Symbol.asyncIterator]();
    await expect(noChange.next()).resolves.toMatchObject({ done: true });
    expect(processes).toHaveLength(0);

    const first = adapter
      .getFileBlobChanges(firstRepo.path, firstRepo.head as never)
      [Symbol.asyncIterator]();
    const second = adapter
      .getFileBlobChanges(secondRepo.path, secondRepo.head as never)
      [Symbol.asyncIterator]();
    await Promise.all([first.next(), second.next()]);
    expect(processes).toHaveLength(2);
    await adapter[Symbol.asyncDispose]();
    expect(
      tracer.starts.filter((entry) => entry.name === "gitlode.git.cli.file_blob_batch"),
    ).toHaveLength(2);
  });

  it("evicts a synchronously failed session and creates a fresh session for the same repository", async () => {
    const repo = await createRepository();
    const tracer = new RecordingTracer();
    const processes: FakeProcess[] = [];
    const metrics = new RecordingMetrics();
    const adapter = makeAdapter(
      tracer,
      factoryFor(tracer, processes, "success", new Error("sentinel startup failure")),
      ROOT_CONTEXT,
      metrics,
    );

    const first = adapter.getFileBlobChanges(repo.path, repo.head as never)[Symbol.asyncIterator]();
    await expect(first.next()).rejects.toThrow("sentinel startup failure");
    const failed = tracer.starts.find((entry) => entry.name === "gitlode.git.cli.file_blob_batch")!;
    expect(failed.span.attributes["gitlode.git.cli.process.completion"]).toBe("error");
    expect(failed.span.status?.code).toBe(2);
    expect(failed.span.exceptions).toHaveLength(1);
    expect(failed.span.endCount).toBe(1);
    expect(metrics.blobCompletions).toHaveLength(1);
    expect(metrics.blobCompletions[0]?.outcome).toBe("error");

    const second = adapter
      .getFileBlobChanges(repo.path, repo.head as never)
      [Symbol.asyncIterator]();
    await expect(second.next()).resolves.toMatchObject({ done: false });
    expect(processes).toHaveLength(1);
    await adapter[Symbol.asyncDispose]();
    const sessions = tracer.starts.filter(
      (entry) => entry.name === "gitlode.git.cli.file_blob_batch",
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.span.endCount).toBe(1);
    expect(sessions[1]?.span.endCount).toBe(1);
  });

  it("evicts a session with missing stdin and does not reuse its ended span", async () => {
    const repo = await createRepository();
    const tracer = new RecordingTracer();
    const processes: FakeProcess[] = [];
    const adapter = makeAdapter(
      tracer,
      factoryFor(tracer, processes, "success", undefined, true),
      ROOT_CONTEXT,
    );
    const first = adapter.getFileBlobChanges(repo.path, repo.head as never)[Symbol.asyncIterator]();
    await expect(first.next()).rejects.toThrow("invalid stream shape");
    const failed = tracer.starts.find((entry) => entry.name === "gitlode.git.cli.file_blob_batch")!;
    expect(failed.span.status?.code).toBe(2);
    expect(failed.span.exceptions).toHaveLength(1);
    expect(failed.span.endCount).toBe(1);
    expect(failed.span.endSnapshots[0]?.reaped).toBe(true);
    const second = adapter
      .getFileBlobChanges(repo.path, repo.head as never)
      [Symbol.asyncIterator]();
    await expect(second.next()).resolves.toMatchObject({ done: false });
    expect(processes).toHaveLength(2);
    await adapter[Symbol.asyncDispose]();
    expect(failed.span.endCount).toBe(1);
    expect(
      tracer.starts.filter((entry) => entry.name === "gitlode.git.cli.file_blob_batch"),
    ).toHaveLength(2);
  });

  it.each(["runtime", "nonzero", "malformed"] as const)(
    "records %s persistent read failure without success-only blob metrics",
    async (mode) => {
      const repo = await createRepository();
      const tracer = new RecordingTracer();
      const processes: FakeProcess[] = [];
      const metrics = new RecordingMetrics();
      const adapter = makeAdapter(
        tracer,
        () => {
          const process = fakeProcess(mode);
          processes.push(process);
          process.onReap = () => {
            const batch = tracer.starts.find(
              (entry) => entry.name === "gitlode.git.cli.file_blob_batch",
            );
            if (batch) batch.span.reaped = true;
          };
          return process;
        },
        ROOT_CONTEXT,
        metrics,
      );
      const iterator = adapter
        .getFileBlobChanges(repo.path, repo.head as never)
        [Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toBeInstanceOf(Error);
      await adapter[Symbol.asyncDispose]().catch(() => undefined);
      const batch = tracer.starts.find(
        (entry) => entry.name === "gitlode.git.cli.file_blob_batch",
      )!;
      expect(batch.span.attributes["gitlode.git.cli.process.completion"]).toBe("error");
      expect(batch.span.status?.code).toBe(2);
      expect(batch.span.endCount).toBe(1);
      expect(batch.span.endSnapshots[0]?.reaped).toBe(true);
      expect(processes[0]?.killed).toBe(mode === "malformed" ? 0 : 1);
      expect(metrics.blobCompletions).toHaveLength(1);
      expect(metrics.blobCompletions[0]?.outcome).toBe("error");
      expect(JSON.stringify(batch.span)).not.toMatch(/sentinel|gitlode-session-|file\.txt/);
    },
  );
});
