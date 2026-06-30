import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerRunRequest, WorkerRunResult } from "../../src/runtime/types.js";

interface TestWorker extends EventEmitter {
  readonly postMessage: ReturnType<typeof vi.fn>;
  readonly terminate: ReturnType<typeof vi.fn>;
}

const { workers } = vi.hoisted(() => ({
  workers: [] as TestWorker[],
}));

vi.mock("node:worker_threads", () => ({
  Worker: class MockWorker extends EventEmitter {
    readonly postMessage = vi.fn();
    readonly terminate = vi.fn(async () => 0);

    constructor(_specifier: URL) {
      super();
      workers.push(this as TestWorker);
    }
  },
}));

import { dispatchWorkerRunRequest } from "../../src/runtime/client.js";

function makeRequest(): WorkerRunRequest {
  return {
    input: {
      repositoryPath: "/repo",
      refs: ["main"],
      outputDir: "/out",
      rotation: {},
      perFile: false,
      profile: false,
      gitAdapter: "isomorphic-git",
    },
    priorState: {
      version: 2,
      generatedAt: "",
      repositoryPath: "/repo",
      refs: [],
    },
  };
}

function successResult(): WorkerRunResult {
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
    state: {
      version: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      repositoryPath: "/repo",
      refs: [],
    },
  };
}

function lastWorker(): TestWorker {
  const worker = workers.at(-1);
  if (worker === undefined) {
    throw new Error("Expected worker instance to be created");
  }
  return worker;
}

describe("dispatchWorkerRunRequest", () => {
  beforeEach(() => {
    workers.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    workers.length = 0;
  });

  it("forwards progress/diagnostic messages and resolves with result", async () => {
    const onProgress = vi.fn();
    const onDiagnostic = vi.fn();

    const promise = dispatchWorkerRunRequest(makeRequest(), {
      onProgress,
      onDiagnostic,
    });

    const worker = lastWorker();

    worker.emit("message", {
      type: "progress",
      event: { type: "phase-start", phase: "preparing" },
    });
    worker.emit("message", {
      type: "diagnostic",
      severity: "warn",
      message: "warning",
    });

    const expected = successResult();
    worker.emit("message", {
      type: "result",
      result: expected,
    });

    await expect(promise).resolves.toEqual(expected);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith("warn", "warning");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("returns runtime-error when worker sends invalid payload", async () => {
    const promise = dispatchWorkerRunRequest(makeRequest(), {
      onProgress: vi.fn(),
      onDiagnostic: vi.fn(),
    });

    const worker = lastWorker();
    worker.emit("message", { invalid: true });

    await expect(promise).resolves.toEqual({
      kind: "runtime-error",
      message: "Worker sent an invalid message payload.",
      stack: undefined,
    });
  });

  it("returns runtime-error when worker emits error", async () => {
    const promise = dispatchWorkerRunRequest(makeRequest(), {
      onProgress: vi.fn(),
      onDiagnostic: vi.fn(),
    });

    const worker = lastWorker();
    worker.emit("error", new Error("boom"));

    await expect(promise).resolves.toMatchObject({
      kind: "runtime-error",
      message: "boom",
    });
  });

  it("returns runtime-error when worker exits non-zero before result", async () => {
    const promise = dispatchWorkerRunRequest(makeRequest(), {
      onProgress: vi.fn(),
      onDiagnostic: vi.fn(),
    });

    const worker = lastWorker();
    worker.emit("exit", 2);

    await expect(promise).resolves.toEqual({
      kind: "runtime-error",
      message: "Worker exited unexpectedly with code 2.",
      stack: undefined,
    });
  });

  it("returns runtime-error when worker exits zero without result", async () => {
    const promise = dispatchWorkerRunRequest(makeRequest(), {
      onProgress: vi.fn(),
      onDiagnostic: vi.fn(),
    });

    const worker = lastWorker();
    worker.emit("exit", 0);

    await expect(promise).resolves.toEqual({
      kind: "runtime-error",
      message: "Worker exited without returning a result message.",
      stack: undefined,
    });
  });
});
