import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockGitAdapterError extends Error {}

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
}

function makeParsedArgs(overrides: Record<string, unknown> = {}) {
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
    readonly parseArgs?: () => Promise<unknown>;
    readonly loadPluginConfig?: () => Promise<unknown>;
    readonly resolvePluginEntries?: () => Promise<unknown>;
    readonly checkPluginCompatibility?: (...args: unknown[]) => Promise<void>;
    readonly initializePlugins?: () => Promise<unknown[]>;
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
  const createProgressRuntime = vi.fn(() => ({
    uiMode: "tty-interactive",
    presenter,
    reporter,
  }));
  const renderSuccessReport = vi.fn();
  const coordinatorConstructed = vi.fn();

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
    supportedObjectFormats(): readonly string[] {
      return ["sha1"];
    }

    async getRepositoryObjectFormat(): Promise<string> {
      return "sha1";
    }

    async getRemoteUrl(): Promise<string> {
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

    async run(): Promise<never> {
      throw new Error("coordinator should not run in this test");
    }
  }

  vi.doMock("../../src/cli/index.js", () => ({
    createBootstrapRenderer: vi.fn(() => bootstrapRenderer),
    parseArgs:
      options.parseArgs ??
      vi.fn(async () => ({
        parsed: makeParsedArgs({
          configPath: "/repo/plugins.json",
          loadedConfig: {
            path: "/repo/plugins.json",
            directory: "/repo",
            config: {
              version: 1,
              extensions: {
                one: { entrypoint: "./one.mjs", failurePolicy: "skip-fact" },
                two: { entrypoint: "./two.mjs", failurePolicy: "skip-fact" },
              },
            },
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
    NodeStateStore: class {},
    assertSupportedRepositoryObjectFormat: vi.fn(),
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
    DefaultFactProjector: class {},
    DefaultFileChangeExpander: class {},
    DefaultTraversalPlanner: class {},
    EnrichingFactProjector: class {},
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
      constructor(_outputDir: string, _nameFactory: unknown, _rotation: unknown) {}
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

  it("renders bootstrap git adapter errors before creating the progress runtime", async () => {
    const context = mockEntrypointModules({
      parseArgs: vi.fn(async () => {
        throw new MockGitAdapterError("bootstrap failed");
      }),
    });

    await importEntrypointAsCli();

    await vi.waitFor(() => {
      expect(context.bootstrapRenderer.renderUserError).toHaveBeenCalledWith("bootstrap failed");
    });
    expect(context.createProgressRuntime).not.toHaveBeenCalled();
    expect(context.presenter.renderUserError).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
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
});
