import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockGitAdapterError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "MockGitAdapterError";
    this.code = code;
  }
}

const entrypointPath = fileURLToPath(new URL("../../src/index.ts", import.meta.url));

interface MockContext {
  readonly bootstrapRenderer: {
    renderTermination: ReturnType<typeof vi.fn>;
    renderRuntimeError: ReturnType<typeof vi.fn>;
  };
  readonly presenter: {
    renderDiagnostic: ReturnType<typeof vi.fn>;
    renderUserError: ReturnType<typeof vi.fn>;
    renderRuntimeError: ReturnType<typeof vi.fn>;
  };
  readonly reporter: {
    emit: ReturnType<typeof vi.fn>;
  };
  readonly createProgressRuntime: ReturnType<typeof vi.fn>;
  readonly renderSuccessReport: ReturnType<typeof vi.fn>;
  readonly dispatchWorkerRunRequest: ReturnType<typeof vi.fn>;
  readonly loadPriorState: ReturnType<typeof vi.fn>;
  readonly getStateStoreWrites: () => unknown[];
  readonly getSideEffects: () => string[];
}

function makeBootstrapInput(overrides: Record<string, unknown> = {}) {
  return {
    repositoryPath: "/repo",
    refs: ["main"],
    outputDir: "/out",
    outputPrefix: "repo",
    rotation: {},
    incremental: false,
    missingState: "error",
    range: undefined,
    stateFilePath: undefined,
    perFile: false,
    quiet: false,
    profile: false,
    maxDiffSize: undefined,
    repoName: undefined,
    repoUrl: undefined,
    configPath: undefined,
    extensions: undefined,
    ...overrides,
  };
}

function mockEntrypointModules(
  options: {
    readonly loadBootstrapInput?: () => Promise<unknown>;
    readonly loadPriorState?: () => Promise<unknown>;
    readonly workerResult?: () => Promise<unknown>;
    readonly objectFormat?: string;
  } = {},
): MockContext {
  const bootstrapRenderer = {
    renderTermination: vi.fn(),
    renderRuntimeError: vi.fn(),
  };

  const presenter = {
    renderDiagnostic: vi.fn(),
    renderUserError: vi.fn(),
    renderRuntimeError: vi.fn(),
  };

  const reporter = {
    emit: vi.fn(),
  };

  const sideEffects: string[] = [];
  const stateStoreWrites: unknown[] = [];

  const createProgressRuntime = vi.fn(() => ({
    uiMode: "tty-interactive",
    presenter,
    reporter,
  }));

  const renderSuccessReport = vi.fn(() => {
    sideEffects.push("success-report");
  });

  const loadPriorState =
    options.loadPriorState ??
    vi.fn(async () => ({
      version: 2,
      generatedAt: "",
      repositoryPath: "/repo",
      refs: [],
    }));

  const dispatchWorkerRunRequest =
    options.workerResult ??
    vi.fn(async () => ({
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
        refs: [{ ref: "main", refType: "branch", tipOid: "abc123", updatedAt: "now" }],
      },
    }));

  vi.doMock("../../src/cli/index.js", () => ({
    loadBootstrapInput:
      options.loadBootstrapInput ??
      vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput(),
      })),
  }));

  vi.doMock("../../src/presentation/index.js", () => ({
    createBootstrapRenderer: vi.fn(() => bootstrapRenderer),
  }));

  vi.doMock("../../src/presentation/progress/index.js", () => ({
    createStyling: vi.fn(() => ({ style: "plain" })),
  }));

  vi.doMock("../../src/cli/runtime/index.js", () => ({
    createProgressRuntime,
    renderSuccessReport,
    loadPriorState,
    NodeStateStore: class {
      async write(state: unknown): Promise<void> {
        sideEffects.push("state-write");
        stateStoreWrites.push(state);
      }
    },
    assertSupportedRepositoryObjectFormat: vi.fn(),
  }));

  vi.doMock("../../src/cli/runtime/progress-runtime.js", () => ({
    stderrSink: {
      writeLine() {},
      rewriteLine() {},
      newline() {},
    },
  }));

  vi.doMock("../../src/git/index.js", () => ({
    GitAdapterError: MockGitAdapterError,
  }));

  vi.doMock("../../src/git-impl/index.js", () => ({
    IsomorphicGitAdapter: class {
      supportedObjectFormats(): readonly string[] {
        return ["sha1"];
      }
      async getRepositoryObjectFormat(): Promise<string> {
        return options.objectFormat ?? "sha1";
      }
    },
    JsDiffAdapter: class {},
  }));

  vi.doMock("../../src/runtime/index.js", () => ({
    dispatchWorkerRunRequest,
  }));

  return {
    bootstrapRenderer,
    presenter,
    reporter,
    createProgressRuntime,
    renderSuccessReport,
    dispatchWorkerRunRequest,
    loadPriorState,
    getStateStoreWrites: () => stateStoreWrites,
    getSideEffects: () => sideEffects,
  };
}

async function importEntrypointAsCli(): Promise<void> {
  process.argv[1] = entrypointPath;
  await import("../../src/index.js");
}

describe("CLI entrypoint orchestration", () => {
  const originalArgv = [...process.argv];
  const originalExitCode = process.exitCode;
  const originalIsTTY = process.stderr.isTTY;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.argv = [...originalArgv];
    process.exitCode = undefined;
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.argv = [...originalArgv];
    process.exitCode = originalExitCode;
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: originalIsTTY,
    });
  });

  it("renders bootstrap runtime errors before creating the progress runtime", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => {
        throw new Error("bootstrap failed");
      }),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.bootstrapRenderer.renderRuntimeError).toHaveBeenCalled();
    });
    expect(context.createProgressRuntime).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it("renders worker user-error through the progress presenter", async () => {
    const context = mockEntrypointModules({
      workerResult: vi.fn(async () => ({
        kind: "user-error",
        message: "Ref not found: missing-ref",
      })),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.presenter.renderUserError).toHaveBeenCalledWith("Ref not found: missing-ref");
    });
    expect(context.renderSuccessReport).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("renders worker runtime-error and exits with code 2", async () => {
    const context = mockEntrypointModules({
      workerResult: vi.fn(async () => ({
        kind: "runtime-error",
        message: "worker crashed",
        stack: "stack-trace",
      })),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.presenter.renderRuntimeError).toHaveBeenCalled();
    });
    expect(context.renderSuccessReport).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it("writes returned state before rendering success report when state file is configured", async () => {
    const returnedState = {
      version: 2 as const,
      generatedAt: "2026-01-01T00:00:00.000Z",
      repositoryPath: "/repo",
      refs: [{ ref: "main", refType: "branch", tipOid: "abc123", updatedAt: "now" }],
    };

    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          stateFilePath: "/tmp/gitlode-state.json",
          incremental: true,
        }),
      })),
      workerResult: vi.fn(async () => ({
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
        state: returnedState,
      })),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.renderSuccessReport).toHaveBeenCalledTimes(1);
    });
    expect(context.loadPriorState).toHaveBeenCalledTimes(1);
    expect(context.getStateStoreWrites()).toEqual([returnedState]);
    expect(context.getSideEffects()).toEqual(["state-write", "success-report"]);
    expect(process.exitCode).toBeUndefined();
  });
});
