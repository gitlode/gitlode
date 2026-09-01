import nodeFs from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProgressEvent } from "@gitlode/internal-contracts/progress";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import { ROOT_CONTEXT, metrics, trace } from "@opentelemetry/api";
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
            profileEntries: [],
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
            profileEntries: [],
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
        rootContext: (await import("@opentelemetry/api")).ROOT_CONTEXT,
      },
    );

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;

    expect(telemetryTracer.starts.map(({ name }) => name)).toEqual([
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
    expect(telemetryTracer.starts.some(({ name }) => name === "gitlode.run")).toBe(false);
    for (const start of telemetryTracer.starts.slice(0, 5)) {
      expect(start.parent).toBe(ROOT_CONTEXT);
      expect(start.span.statuses).toEqual([]);
      expect(start.span.exceptions).toHaveLength(0);
    }
    expect(telemetryTracer.starts[1]!.span.attributes).toMatchObject({
      "gitlode.git.object_format": "sha1",
    });
    expect(telemetryTracer.starts[2]!.span.attributes).toMatchObject({
      "gitlode.ref.prior.count": 0,
    });
    expect(telemetryTracer.starts[3]!.span.attributes).toMatchObject({
      "gitlode.repository.name.source": "path",
      "gitlode.repository.url.source": "missing",
    });
    expect(telemetryTracer.starts[4]!.span.attributes).toMatchObject({
      "gitlode.extraction.range.kind": "none",
    });
    const serializedAttributes = JSON.stringify(
      telemetryTracer.starts.slice(0, 5).map(({ span }) => span.attributes),
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

    const walkEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.walk_commits",
    );
    expect(walkEntry?.totalMs).toBeGreaterThan(0);
    expect(walkEntry?.attributes).toEqual({ strategy: ["certified-lazy"] });
    expect(walkEntry?.counters).toEqual({
      commit_reads: 1,
      commits_yielded: 1,
      materialize_commit_reads: 1,
      topology_commit_cache_hits: 1,
    });

    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["isomorphic-git"]);
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

    const fileBlobBatchEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.cli.file_blob_batch",
    );
    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["git-cli"]);
    expect(fileBlobBatchEntry?.calls).toBe(1);
    expect(fileBlobBatchEntry?.counters).toEqual({ blob_bytes: 6, objects_read: 1 });
  });

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

    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["git-cli"]);
    expect(runEntry?.attributes?.["git.cli.version"]?.[0]).toMatch(/^git version /);
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

  it.each([
    [undefined, "certified-lazy"],
    ["phase-certified-fifo", "phase-certified-fifo"],
    ["phase-certified-timestamp", "phase-certified-timestamp"],
  ] as const)("selects %s through injected environment", async (value, outer) => {
    const environment = value === undefined ? {} : { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: value };
    const result = await runWithEnvironment(environment);

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    const walkEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.walk_commits",
    );
    expect(walkEntry?.attributes?.strategy).toEqual([outer]);
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

    expect(result.success.profileEntries.some((entry) => entry.name === "git.cli.rev_list")).toBe(
      true,
    );
    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["git-cli"]);
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
        rootContext: ROOT_CONTEXT,
      },
    );

    expect(result.kind).toBe("user-error");
    expect(telemetryTracer.starts.map(({ name }) => name)).toEqual([
      "gitlode.repository.access.validate",
      "gitlode.repository.object_format.resolve",
      "gitlode.state.validate",
      "gitlode.repository.metadata.resolve",
      "gitlode.extraction.range.resolve",
    ]);
    const rangeSpan = telemetryTracer.starts[4]!.span;
    expect(rangeSpan.statuses).toEqual([{ code: 2 }]);
    expect(rangeSpan.exceptions).toHaveLength(0);
    expect(rangeSpan.endCount).toBe(1);
    expect(telemetryTracer.starts.slice(0, 4).every(({ span }) => span.statuses.length === 0)).toBe(
      true,
    );
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
          rootContext: ROOT_CONTEXT,
        },
      ),
    ).rejects.toThrow("Invalid date format");
    const rangeSpan = telemetryTracer.starts.at(-1)!.span;
    expect(rangeSpan.statuses).toEqual([{ code: 2 }]);
    expect(rangeSpan.exceptions).toHaveLength(1);
    expect(rangeSpan.exceptions[0]).toBeInstanceOf(Error);
    expect(rangeSpan.endCount).toBe(1);
  });
});
