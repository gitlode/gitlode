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
    renderUserError: ReturnType<typeof vi.fn>;
    renderRuntimeError: ReturnType<typeof vi.fn>;
  };
  readonly presenter: {
    handleProgressEvent: ReturnType<typeof vi.fn>;
    renderDiagnostic: ReturnType<typeof vi.fn>;
    renderUserError: ReturnType<typeof vi.fn>;
    renderRuntimeError: ReturnType<typeof vi.fn>;
    renderSummary: ReturnType<typeof vi.fn>;
    renderProfile: ReturnType<typeof vi.fn>;
  };
  readonly reporter: {
    emit: ReturnType<typeof vi.fn>;
  };
  readonly createProgressRuntime: ReturnType<typeof vi.fn>;
  readonly renderSuccessReport: ReturnType<typeof vi.fn>;
  readonly coordinatorConstructed: ReturnType<typeof vi.fn>;
  readonly getOutputFileNameSample: () => string | undefined;
  readonly getDefaultFactProjectorConstructedCount: () => number;
  readonly getEnrichingFactProjectorConstructedCount: () => number;
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
    ...overrides,
  };
}

function mockEntrypointModules(
  options: {
    readonly loadBootstrapInput?: () => Promise<unknown>;
    readonly loadPluginConfig?: () => Promise<unknown>;
    readonly resolvePluginEntries?: () => Promise<unknown>;
    readonly checkPluginCompatibility?: (...args: unknown[]) => Promise<void>;
    readonly initializePlugins?: () => Promise<unknown[]>;
    readonly resolveRef?: (repoPath: string, ref: string) => Promise<string>;
    readonly getRemoteUrl?: (repoPath: string) => Promise<string | null>;
    readonly assertSupportedRepositoryObjectFormat?: (...args: unknown[]) => void;
    readonly coordinatorRunResult?: () => Promise<{
      recordsWritten: number;
      commitsTraversed: number;
      refs: string[];
      state: {
        version: 2;
        generatedAt: string;
        repositoryPath: string;
        refs: unknown[];
      };
      skippedDiffs: number;
    }>;
  } = {},
): MockContext {
  const bootstrapRenderer = {
    renderTermination: vi.fn(),
    renderUserError: vi.fn(),
    renderRuntimeError: vi.fn(),
  };
  const presenter = {
    handleProgressEvent: vi.fn(),
    renderDiagnostic: vi.fn(),
    renderUserError: vi.fn(),
    renderRuntimeError: vi.fn(),
    renderSummary: vi.fn(),
    renderProfile: vi.fn(),
  };
  const reporter = {
    emit: vi.fn(),
  };
  const sideEffects: string[] = [];
  const createProgressRuntime = vi.fn(() => ({
    uiMode: "tty-interactive",
    presenter,
    reporter,
  }));
  const renderSuccessReport = vi.fn(() => {
    sideEffects.push("success-report");
  });
  const coordinatorConstructed = vi.fn();
  const stateStoreWrites: unknown[] = [];
  let outputFileNameSample: string | undefined;
  let defaultFactProjectorConstructedCount = 0;
  let enrichingFactProjectorConstructedCount = 0;

  class MockProfiler {
    start(): void {}
    stop(): void {}
    createScopedProfiler(): MockProfiler {
      return new MockProfiler();
    }
    entries() {
      return [];
    }
  }

  class MockGitAdapter {
    async resolveRef(repoPath: string, ref: string): Promise<string> {
      if (options.resolveRef) {
        return options.resolveRef(repoPath, ref);
      }
      return "abc123def456abc123def456abc123def456abc123";
    }

    supportedObjectFormats(): readonly string[] {
      return ["sha1"];
    }

    async getRepositoryObjectFormat(): Promise<string> {
      return "sha1";
    }

    async getRemoteUrl(repoPath: string): Promise<string | null> {
      if (options.getRemoteUrl) {
        return options.getRemoteUrl(repoPath);
      }
      return "https://example.com/org/repo.git";
    }
  }

  class MockOutputWriterSink {
    readonly filesCreated = 0;
    readonly bytesWritten = 0;

    constructor(_writer: unknown) {}
  }

  class MockCoordinator {
    constructor(_deps: unknown) {
      coordinatorConstructed();
    }

    async run(): Promise<
      | never
      | {
          recordsWritten: number;
          commitsTraversed: number;
          refs: string[];
          state: {
            version: 2;
            generatedAt: string;
            repositoryPath: string;
            refs: unknown[];
          };
          skippedDiffs: number;
        }
    > {
      if (options.coordinatorRunResult) {
        return options.coordinatorRunResult();
      }
      throw new Error("coordinator should not run in this test");
    }
  }

  vi.doMock("../../src/cli/index.js", () => ({
    createBootstrapRenderer: vi.fn(() => bootstrapRenderer),
    loadBootstrapInput:
      options.loadBootstrapInput ??
      vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          configPath: "/repo/plugins.json",
          extensions: {
            one: { entrypoint: "./one.mjs", failurePolicy: "skip-fact" },
            two: { entrypoint: "./two.mjs", failurePolicy: "skip-fact" },
          },
        }),
      })),
  }));

  vi.doMock("../../src/cli/plugins.js", () => ({
    loadPluginConfig:
      options.loadPluginConfig ??
      vi.fn(async () => ({ kind: "loaded", config: { version: 1, extensions: {} } })),
    resolvePluginEntries:
      options.resolvePluginEntries ??
      vi.fn(async () => ({
        kind: "resolved",
        entries: [{ namespace: "one" }, { namespace: "two" }],
      })),
    checkPluginCompatibility: options.checkPluginCompatibility ?? vi.fn(async () => {}),
    initializePlugins:
      options.initializePlugins ??
      vi.fn(async () => [
        {
          entry: { namespace: "one" },
          result: { type: "fatal", message: "one failed" },
        },
        {
          entry: { namespace: "two" },
          result: { type: "fatal", message: "two failed" },
        },
      ]),
  }));

  vi.doMock("../../src/cli/progress/index.js", () => ({
    createStyling: vi.fn(() => ({ style: "plain" })),
  }));

  vi.doMock("../../src/cli/runtime/index.js", () => ({
    createProgressRuntime,
    renderSuccessReport,
    NodeStateStore: class {
      async write(state: unknown): Promise<void> {
        sideEffects.push("state-write");
        stateStoreWrites.push(state);
      }
    },
    assertSupportedRepositoryObjectFormat: options.assertSupportedRepositoryObjectFormat ?? vi.fn(),
    deriveRepoName: vi.fn(() => "repo"),
    loadPriorState: vi.fn(async () => ({
      version: 2,
      generatedAt: "",
      repositoryPath: "/repo",
      refs: [],
    })),
  }));

  vi.doMock("../../src/cli/runtime/progress-runtime.js", () => ({
    stderrSink: {
      writeLine() {},
      rewriteLine() {},
      newline() {},
    },
  }));

  vi.doMock("../../src/core/index.js", () => ({
    DefaultCommitTraversalExtractor: class {},
    DefaultExtractionCoordinator: MockCoordinator,
    DefaultFactProjector: class {
      constructor(..._args: unknown[]) {
        defaultFactProjectorConstructedCount += 1;
      }
    },
    DefaultFileChangeExpander: class {},
    DefaultTraversalPlanner: class {},
    EnrichingFactProjector: class {
      constructor(..._args: unknown[]) {
        enrichingFactProjectorConstructedCount += 1;
      }
    },
  }));

  vi.doMock("../../src/core/profile/index.js", () => ({
    DefaultStageProfiler: MockProfiler,
  }));

  vi.doMock("../../src/git/index.js", () => ({
    GitAdapterError: MockGitAdapterError,
    IsomorphicGitAdapter: MockGitAdapter,
    JsDiffAdapter: class {},
  }));

  vi.doMock("../../src/output/index.js", () => ({
    OutputWriter: class {
      constructor(_outputDir: string, nameFactory: (seq: number) => string, _rotation: unknown) {
        outputFileNameSample = nameFactory(1);
      }
    },
    OutputWriterSink: MockOutputWriterSink,
    formatSessionTimestamp: vi.fn(() => "20260101T000000Z"),
  }));

  return {
    bootstrapRenderer,
    presenter,
    reporter,
    createProgressRuntime,
    renderSuccessReport,
    coordinatorConstructed,
    getOutputFileNameSample: () => outputFileNameSample,
    getDefaultFactProjectorConstructedCount: () => defaultFactProjectorConstructedCount,
    getEnrichingFactProjectorConstructedCount: () => enrichingFactProjectorConstructedCount,
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
    expect(context.presenter.renderUserError).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it("aggregates plugin init fatal failures through the progress presenter and stops before extraction", async () => {
    const context = mockEntrypointModules();

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.presenter.renderUserError).toHaveBeenCalledWith(
        'Plugin "one" init failed: one failed\nPlugin "two" init failed: two failed',
      );
    });
    expect(context.bootstrapRenderer.renderUserError).not.toHaveBeenCalled();
    expect(context.reporter.emit).toHaveBeenCalledWith({
      type: "phase-start",
      phase: "initializing-plugins",
    });
    expect(context.reporter.emit).not.toHaveBeenCalledWith({
      type: "phase-end",
      phase: "initializing-plugins",
    });
    expect(context.coordinatorConstructed).not.toHaveBeenCalled();
    expect(context.renderSuccessReport).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("renders presenter user-error when since-ref resolution fails after bootstrap", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          outputPrefix: undefined,
          configPath: undefined,
          extensions: undefined,
          range: { type: "ref", sinceRef: "missing-ref" },
        }),
      })),
      resolveRef: vi.fn(async (_repoPath, ref) => {
        if (ref === "missing-ref") {
          throw new MockGitAdapterError("Ref not found", "REF_NOT_FOUND");
        }
        return "abc123def456abc123def456abc123def456abc123";
      }),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.presenter.renderUserError).toHaveBeenCalledWith("Ref not found: missing-ref");
    });
    expect(context.bootstrapRenderer.renderUserError).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("derives output prefix in orchestration when bootstrap input has no explicit prefix", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          outputPrefix: undefined,
          configPath: undefined,
          extensions: undefined,
        }),
      })),
      getRemoteUrl: vi.fn(async () => "https://example.com/acme/derived-name.git"),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.getOutputFileNameSample()).toBe("derived-name-20260101T000000Z-000001.jsonl");
    });
  });

  it("renders presenter user-error when repository is not a git repository after bootstrap", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          configPath: undefined,
          extensions: undefined,
          range: undefined,
        }),
      })),
      resolveRef: vi.fn(async () => {
        throw new MockGitAdapterError("not a repo", "NOT_A_REPOSITORY");
      }),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.presenter.renderUserError).toHaveBeenCalledWith("Not a Git repository: /repo");
    });
    expect(context.bootstrapRenderer.renderUserError).not.toHaveBeenCalled();
    expect(context.createProgressRuntime).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("continues orchestration when first ref is missing during repository access check", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          outputPrefix: undefined,
          configPath: undefined,
          extensions: undefined,
          range: undefined,
        }),
      })),
      resolveRef: vi.fn(async () => {
        throw new MockGitAdapterError("ref missing", "REF_NOT_FOUND");
      }),
      getRemoteUrl: vi.fn(async () => "https://example.com/acme/ref-missing-continues.git"),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.getOutputFileNameSample()).toBe(
        "ref-missing-continues-20260101T000000Z-000001.jsonl",
      );
    });
    expect(context.presenter.renderUserError).not.toHaveBeenCalled();
  });

  it("renders presenter user-error when repository object format is unsupported", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          configPath: undefined,
          extensions: undefined,
        }),
      })),
      assertSupportedRepositoryObjectFormat: vi.fn(() => {
        throw new MockGitAdapterError(
          "Unsupported repository object format: sha256. Supported formats: sha1.",
          "UNSUPPORTED_OBJECT_FORMAT",
        );
      }),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.presenter.renderUserError).toHaveBeenCalledWith(
        "Unsupported repository object format: sha256. Supported formats: sha1.",
      );
    });
    expect(context.coordinatorConstructed).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("uses DefaultFactProjector and renders success report when plugins are not configured", async () => {
    const context = mockEntrypointModules({
      loadBootstrapInput: vi.fn(async () => ({
        kind: "success",
        value: makeBootstrapInput({
          configPath: undefined,
          extensions: undefined,
        }),
      })),
      coordinatorRunResult: vi.fn(async () => ({
        recordsWritten: 3,
        commitsTraversed: 2,
        refs: ["main"],
        state: {
          version: 2,
          generatedAt: "2026-01-01T00:00:00.000Z",
          repositoryPath: "/repo",
          refs: [{ ref: "main", refType: "branch", tipOid: "abc123", updatedAt: "now" }],
        },
        skippedDiffs: 0,
      })),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.renderSuccessReport).toHaveBeenCalledTimes(1);
    });
    expect(context.getDefaultFactProjectorConstructedCount()).toBe(1);
    expect(context.getEnrichingFactProjectorConstructedCount()).toBe(0);
    expect(context.presenter.renderUserError).not.toHaveBeenCalled();
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
          configPath: undefined,
          extensions: undefined,
          stateFilePath: "/tmp/gitlode-state.json",
        }),
      })),
      coordinatorRunResult: vi.fn(async () => ({
        recordsWritten: 1,
        commitsTraversed: 1,
        refs: ["main"],
        state: returnedState,
        skippedDiffs: 0,
      })),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.renderSuccessReport).toHaveBeenCalledTimes(1);
    });
    expect(context.getStateStoreWrites()).toEqual([returnedState]);
    expect(context.getSideEffects()).toEqual(["state-write", "success-report"]);
    expect(process.exitCode).toBeUndefined();
  });
});
