import nodeFs from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProgressEvent } from "@gitlode/internal-contracts/progress";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import { ROOT_CONTEXT, context, metrics, trace, type Meter } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import * as git from "isomorphic-git";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executeRun,
  executeWorkerRunRequest,
  type ExecuteRunDependencies,
} from "../../src/execution/execute-run.js";
import type { ExecutionRunInput, WorkerRunRequest } from "../../src/execution/types.js";
import type { StateStore } from "../../src/state/index.js";
import { makeTracer } from "../support/otel-fakes.js";

const tempDirs: string[] = [];

class RecordingGitMetricRecorder {
  constructor(private readonly adapter: "isomorphic-git" | "git-cli") {}
  readonly calls: Array<{ name: string; value: number; attributes: Record<string, unknown> }> = [];
  recordCommitYielded(strategy: string, hasExclusion: boolean) {
    this.calls.push({
      name: "gitlode.git.commit.yielded",
      value: 1,
      attributes: {
        "gitlode.git.adapter": this.adapter,
        "gitlode.git.commit.walk.strategy": strategy,
        "gitlode.git.commit.walk.has_exclusion": hasExclusion,
      },
    });
  }
  recordCommitObjectRead() {}
  recordObjectCacheLookup() {}
  recordFileChangeYielded() {}
  startBlobRead() {
    return {} as never;
  }
  completeBlobRead() {}
}

class RecordingLineDiffMeter {
  readonly creations: Array<{ readonly kind: string; readonly name: string }> = [];
  readonly calls: Array<{
    readonly name: string;
    readonly value: number;
    readonly attributes: unknown;
  }> = [];

  createCounter(name: string) {
    this.creations.push({ kind: "counter", name });
    return {
      add: (value: number, attributes: unknown) => this.calls.push({ name, value, attributes }),
    };
  }

