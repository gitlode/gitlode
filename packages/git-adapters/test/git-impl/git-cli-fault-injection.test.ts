import { PassThrough } from "node:stream";

import {
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
  type SpanOptions,
  type SpanStatus,
  type Tracer,
} from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import {
  createGitCliAdapterForTesting,
  type GitCliProcessFactory,
} from "../../src/git-impl/git-cli-adapter.js";
import { GitCatFileBatchSession } from "../../src/git-impl/git-cli-cat-file-batch.js";
import { adapterTelemetry } from "../support/adapter-telemetry.js";

interface FakeProcess {
  readonly stdout: PassThrough;
  readonly stderr: PassThrough;
  readonly stdin: PassThrough;
  readonly span?: Span;
  killed: number;
  closed: boolean;
  reaped: boolean;
  close(code: number): void;
  fail(error: Error): void;
}

function fakeProcess(): FakeProcess {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  let closeListener: ((code: number) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  const process: FakeProcess = {
    stdout,
    stderr,
    stdin,
    killed: 0,
    closed: false,
    reaped: false,
    close(code) {
      if (process.closed) return;
      process.closed = true;
      process.reaped = true;
      closeListener?.(code);
    },
    fail(error) {
      process.stdout.end();
      process.stderr.end();
      errorListener?.(error);
    },
  };
  Object.assign(process, {
    kill() {
      process.killed++;
      process.stdout.end();
      process.stderr.end();
      process.stdin?.end();
      process.close(137);
      return true;
    },
    on(event: string, listener: (value: never) => void) {
      if (event === "close") closeListener = listener as unknown as (code: number) => void;
      if (event === "error") errorListener = listener as unknown as (error: Error) => void;
      return process;
    },
  });
  return process;
}

class RecordingSpan {
  readonly attributes: Record<string, string | boolean | number> = {};
  readonly exceptions: unknown[] = [];
  status: SpanStatus | undefined;
  endCount = 0;
  setAttribute(name: string, value: string | boolean | number) {
    this.attributes[name] = value;
    return this;
  }
  setAttributes(values: Record<string, string | boolean | number>) {
    Object.assign(this.attributes, values);
    return this;
  }
  addEvent() {
    return this;
  }
  setStatus(status: SpanStatus) {
    this.status = status;
    return this;
  }
  recordException(error: unknown) {
    this.exceptions.push(error);
  }
  end() {
    this.endCount++;
  }
  isRecording() {
    return this.endCount === 0;
  }
  spanContext() {
    return { traceId: "1".repeat(32), spanId: "2".repeat(16), traceFlags: 1 };
  }
}

class RecordingTracer {
  readonly starts: Array<{
    name: string;
    options?: SpanOptions;
    parent: Context;
    span: RecordingSpan;
  }> = [];
  startSpan(name: string, options?: SpanOptions, parent: Context = ROOT_CONTEXT) {
    const span = new RecordingSpan();
    this.starts.push({ name, options, parent, span });
    return span as unknown as Span;
  }
}

function assertProcessTelemetry(
  tracer: RecordingTracer,
  expected: {
    readonly outer: string;
    readonly revList: string;
    readonly catFile: string;
    readonly outerExceptions?: number;
    readonly revExceptions?: number;
    readonly catExceptions?: number;
  },
) {
  for (const [name, completion, exceptionCount] of [
    ["gitlode.git.commit.walk", expected.outer, expected.outerExceptions ?? 0],
    ["gitlode.git.cli.rev_list", expected.revList, expected.revExceptions ?? 0],
    ["gitlode.git.cli.commit_batch", expected.catFile, expected.catExceptions ?? 0],
  ] as const) {
    const entry = tracer.starts.find((candidate) => candidate.name === name)!;
    expect(
      entry.span.attributes["gitlode.git.cli.process.completion"] ??
        entry.span.attributes["gitlode.stream.completion"],
    ).toBe(completion);
    expect(entry.span.exceptions).toHaveLength(exceptionCount);
    expect(entry.span.endCount).toBe(1);
    expect(JSON.stringify(entry.span.attributes)).not.toMatch(
      /OID|path|command|executable|stdout|stderr/i,
    );
  }
}

type Scenario =
  | "success"
  | "rev-runtime"
  | "rev-nonzero"
  | "cat-runtime"
  | "cat-nonzero"
  | "parse"
  | "pipeline"
  | "pipeline-sync"
  | "both-runtime"
  | "rev-runtime-pending"
  | "cat-runtime-pending";

async function runScenario(
  scenario: Scenario,
  terminal: "exhaust" | "cancel" | "throw" = "exhaust",
) {
  const tracer = new RecordingTracer();
  const revList = fakeProcess();
  const catFile = fakeProcess();
  const runtimeFailure = new Error(`${scenario} runtime failure`);
  const parent = ROOT_CONTEXT;
  const processFactory = ({ kind }: { kind: "rev-list" | "commit-batch" }) => {
    const process = kind === "rev-list" ? revList : catFile;
    queueMicrotask(() => {
      if (terminal === "cancel" && kind === "rev-list") return;
      if (scenario === "rev-runtime" && kind === "rev-list") return revList.fail(runtimeFailure);
      if (scenario === "cat-runtime" && kind === "commit-batch")
        return catFile.fail(runtimeFailure);
      if (
        (scenario === "both-runtime" || scenario === "rev-runtime-pending") &&
        kind === "rev-list"
      )
        return revList.fail(runtimeFailure);
      if (
        (scenario === "both-runtime" || scenario === "cat-runtime-pending") &&
        kind === "commit-batch"
      )
        return catFile.fail(runtimeFailure);
      if (scenario === "rev-nonzero" && kind === "rev-list") return endProcess(revList, 7);
      if (scenario === "cat-nonzero" && kind === "commit-batch") return endProcess(catFile, 7);
      if (scenario === "parse" && kind === "commit-batch") {
        catFile.stdout.end(Buffer.from("malformed output\n"));
        return catFile.close(0);
      }
      if (
        kind === "commit-batch" &&
        (scenario === "success" || terminal === "throw" || terminal === "cancel")
      ) {
        catFile.stdout.write(commitBatchObject());
        if (terminal === "cancel") return;
      }
      if (scenario === "rev-runtime-pending" || scenario === "cat-runtime-pending") return;
      endProcess(process, 0);
    });
    return process;
  };
  const pipeline =
    scenario === "pipeline-sync"
      ? () => {
          throw runtimeFailure;
        }
      : scenario === "pipeline"
        ? async () => {
            throw runtimeFailure;
          }
        : undefined;
  const adapter = createGitCliAdapterForTesting(
    {
      ...adapterTelemetry("git-cli"),
      tracer: tracer as unknown as Tracer,
      parentContext: parent,
    },
    { processFactory, pipeline: pipeline ?? (async () => undefined) },
  );
  const iterator = adapter.walkCommits("/repo", "a".repeat(40) as never)[Symbol.asyncIterator]();
  let outward: unknown;
  try {
    if (terminal === "cancel") {
      const pending = iterator.next();
      await pending;
      await iterator.return?.();
    } else {
      await iterator.next();
      if (terminal === "throw") await iterator.throw?.(runtimeFailure);
      if (terminal === "exhaust") await iterator.next();
    }
  } catch (error) {
    outward = error;
  }
  await iterator.return?.();
  await iterator.next();
  return { tracer, revList, catFile, outward, runtimeFailure, parent };
}

function commitBatchObject(): Buffer {
  const body = Buffer.from(
    "tree " +
      "1".repeat(40) +
      "\nauthor Test <test@example.com> 1 +0000\n" +
      "committer Test <test@example.com> 1 +0000\n\nmessage\n",
  );
  return Buffer.concat([
    Buffer.from(`${"a".repeat(40)} commit ${body.length}\n`),
    body,
    Buffer.from("\n"),
  ]);
}

function endProcess(process: FakeProcess, code: number) {
  process.stdout.end();
  process.stderr.end();
  process.close(code);
}

describe("GitCliAdapter deterministic process owner matrix", () => {
  it("injects process start/close/error/kill controls before production wiring is fixed", async () => {
    const revList = fakeProcess();
    const catFile = fakeProcess();
    let starts = 0;
    const processFactory: GitCliProcessFactory = ({ kind }) => {
      starts++;
      if (kind === "rev-list")
        queueMicrotask(() => revList.fail(new Error("rev-list runtime failure")));
      else
        queueMicrotask(() => {
          catFile.stdout.end();
          catFile.close(0);
        });
      return kind === "rev-list" ? revList : catFile;
    };
    const adapter = createGitCliAdapterForTesting(adapterTelemetry("git-cli"), {
      processFactory,
      pipeline: async () => undefined,
    });
    expect(adapter).toBeDefined();
    await expect(
      adapter
        .walkCommits("C:/gitlode-missing-repository", "a".repeat(40) as never)
        [Symbol.asyncIterator]()
        .next(),
    ).rejects.toThrow();
    expect(starts).toBe(2);
    expect(revList.killed).toBe(1);
    expect(catFile.closed).toBe(true);
  });

  it.each(["rev-list", "commit-batch"] as const)(
    "owns synchronous %s process-factory startup failure",
    async (failedKind) => {
      const tracer = new RecordingTracer();
      const revList = fakeProcess();
      const catFile = fakeProcess();
      const startupFailure = new Error(`sentinel ${failedKind} startup failure`);
      const processFactory: GitCliProcessFactory = ({ kind }) => {
        if (kind === failedKind) throw startupFailure;
        return kind === "rev-list" ? revList : catFile;
      };
      const adapter = createGitCliAdapterForTesting(
        { ...adapterTelemetry("git-cli"), tracer: tracer as unknown as Tracer },
        { processFactory, pipeline: async () => undefined },
      );
      const iterator = adapter
        .walkCommits("sentinel repo path", "a".repeat(40) as never)
        [Symbol.asyncIterator]();
      const outward = await iterator.next().catch((error: unknown) => error);
      expect(outward).toMatchObject({ code: "UNKNOWN" });
      expect((outward as Error).cause).toBe(startupFailure);
      if (failedKind === "commit-batch") {
        expect(revList.killed).toBe(1);
        expect(revList.reaped).toBe(true);
      }
      const revSpan = tracer.starts.find(
        (entry) => entry.name === "gitlode.git.cli.rev_list",
      )!.span;
      const catSpan = tracer.starts.find(
        (entry) => entry.name === "gitlode.git.cli.commit_batch",
      )!.span;
      const failedSpan = failedKind === "rev-list" ? revSpan : catSpan;
      const cancelledSpan = failedKind === "rev-list" ? catSpan : revSpan;
      expect(failedSpan.attributes["gitlode.git.cli.process.completion"]).toBe("error");
      expect(failedSpan.status?.code).toBe(SpanStatusCode.ERROR);
      expect(failedSpan.exceptions).toHaveLength(1);
      expect(cancelledSpan.attributes["gitlode.git.cli.process.completion"]).toBe("cancelled");
      expect(cancelledSpan.status).toBeUndefined();
      expect(cancelledSpan.exceptions).toHaveLength(0);
      for (const entry of tracer.starts) expect(entry.span.endCount).toBe(1);
    },
  );

  it.each([
    ["success", "exhaust", "exhausted", "exited", "exited"],
    ["success", "cancel", "cancelled", "cancelled", "cancelled"],
    ["rev-runtime", "exhaust", "error", "error", "exited"],
    ["rev-nonzero", "exhaust", "error", "error", "exited"],
    ["cat-runtime", "exhaust", "error", "exited", "error"],
    ["cat-nonzero", "exhaust", "error", "exited", "error"],
    ["parse", "exhaust", "error", "cancelled", "error"],
    ["pipeline", "exhaust", "error", "exited", "exited"],
    ["pipeline-sync", "exhaust", "error", "cancelled", "cancelled"],
    ["both-runtime", "exhaust", "error", "error", "error"],
  ] as const)("classifies %s with %s", async (scenario, terminal, outer, revList, catFile) => {
    const result = await runScenario(scenario, terminal);
    assertProcessTelemetry(result.tracer, {
      outer,
      revList,
      catFile,
      revExceptions: scenario === "rev-runtime" || scenario === "both-runtime" ? 1 : 0,
      catExceptions: scenario === "cat-runtime" || scenario === "both-runtime" ? 1 : 0,
    });
    expect(result.revList.reaped).toBe(true);
    expect(result.catFile.reaped).toBe(true);
    const walk = result.tracer.starts.find((entry) => entry.name === "gitlode.git.commit.walk")!;
    expect(walk.parent).toBe(result.parent);
    expect(
      trace.getSpan(
        result.tracer.starts.find((entry) => entry.name === "gitlode.git.cli.rev_list")!.parent,
      ),
    ).toBe(walk.span);
    expect(
      trace.getSpan(
        result.tracer.starts.find((entry) => entry.name === "gitlode.git.cli.commit_batch")!.parent,
      ),
    ).toBe(walk.span);
    if (scenario === "pipeline" || scenario === "pipeline-sync") {
      expect(result.outward).toMatchObject({ code: "UNKNOWN" });
      expect((result.outward as { cause?: unknown }).cause).toBe(result.runtimeFailure);
      expect(String((result.outward as Error).message)).toContain(
        "Unexpected error piping rev-list output to cat-file",
      );
    }
  });

  it("preserves handled and unhandled iterator terminal behavior without repeated cleanup", async () => {
    const handled = await runScenario("success", "throw");
    expect(handled.outward).toBe(handled.runtimeFailure);
    expect(handled.revList.reaped).toBe(true);
    expect(handled.catFile.reaped).toBe(true);
    expect(
      handled.tracer.starts.filter((entry) => entry.name === "gitlode.git.commit.walk")[0]?.span
        .endCount,
    ).toBe(1);
  });

  it("repeats terminal operations without a second end", async () => {
    const result = await runScenario("success");
    const iterator = result.tracer.starts.find(
      (entry) => entry.name === "gitlode.git.commit.walk",
    )!;
    expect(iterator.span.endCount).toBe(1);
  });

  it("preserves the original failure for an unhandled iterator throw", async () => {
    const result = await runScenario("success", "throw");
    expect(result.outward).toBe(result.runtimeFailure);
  });

  it.each(["startup throw", "missing stdin"] as const)(
    "closes persistent batch span for %s",
    async (failureCase) => {
      const tracer = new RecordingTracer();
      const process = fakeProcess();
      const failure = new Error(`sentinel ${failureCase}`);
      const factory: GitCliProcessFactory = () => {
        if (failureCase === "startup throw") throw failure;
        return Object.assign(process, { stdin: undefined });
      };
      const session = new GitCatFileBatchSession(
        "sentinel executable",
        "sentinel repository path",
        tracer as unknown as Tracer,
        adapterTelemetry("git-cli").metricRecorder,
        ROOT_CONTEXT,
        factory,
      );
      const outward = await session
        .readBlob("sentinel-oid" as never)
        .catch((error: unknown) => error);
      expect(outward).toBeInstanceOf(Error);
      expect(tracer.starts).toHaveLength(1);
      expect(tracer.starts[0]!.span.endCount).toBe(1);
      await session[Symbol.asyncDispose]();
      expect(tracer.starts[0]!.span.endCount).toBe(1);
    },
  );
});
