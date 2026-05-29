#!/usr/bin/env node
import nodeFs from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { ParsedArgs } from "./cli/args.js";
import { createBootstrapRenderer, createRunPresenter, parseArgs } from "./cli/index.js";
import {
  loadPluginConfig,
  resolvePluginEntries,
  checkPluginCompatibility,
  initializePlugins,
} from "./cli/plugins.js";
import { resolveUiMode, createStyling } from "./cli/progress/index.js";
import type { TerminalSink } from "./cli/progress/index.js";
import {
  DefaultTraversalPlanner,
  DefaultCommitTraversalExtractor,
  DefaultExtractionCoordinator,
  DefaultFactProjector,
  DefaultFileChangeExpander,
  EnrichingFactProjector,
  isCommitOidForProfile,
  REF_TYPES,
} from "./core/index.js";
import type {
  CoordinatorDependencies,
  DiagnosticReporter,
  ExtractionState,
  FactProjector,
  OidProfile,
  ProgressReporter,
  RefType,
  StageProfiler,
  StateStore,
} from "./core/index.js";
import { DefaultStageProfiler } from "./core/profile/index.js";
import {
  GitAdapterError,
  IsomorphicGitAdapter,
  JsDiffAdapter,
  type RepositoryObjectFormat,
} from "./git/index.js";
import { OutputWriter, formatSessionTimestamp, OutputWriterSink } from "./output/index.js";