  createHistogram(name: string) {
    this.creations.push({ kind: "histogram", name });
    return {
      record: (value: number, attributes: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
}

const testGitTelemetry = {
  lineDiffMeter: metrics.getMeter("gitlode.test.line_diff"),
  gitTracer: trace.getTracer("gitlode.test.git"),
  gitMetricRecorder: {
    recordCommitYielded() {},
    recordCommitObjectRead() {},
    recordObjectCacheLookup() {},
    recordFileChangeYielded() {},
    startBlobRead: () => ({}) as never,
    completeBlobRead() {},
  },
  dagTelemetryBinding: {
    instrumentDifference(
      _strategy: string,
      _hasExclusion: boolean,
      walk: (observation: never) => AsyncIterable<unknown>,
    ) {
      const observation = {
        complete() {},
        recordStepProcessed() {},
        recordStepStale() {},
        recordSuccessorExpansion() {},
        recordNodeYielded() {},
        recordNodeExcluded() {},
        markFallback() {},
        recordFallbackNodeRemoved() {},
        setCertificationResult() {},
        setTerminationReason() {},
        recordStartCount() {},
        setCertifiedClosureResult() {},
      };
      return walk(observation as never);
    },
  },
  rootContext: ROOT_CONTEXT,
  pluginRuntimeTracer: trace.getTracer("gitlode.test.plugin_runtime"),
  getPluginTracer: (name: string, version?: string) => trace.getTracer(name, version),
  getPluginMeter: (name: string, version?: string) => metrics.getMeter(name, version),
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeExecutionRunInput(overrides: Partial<ExecutionRunInput> = {}): ExecutionRunInput {
  return {
    repositoryPath: "/repo",
    refs: ["main"],
    outputDir: "/out",
    rotation: {},
    granularity: "commit",
    profile: false,
    gitAdapter: "isomorphic-git",
    incremental: true,
    missingState: "error",
    stateFilePath: "/state.json",
    ...overrides,
  };
}

describe("executeRun state orchestration", () => {
  it("loads a state document and saves the checkpoint returned by the worker before resolving success", async () => {
    const sideEffects: string[] = [];
    const priorCheckpoint = {
      generatedAt: "prior",
      repositoryPath: "/repo",
      refs: [],
    };
    const returnedCheckpoint = {
      generatedAt: "next",
      repositoryPath: "/repo",
      refs: [{ ref: "main", refType: "branch" as const, tipOid: "abc", updatedAt: "next" }],
    };
    const stateStore: StateStore = {
      async read() {
        throw new Error("loadStateFile dependency should own state loading");
      },
      async write(document) {
        expect(document).toEqual({ version: 2, ...returnedCheckpoint });
        expect(document).not.toBe(returnedCheckpoint);
        sideEffects.push("state-write");
      },
    };
    const dependencies: ExecuteRunDependencies = {
      createStateStore(stateFilePath) {
        expect(stateFilePath).toBe("/state.json");
        return stateStore;
      },
      async loadStateFile(store) {
        expect(store).toBe(stateStore);
        sideEffects.push("state-load");
        return priorCheckpoint;
      },
      async dispatchWorkerRunRequest(request) {
        expect(request.priorCheckpoint).toBe(priorCheckpoint);
        sideEffects.push("worker-dispatch");
        return {
          kind: "success",
          success: {
            recordsWritten: 1,
            commitsTraversed: 1,
            filesCreated: 1,
            bytesWritten: 100,
            elapsedMs: 10,
            refs: ["main"],
            profileReport: undefined,
            skippedDiffs: 0,
          },
          checkpoint: returnedCheckpoint,
        };
      },
    };

    const result = await executeRun(
      makeExecutionRunInput(),
      { progressReporter: { emit: vi.fn() }, diagnosticReporter: { report: vi.fn() } },
      dependencies,
    );

    expect(result.kind).toBe("success");
    expect(sideEffects).toEqual(["state-load", "worker-dispatch", "state-write"]);
  });

  it("emits the existing fallback warning and dispatches with an empty checkpoint", async () => {
    const sideEffects: string[] = [];
    const reportDiagnostic = vi.fn(() => sideEffects.push("diagnostic"));
    const stateStore: StateStore = {
      async read() {
        return null;
      },
      async write() {},
    };
    const dependencies: ExecuteRunDependencies = {
      createStateStore() {
        return stateStore;
      },
      async loadStateFile() {
        return undefined;
      },
      async dispatchWorkerRunRequest(request) {
        sideEffects.push("worker-dispatch");
        expect(request.priorCheckpoint.refs).toEqual([]);
        return { kind: "user-error", message: "stop after state setup" };
      },
    };

    await executeRun(
      makeExecutionRunInput({ missingState: "snapshot" }),
      { progressReporter: { emit: vi.fn() }, diagnosticReporter: { report: reportDiagnostic } },
      dependencies,
    );

    expect(sideEffects).toEqual(["diagnostic", "worker-dispatch"]);
    expect(reportDiagnostic).toHaveBeenCalledWith({
      severity: "warn",
      message: "State file not found: /state.json. Falling back to full snapshot extraction.",
    });
  });

  it("does not save a successful worker checkpoint with no refs", async () => {
    const saveStateFile = vi.fn();
    const stateStore: StateStore = {
      async read() {
        return null;
      },
      async write() {},
    };
    const dependencies: ExecuteRunDependencies = {
      createStateStore() {
        return stateStore;
      },
      async loadStateFile() {
        return { generatedAt: "prior", repositoryPath: "/repo", refs: [] };
      },
      async dispatchWorkerRunRequest() {
        return {
          kind: "success",
          success: {
            recordsWritten: 0,
            commitsTraversed: 0,
            filesCreated: 0,
            bytesWritten: 0,
            elapsedMs: 10,
            refs: [],
            profileReport: undefined,
            skippedDiffs: 0,
          },
          checkpoint: { generatedAt: "next", repositoryPath: "/repo", refs: [] },
        };
      },
      saveStateFile,
    };

    const result = await executeRun(
      makeExecutionRunInput(),
      { progressReporter: { emit: vi.fn() }, diagnosticReporter: { report: vi.fn() } },
      dependencies,
    );

    expect(result.kind).toBe("success");
    expect(saveStateFile).not.toHaveBeenCalled();
  });
});

describe("executeWorkerRunRequest profiling", () => {
  it("includes git adapter walkCommits instrumentation in profile entries", async () => {
    const repoDir = await makeTempDir("gitlode-execution-repo-");
    const outputDir = await makeTempDir("gitlode-execution-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: {
        name: "Tester",
        email: "test@example.com",
        timestamp: 1_000,
        timezoneOffset: 0,
      },
    });

    const request: WorkerRunRequest = {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "commit",
        profile: true,
        gitAdapter: "isomorphic-git",
      },
      priorCheckpoint: {
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    };

    const telemetryTracer = makeTracer();
    const result = await executeWorkerRunRequest(
      request,
      {
        progressReporter: { emit(_event: ProgressEvent) {} },
        diagnosticReporter: { report() {} },
      },
      { environment: {} },
      {
        executionTracer: telemetryTracer.tracer,
        extractionTracer: telemetryTracer.tracer,
        extractionMeter: metrics.getMeter("gitlode.test.extraction"),
        ...testGitTelemetry,
      },
    );

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;

    expect(telemetryTracer.starts.map(({ name }) => name)).toEqual([
      "gitlode.run",
      "gitlode.repository.access.validate",
      "gitlode.repository.object_format.resolve",
      "gitlode.state.validate",
      "gitlode.repository.metadata.resolve",
      "gitlode.extraction.range.resolve",
      "gitlode.extract",
      "gitlode.planning",
      "gitlode.projection",
      "gitlode.traversal",
      "gitlode.output.close",
    ]);
    expect(telemetryTracer.starts.every(({ span }) => span.endCount === 1)).toBe(true);
    expect(telemetryTracer.starts.some(({ name }) => name === "gitlode.run")).toBe(true);
    const runSpan = telemetryTracer.starts.find(({ name }) => name === "gitlode.run")!.span;
    for (const start of telemetryTracer.starts.slice(1, 6)) {
      expect(trace.getSpan(start.parent!)).toBe(runSpan);
      expect(start.span.statuses).toEqual([]);
      expect(start.span.exceptions).toHaveLength(0);
    }
    expect(telemetryTracer.starts[2]!.span.attributes).toMatchObject({
      "gitlode.git.object_format": "sha1",
    });
    expect(telemetryTracer.starts[3]!.span.attributes).toMatchObject({
      "gitlode.ref.prior.count": 0,
    });
    expect(telemetryTracer.starts[4]!.span.attributes).toMatchObject({
      "gitlode.repository.name.source": "path",
      "gitlode.repository.url.source": "missing",
    });
    expect(telemetryTracer.starts[5]!.span.attributes).toMatchObject({
      "gitlode.extraction.range.kind": "none",
    });
    const serializedAttributes = JSON.stringify(
      telemetryTracer.starts.slice(1, 6).map(({ span }) => span.attributes),
    );
    expect(serializedAttributes).not.toContain("gitlode-execution");
    expect(serializedAttributes).not.toContain("fixture-repository");
    const extractSpan = telemetryTracer.starts.find(({ name }) => name === "gitlode.extract")!.span;
    for (const name of [
      "gitlode.planning",
      "gitlode.traversal",
      "gitlode.projection",
      "gitlode.output.close",
    ]) {
      const child = telemetryTracer.starts.find((start) => start.name === name)!;
      expect(trace.getSpan(child.parent!)).toBe(extractSpan);
    }
    expect(telemetryTracer.starts.filter(({ name }) => name.includes("write")).length).toBe(0);

    expect(runSpan.attributes["gitlode.git.adapter"]).toBe("isomorphic-git");
    expect(runSpan.attributes).toMatchObject({
      "gitlode.extraction.granularity": "commit",
      "gitlode.extraction.range.kind": "none",
      "gitlode.git.object_format": "sha1",
      "gitlode.run.result": "success",
      "gitlode.commit.unique.count": result.success.commitsTraversed,
      "gitlode.output.record.count": result.success.recordsWritten,
      "gitlode.output.file.count": result.success.filesCreated,
      "gitlode.output.size": result.success.bytesWritten,
    });
    expect(Object.keys(runSpan.attributes).sort()).toEqual([
      "gitlode.commit.unique.count",
      "gitlode.extraction.granularity",
      "gitlode.extraction.range.kind",
      "gitlode.git.adapter",
      "gitlode.git.object_format",
      "gitlode.output.file.count",
      "gitlode.output.record.count",
      "gitlode.output.size",
      "gitlode.run.result",
    ]);
  });

  it("writes file-level records with the git-cli adapter selected", async () => {
    const repoDir = await makeTempDir("gitlode-execution-repo-");
    const outputDir = await makeTempDir("gitlode-execution-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: {
        name: "Tester",
        email: "test@example.com",
        timestamp: 1_000,
        timezoneOffset: 0,
      },
    });

    const request: WorkerRunRequest = {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "file",
        profile: true,
        gitAdapter: "git-cli",
      },
      priorCheckpoint: {
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    };

    const result = await executeWorkerRunRequest(request, {
      progressReporter: { emit(_event: ProgressEvent) {} },
      diagnosticReporter: { report() {} },
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.success.recordsWritten).toBe(1);
    expect(result.success.skippedDiffs).toBe(0);

    const [outputFile] = await readdir(outputDir);
    const output = await readFile(join(outputDir, outputFile!), "utf8");
    const record = JSON.parse(output.trim()) as {
      readonly file: {
        readonly path: string;
        readonly status: string;
        readonly additions: number;
        readonly deletions: number;
      };
    };
    expect(record.file).toEqual({
      path: "file.txt",
      status: "added",
      additions: 1,
      deletions: 0,
    });

    const runEntry = result.success.profileReport?.spans.find(
      (entry) => entry.name === "gitlode.run",
    );
    expect(
      runEntry?.attributes.find((attribute) => attribute.key === "gitlode.git.adapter")?.value,
    ).toBe("git-cli");
  });

  it.each([false, true])(
    "wires one concrete line-diff recorder through file execution with profile=%s",
    async (profile) => {
      const repoDir = await makeTempDir("gitlode-line-diff-wiring-repo-");
      const outputDir = await makeTempDir("gitlode-line-diff-wiring-output-");
      await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
      await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
      await git.setConfig({
        fs: nodeFs,
        dir: repoDir,
        path: "user.email",
        value: "test@example.com",
      });
      await writeFile(join(repoDir, "a.txt"), "a\n");
      await writeFile(join(repoDir, "b.txt"), "bb\n");
      await git.add({ fs: nodeFs, dir: repoDir, filepath: "a.txt" });
      await git.add({ fs: nodeFs, dir: repoDir, filepath: "b.txt" });
      await git.commit({
        fs: nodeFs,
        dir: repoDir,
        message: "initial",
        author: {
          name: "Tester",
          email: "test@example.com",
          timestamp: 1_000,
          timezoneOffset: 0,
        },
      });
      const request: WorkerRunRequest = {
        input: {
          repositoryPath: repoDir as AbsolutePath,
          refs: ["main"],
          outputDir: outputDir as AbsolutePath,
          rotation: {},
          granularity: "file",
          profile,
          gitAdapter: "isomorphic-git",
        },
        priorCheckpoint: {
          generatedAt: "2026-01-01T00:00:00.000Z",
          repositoryPath: repoDir as AbsolutePath,
          refs: [],
        },
      };
      const telemetryTracer = makeTracer();
      const lineDiffMeter = new RecordingLineDiffMeter();

      const result = await executeWorkerRunRequest(
        request,
        { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
        { environment: {} },
        {
          executionTracer: telemetryTracer.tracer,
          extractionTracer: telemetryTracer.tracer,
          extractionMeter: metrics.getMeter("gitlode.test.extraction"),
          ...testGitTelemetry,
          lineDiffMeter: lineDiffMeter as unknown as Meter,
        },
      );

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;
      expect(result.success.recordsWritten).toBe(2);
      expect(result.success.skippedDiffs).toBe(0);
      expect(lineDiffMeter.creations).toEqual([
        { kind: "counter", name: "gitlode.line_diff.compute.operation" },
        { kind: "histogram", name: "gitlode.line_diff.compute.duration" },
        { kind: "histogram", name: "gitlode.line_diff.compute.input.size" },
      ]);
      const operationCalls = lineDiffMeter.calls.filter(({ name }) => name.endsWith(".operation"));
      expect(operationCalls).toEqual([
        {
          name: "gitlode.line_diff.compute.operation",
          value: 1,
          attributes: { "gitlode.line_diff.compute.outcome": "success" },
        },
        {
          name: "gitlode.line_diff.compute.operation",
          value: 1,
          attributes: { "gitlode.line_diff.compute.outcome": "success" },
        },
      ]);
      expect(
        lineDiffMeter.calls
          .filter(({ name }) => name.endsWith(".input.size"))
          .map(({ value }) => value),
      ).toEqual([2, 3]);
      expect(telemetryTracer.starts.some(({ name }) => name === "line_diff.compute")).toBe(false);

      const [outputFile] = await readdir(outputDir);
      const records = (await readFile(join(outputDir, outputFile!), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { readonly file: unknown });
      expect(records.map(({ file }) => file)).toEqual([
        { path: "a.txt", status: "added", additions: 1, deletions: 0 },
        { path: "b.txt", status: "added", additions: 1, deletions: 0 },
      ]);
    },
  );

  it("runs successfully with the git-cli adapter selected", async () => {
    const repoDir = await makeTempDir("gitlode-execution-repo-");
    const outputDir = await makeTempDir("gitlode-execution-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: {
        name: "Tester",
        email: "test@example.com",
        timestamp: 1_000,
        timezoneOffset: 0,
      },
    });

    const request: WorkerRunRequest = {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "commit",
        profile: true,
        gitAdapter: "git-cli",
      },
      priorCheckpoint: {
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    };

    const result = await executeWorkerRunRequest(request, {
      progressReporter: { emit(_event: ProgressEvent) {} },
      diagnosticReporter: { report() {} },
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.success.commitsTraversed).toBe(1);

    const runEntry = result.success.profileReport?.spans.find(
      (entry) => entry.name === "gitlode.run",
    );
    expect(
      runEntry?.attributes.find((attribute) => attribute.key === "gitlode.git.adapter")?.value,
    ).toBe("git-cli");
    expect(
      runEntry?.attributes.find((attribute) => attribute.key === "gitlode.git.cli.version")?.value,
    ).toMatch(/^git version /);
  });
});

describe("executeWorkerRunRequest commit traversal strategy environment", () => {
  async function createOneCommitRequest(
    gitAdapter: "isomorphic-git" | "git-cli" = "isomorphic-git",
  ) {
    const repoDir = await makeTempDir("gitlode-execution-strategy-repo-");
    const outputDir = await makeTempDir("gitlode-execution-strategy-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: { name: "Tester", email: "test@example.com", timestamp: 1_000, timezoneOffset: 0 },
    });

    return {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "commit" as const,
        profile: true,
        gitAdapter,
      },
      priorCheckpoint: {
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    } satisfies WorkerRunRequest;
  }

  async function runWithEnvironment(
    environment: Readonly<Record<string, string | undefined>>,
    gitAdapter: "isomorphic-git" | "git-cli" = "isomorphic-git",
  ) {
    return await executeWorkerRunRequest(
      await createOneCommitRequest(gitAdapter),
      { progressReporter: { emit(_event: ProgressEvent) {} }, diagnosticReporter: { report() {} } },
      { environment },
    );
  }

  async function runWithRecordingTelemetry(
    environment: Readonly<Record<string, string | undefined>>,
    gitAdapter: "isomorphic-git" | "git-cli" = "isomorphic-git",
  ) {
    const manager = new AsyncLocalStorageContextManager().enable();
    expect(context.setGlobalContextManager(manager)).toBe(true);
    const telemetryTracer = makeTracer();
    const metricRecorder = new RecordingGitMetricRecorder(gitAdapter);
    try {
      const result = await executeWorkerRunRequest(
        await createOneCommitRequest(gitAdapter),
        { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
        { environment },
        {
          executionTracer: telemetryTracer.tracer,
          extractionTracer: telemetryTracer.tracer,
          extractionMeter: metrics.getMeter("gitlode.test.extraction"),
          lineDiffMeter: metrics.getMeter("gitlode.test.line_diff"),
          gitTracer: telemetryTracer.tracer,
          gitMetricRecorder: metricRecorder as never,
          dagTelemetryBinding: testGitTelemetry.dagTelemetryBinding,
          rootContext: ROOT_CONTEXT,
          pluginRuntimeTracer: trace.getTracer("gitlode.test.plugin_runtime"),
          getPluginTracer: (name, version) => trace.getTracer(name, version),
          getPluginMeter: (name, version) => metrics.getMeter(name, version),
        },
      );
      return { result, telemetryTracer, metricRecorder };
    } finally {
      manager.disable();
      context.disable();
    }
  }

  it.each([
    [undefined, "certified-lazy"],
    ["phase-certified-fifo", "phase-certified-fifo"],
    ["phase-certified-timestamp", "phase-certified-timestamp"],
  ] as const)("selects %s through injected environment", async (value, outer) => {
    const environment = value === undefined ? {} : { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: value };
    const result = await runWithEnvironment(environment);

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.success.commitsTraversed).toBe(1);
  });

  it.each([
    [undefined, "certified-lazy"],
    ["phase-certified-fifo", "phase-certified-fifo"],
    ["phase-certified-timestamp", "phase-certified-timestamp"],
  ] as const)("records the actual %s strategy owner", async (value, strategy) => {
    const environment = value === undefined ? {} : { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: value };
    const { result, telemetryTracer, metricRecorder } =
      await runWithRecordingTelemetry(environment);
    expect(result.kind).toBe("success");
    const walkSpans = telemetryTracer.starts.filter(
      ({ name }) => name === "gitlode.git.commit.walk",
    );
    expect(walkSpans).toHaveLength(1);
    const walk = walkSpans[0]!;
    expect(walk.options?.attributes).toEqual({
      "gitlode.git.adapter": "isomorphic-git",
      "gitlode.git.commit.walk.strategy": strategy,
      "gitlode.git.commit.walk.has_exclusion": false,
    });
    expect(trace.getSpan(walk.parent!)).toBeDefined();
    expect(trace.getSpan(walk.parent!)).not.toBe(
      telemetryTracer.starts.find(({ name }) => name === "gitlode.run")!.span,
    );
    expect(walk.span.attributes).toEqual({
      "gitlode.stream.completion": "exhausted",
    });
    expect(walk.span.statuses).toEqual([]);
    expect(walk.span.exceptions).toHaveLength(0);
    expect(walk.span.endCount).toBe(1);
    expect(metricRecorder.calls).toEqual([
      {
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "isomorphic-git",
          "gitlode.git.commit.walk.strategy": strategy,
          "gitlode.git.commit.walk.has_exclusion": false,
        },
      },
    ]);
    expect(walk.span.endCount).toBe(1);
  });

  it("returns a user error for invalid isomorphic-git strategy environment", async () => {
    const result = await runWithEnvironment({ GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: "bad" });
    expect(result).toMatchObject({ kind: "user-error" });
    expect(result.kind === "user-error" ? result.message : "").toContain(
      "GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL",
    );
    expect(result.kind === "user-error" ? result.message : "").toContain("bad");
    expect(result.kind === "user-error" ? result.message : "").toContain("certified-lazy");
    expect(result.kind === "user-error" ? result.message : "").toContain("phase-certified-fifo");
    expect(result.kind === "user-error" ? result.message : "").toContain(
      "phase-certified-timestamp",
    );
  });

  it("does not start the isomorphic walk for an invalid strategy with actual telemetry", async () => {
    const { result, telemetryTracer, metricRecorder } = await runWithRecordingTelemetry({
      GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: "bad",
    });
    expect(result.kind).toBe("user-error");
    expect(telemetryTracer.starts.filter(({ name }) => name === "gitlode.git.commit.walk")).toEqual(
      [],
    );
    expect(metricRecorder.calls).toEqual([]);
    expect(telemetryTracer.starts.flatMap(({ span }) => span.exceptions)).toEqual([]);
  });

  it("records the ignored invalid environment on the actual Git CLI owner", async () => {
    const { result, telemetryTracer, metricRecorder } = await runWithRecordingTelemetry(
      { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: "bad" },
      "git-cli",
    );
    expect(result.kind).toBe("success");
    const walkSpans = telemetryTracer.starts.filter(
      ({ name }) => name === "gitlode.git.commit.walk",
    );
    expect(walkSpans).toHaveLength(1);
    const walk = walkSpans[0]!;
    expect(walk.options?.attributes).toEqual({
      "gitlode.git.adapter": "git-cli",
      "gitlode.git.commit.walk.strategy": "git-cli-rev-list-stream",
      "gitlode.git.commit.walk.has_exclusion": false,
    });
    expect(trace.getSpan(walk.parent!)).toBeDefined();
    expect(trace.getSpan(walk.parent!)).not.toBe(
      telemetryTracer.starts.find(({ name }) => name === "gitlode.run")!.span,
    );
    expect(walk.span.attributes).toEqual({
      "gitlode.stream.completion": "exhausted",
    });
    expect(walk.span.statuses).toEqual([]);
    expect(walk.span.exceptions).toHaveLength(0);
    expect(walk.span.endCount).toBe(1);
    expect(metricRecorder.calls).toEqual([
      {
        name: "gitlode.git.commit.yielded",
        value: 1,
        attributes: {
          "gitlode.git.adapter": "git-cli",
          "gitlode.git.commit.walk.strategy": "git-cli-rev-list-stream",
          "gitlode.git.commit.walk.has_exclusion": false,
        },
      },
    ]);
    expect(
      JSON.stringify({ spans: telemetryTracer.starts, calls: metricRecorder.calls }),
    ).not.toContain("bad");
  });

  it("ignores invalid strategy environment on the actual git-cli runtime path", async () => {
    const result = await runWithEnvironment(
      { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: "bad" },
      "git-cli",
    );

    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      expect(result.message).not.toContain("GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL");
      return;
    }

    expect(result.success.commitsTraversed).toBe(1);
    const runEntry = result.success.profileReport?.spans.find(
      (entry) => entry.name === "gitlode.run",
    );
    expect(
      runEntry?.attributes.find((attribute) => attribute.key === "gitlode.git.adapter")?.value,
    ).toBe("git-cli");
  });