export function assertSupportedRepositoryObjectFormat(
  format: RepositoryObjectFormat,
  supportedFormats: readonly OidProfile[],
): asserts format is OidProfile {
  if (supportedFormats.includes(format as OidProfile)) {
    return;
  }

  const supportedList = supportedFormats.join(", ");
  throw new GitAdapterError(
    `Unsupported repository object format: ${format}. Supported formats: ${supportedList}.`,
    "UNSUPPORTED_OBJECT_FORMAT",
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveRepoName(remoteUrl: string | null, repoPath: string): string {
  if (remoteUrl) {
    const lastSegment = remoteUrl.split("/").pop() ?? "";
    const stripped = lastSegment.replace(/\.git$/, "");
    return stripped || basename(repoPath);
  }
  return basename(repoPath);
}

function emptyState(repositoryPath: string): ExtractionState {
  return { version: 2, generatedAt: "", repositoryPath, refs: [] };
}

function isRefType(value: unknown): value is RefType {
  return typeof value === "string" && REF_TYPES.includes(value as RefType);
}

export async function loadPriorState(
  stateStore: StateStore | undefined,
  parsed: ParsedArgs,
  repoPath: string,
  oidProfile: OidProfile,
  reporter: ProgressReporter,
): Promise<ExtractionState> {
  if (!stateStore || !parsed.incremental) {
    return emptyState(repoPath);
  }
  const state = await stateStore.read();
  if (state === null) {
    if (parsed.missingState === "snapshot") {
      reporter.emit({
        type: "warning",
        message: `State file not found: ${parsed.stateFilePath}. Falling back to full snapshot extraction.`,
      });
      return emptyState(repoPath);
    }
    return emptyState(repoPath);
  }
  if (state.version !== 2) {
    throw new Error(
      `Unsupported state file version: ${state.version}. Supported version: 2. Reinitialize the state file (for example, run without --incremental once with --state).`,
    );
  }
  const recordedPath = resolve(state.repositoryPath);
  if (recordedPath !== repoPath) {
    throw new Error(`State file was created for a different repository: ${state.repositoryPath}`);
  }
  for (const entry of state.refs) {
    if (!isRefType(entry.refType)) {
      throw new Error(
        `Invalid ref type in state file for ref "${entry.ref}": ${String(entry.refType)}`,
      );
    }
    if (!isCommitOidForProfile(entry.tipOid, oidProfile)) {
      throw new Error(`Invalid commit OID in state file for ref "${entry.ref}": ${entry.tipOid}`);
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// NodeStateStore
// ---------------------------------------------------------------------------

class NodeStateStore implements StateStore {
  private readonly stateFilePath: string;
  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
  }

  async read(): Promise<ExtractionState | null> {
    const { readFile } = await import("node:fs/promises");
    try {
      const raw = await readFile(this.stateFilePath, "utf8");
      return JSON.parse(raw) as ExtractionState;
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return null;
      }
      throw err;
    }
  }

  async write(state: ExtractionState): Promise<void> {
    const tmpPath = `${this.stateFilePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, this.stateFilePath);
  }
}

// ---------------------------------------------------------------------------
// Stderr terminal sink
// ---------------------------------------------------------------------------

function writeStderrLine(text: string): void {
  process.stderr.write(text + "\n");
}

function createNamespacedDiagnosticReporter(
  namespace: string,
  presenter: { renderDiagnostic(severity: "warn" | "error", message: string): void },
): DiagnosticReporter {
  return {
    warn(message) {
      presenter.renderDiagnostic("warn", `Plugin "${namespace}": ${message}`);
    },
    error(message) {
      presenter.renderDiagnostic("error", `Plugin "${namespace}": ${message}`);
    },
  };
}

function formatPluginInitializationFailure(entry: {
  entry: { namespace: string };
  result: { type: "fatal"; message: string };
}): string {
  return `Plugin "${entry.entry.namespace}" init failed: ${entry.result.message}`;
}

const stderrSink: TerminalSink = {
  writeLine: writeStderrLine,
  rewriteLine(text: string): void {
    process.stderr.write("\r\x1B[2K" + text);
  },
  newline(): void {
    process.stderr.write("\n");
  },
};

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

async function main() {
  const adapter = new IsomorphicGitAdapter(nodeFs, new JsDiffAdapter());
  const isTTY = process.stderr.isTTY === true;
  const styling = createStyling(isTTY);
  const bootstrapRenderer = createBootstrapRenderer(writeStderrLine);
  let parsed: ParsedArgs;
  try {
    const parseResult = await parseArgs(adapter);
    if (parseResult.kind === "termination") {
      bootstrapRenderer.renderTermination(parseResult.termination);
      process.exitCode = parseResult.termination.exitCode;
      return;
    }
    parsed = parseResult.parsed;
  } catch (e) {
    if (e instanceof GitAdapterError) {
      bootstrapRenderer.renderUserError(e.message);
      process.exitCode = 1;
      return;
    }
    bootstrapRenderer.renderRuntimeError(
      e instanceof Error ? e : new Error(typeof e === "string" ? e : String(e)),
    );
    process.exitCode = 2;
    return;
  }

  const uiMode = resolveUiMode(parsed.quiet, isTTY);
  const presenter = createRunPresenter({
    sink: stderrSink,
    clock: { nowMs: () => performance.now() },
    scheduler: {
      setInterval(fn, ms) {
        const id = setInterval(fn, ms);
        return () => clearInterval(id);
      },
    },
    uiMode,
    styling,
  });

  try {
    const { quiet, profile } = parsed;

    // Build ProgressReporter based on uiMode.
    const reporter: ProgressReporter = { emit: (event) => presenter.handleProgressEvent(event) };

    const stateStore = parsed.stateFilePath ? new NodeStateStore(parsed.stateFilePath) : undefined;

    const repoPath = resolve(parsed.repositoryPath);
    const startMs = performance.now();

    const supportedObjectFormats = adapter.supportedObjectFormats();
    const repositoryObjectFormat = await adapter.getRepositoryObjectFormat(repoPath);
    assertSupportedRepositoryObjectFormat(repositoryObjectFormat, supportedObjectFormats);

    const remoteUrl = await adapter.getRemoteUrl(repoPath);
    const repoName = deriveRepoName(remoteUrl, repoPath);

    const rootProfiler = new DefaultStageProfiler("elapsed", () => performance.now());
    rootProfiler.start();

    if (profile) {
      const gitProfiler = rootProfiler.createScopedProfiler("git");
      const profilable = adapter as unknown as { setProfiler?: (p: StageProfiler) => void };
      if (typeof profilable.setProfiler === "function") {
        profilable.setProfiler(gitProfiler);
      }
    }

    const priorState = await loadPriorState(
      stateStore,
      parsed,
      repoPath,
      repositoryObjectFormat,
      reporter,
    );

    const sessionTimestamp = new Date();
    const tsStr = formatSessionTimestamp(sessionTimestamp);
    const writer = new OutputWriter(
      parsed.outputDir,
      (seq) => `${parsed.outputPrefix}-${tsStr}-${String(seq).padStart(6, "0")}.jsonl`,
      parsed.rotation,
    );
    const sink = new OutputWriterSink(writer);

    const planningProfiler = profile ? rootProfiler.createScopedProfiler("planning") : undefined;
    const traversalProfiler = profile ? rootProfiler.createScopedProfiler("traversal") : undefined;
    const projectionProfiler = profile
      ? rootProfiler.createScopedProfiler("projection")
      : undefined;
    const writeProfiler = profile ? rootProfiler.createScopedProfiler("write") : undefined;

    const traversalPlanner = new DefaultTraversalPlanner(adapter, planningProfiler);
    const traversalExtractor = new DefaultCommitTraversalExtractor(adapter, traversalProfiler);
    const fileChangeExpander = new DefaultFileChangeExpander(adapter, parsed.maxDiffSize);

    // Plugin lifecycle: load, resolve, initialize
    let projector: FactProjector;
    if (parsed.configPath) {
      reporter.emit({ type: "phase-start", phase: "initializing-plugins" });
      const pluginConfigResult = await loadPluginConfig(parsed.configPath);
      if (pluginConfigResult.kind === "termination") {
        presenter.renderUserError(pluginConfigResult.termination.message);
        process.exitCode = 1;
        return;
      }

      const pluginEntriesResult = await resolvePluginEntries(
        pluginConfigResult.config,
        parsed.configPath,
      );
      if (pluginEntriesResult.kind === "termination") {
        presenter.renderUserError(pluginEntriesResult.termination.message);
        process.exitCode = 1;
        return;
      }

      const pluginConfig = pluginConfigResult.config;
      const pluginEntries = pluginEntriesResult.entries;

      await checkPluginCompatibility(pluginEntries, pluginConfig, parsed.configPath, {
        warn(message) {
          presenter.renderDiagnostic("warn", message);
        },
      });

      const pluginsProfiler = profile
        ? projectionProfiler?.createScopedProfiler("plugins")
        : undefined;

      const pluginInitResults = await initializePlugins(pluginEntries, (entry) => ({
        ...createNamespacedDiagnosticReporter(entry.namespace, presenter),
        profiler: pluginsProfiler?.createScopedProfiler(entry.namespace),
      }));

      const pluginInitFailures = pluginInitResults.filter(
        (entry): entry is typeof entry & { result: { type: "fatal"; message: string } } =>
          entry.result.type === "fatal",
      );
      if (pluginInitFailures.length > 0) {
        presenter.renderUserError(
          pluginInitFailures.map((entry) => formatPluginInitializationFailure(entry)).join("\n"),
        );
        process.exitCode = 1;
        return;
      }

      reporter.emit({ type: "phase-end", phase: "initializing-plugins" });

      projector = new EnrichingFactProjector(
        pluginEntries,
        reporter,
        parsed.repoName ?? repoName,
        parsed.repoUrl !== undefined ? parsed.repoUrl : remoteUrl,
      );
    } else {
      projector = new DefaultFactProjector(
        repoName,
        remoteUrl,
        projectionProfiler,
        parsed.repoName,
        parsed.repoUrl,
      );
    }

    const deps: CoordinatorDependencies = {
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      projector,
      sink,
      stateStore,
      reporter,
      profiler: writeProfiler,
    };
    const coordinator = new DefaultExtractionCoordinator(deps);

    const result = await coordinator.run({
      repositoryPath: repoPath,
      repoName,
      remoteUrl,
      refs: [...parsed.refs],
      granularity: parsed.perFile ? "file" : "commit",
      range: parsed.range,
      priorState,
      sessionTimestamp,
    });

    rootProfiler.stop();

    const elapsedMs = performance.now() - startMs;

    if (!quiet) {
      presenter.renderSummary({
        recordsWritten: result.recordsWritten,
        commitsTraversed: result.commitsTraversed,
        filesCreated: sink.filesCreated,
        bytesWritten: sink.bytesWritten,
        elapsedMs,
        refs: result.refs,
      });
      if (profile) {
        presenter.renderProfile(rootProfiler.entries(), result.skippedDiffs);
      }
    }
  } catch (e) {
    if (e instanceof GitAdapterError) {
      presenter.renderUserError(e.message);
      process.exitCode = 1;
      return;
    }
    presenter.renderRuntimeError(
      e instanceof Error ? e : new Error(typeof e === "string" ? e : String(e)),
    );
    process.exitCode = 2;
    return;
  }
}

function shouldRunAsCli(): boolean {
  const argvEntry = process.argv[1];
  if (!argvEntry) {
    return false;
  }
  return pathToFileURL(argvEntry).href === import.meta.url;
}

if (shouldRunAsCli()) {
  main().catch((e) => {
    process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
    process.exit(2);
  });
}