  it("records typed setup failures without exception events", async () => {
    const request = await createOneCommitRequest();
    const telemetryTracer = makeTracer();
    const result = await executeWorkerRunRequest(
      {
        ...request,
        input: { ...request.input, profile: true, range: { type: "ref", since: "missing-ref" } },
      },
      { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
      { environment: {} },
      {
        executionTracer: telemetryTracer.tracer,
        extractionTracer: telemetryTracer.tracer,
        extractionMeter: metrics.getMeter("gitlode.test.extraction"),
        ...testGitTelemetry,
      },
    );

    expect(result.kind).toBe("user-error");
    expect(telemetryTracer.starts.map(({ name }) => name)).toEqual([
      "gitlode.run",
      "gitlode.repository.access.validate",
      "gitlode.repository.object_format.resolve",
      "gitlode.state.validate",
      "gitlode.repository.metadata.resolve",
      "gitlode.extraction.range.resolve",
    ]);
    const rangeSpan = telemetryTracer.starts[5]!.span;
    expect(rangeSpan.statuses).toEqual([{ code: 2 }]);
    expect(rangeSpan.exceptions).toHaveLength(0);
    expect(rangeSpan.endCount).toBe(1);
    expect(telemetryTracer.starts.slice(1, 5).every(({ span }) => span.statuses.length === 0)).toBe(
      true,
    );
    const runSpan = telemetryTracer.starts[0]!.span;
    expect(runSpan.attributes).toEqual({
      "gitlode.extraction.granularity": "commit",
      "gitlode.git.adapter": "isomorphic-git",
      "gitlode.extraction.range.kind": "ref",
      "gitlode.git.object_format": "sha1",
      "gitlode.run.result": "user_error",
    });
    expect(runSpan.statuses).toEqual([{ code: 2 }]);
    expect(runSpan.exceptions).toHaveLength(0);
    expect(runSpan.endCount).toBe(1);
  });

  it("records ordinary setup failures with the original exception", async () => {
    const request = await createOneCommitRequest();
    const telemetryTracer = makeTracer();
    await expect(
      executeWorkerRunRequest(
        {
          ...request,
          input: { ...request.input, range: { type: "date", since: "not-a-date" } as never },
        },
        { progressReporter: { emit() {} }, diagnosticReporter: { report() {} } },
        { environment: {} },
        {
          executionTracer: telemetryTracer.tracer,
          extractionTracer: telemetryTracer.tracer,
          extractionMeter: metrics.getMeter("gitlode.test.extraction"),
          ...testGitTelemetry,
        },
      ),
    ).rejects.toThrow("Invalid date format");
    const rangeSpan = telemetryTracer.starts.at(-1)!.span;
    expect(rangeSpan.statuses).toEqual([{ code: 2 }]);
    expect(rangeSpan.exceptions).toHaveLength(1);
    expect(rangeSpan.exceptions[0]).toBeInstanceOf(Error);
    expect(rangeSpan.endCount).toBe(1);
    const runSpan = telemetryTracer.starts[0]!.span;
    expect(runSpan.attributes["gitlode.run.result"]).toBe("runtime_error");
    expect(runSpan.statuses).toEqual([{ code: 2 }]);
    expect(runSpan.exceptions).toHaveLength(1);
    expect(runSpan.endCount).toBe(1);
  });
});
