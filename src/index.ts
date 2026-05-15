#!/usr/bin/env node
import { rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { ParsedArgs } from "./cli/args.js";
import { parseArgs } from "./cli/index.js";
import { ProgressController, resolveUiMode } from "./cli/progress/index.js";
import type { TerminalSink } from "./cli/progress/index.js";
import { formatProfileLines, formatSummaryLines } from "./cli/reporting/index.js";
import {
  DefaultBranchTraversalPlanner,
  DefaultCommitTraversalExtractor,
  DefaultExtractionCoordinator,
  DefaultFactProjector,
  DefaultFileChangeExpander,
  DefaultStageProfiler,
} from "./core/index.js";
import type {
  CoordinatorDependencies,
  ExtractionState,
  ProgressReporter,
  StageProfiler,
  StateStore,
} from "./core/index.js";
import { isCommitHash } from "./core/index.js";
import { GitAdapterError, IsomorphicGitAdapter } from "./git/index.js";
import { OutputWriter, formatSessionTimestamp } from "./output/index.js";
import { OutputWriterSink } from "./output/output-writer-sink.js";

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
  return { version: 1, generatedAt: "", repositoryPath, branches: [] };
}

async function loadPriorState(
  stateStore: StateStore | undefined,
  parsed: ParsedArgs,
  repoPath: string,
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
        message: `Warning: State file not found: ${parsed.stateFilePath}. Falling back to full snapshot extraction.`,
      });
      return emptyState(repoPath);
    }
    return emptyState(repoPath);
  }
  if (state.version !== 1) {
    throw new Error(`Unsupported state file version: ${state.version}`);
  }
  const recordedPath = resolve(state.repositoryPath);
  if (recordedPath !== repoPath) {
    throw new Error(`State file was created for a different repository: ${state.repositoryPath}`);
  }
  for (const entry of state.branches) {
    if (!isCommitHash(entry.lastCommitHash)) {
      throw new Error(
        `Invalid commit hash in state file for branch "${entry.name}": ${entry.lastCommitHash}`,
      );
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

const stderrSink: TerminalSink = {
  writeLine(text: string): void {
    process.stderr.write(text + "\n");
  },
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
  const adapter = new IsomorphicGitAdapter();
  let parsed;
  try {
    parsed = await parseArgs(adapter);
  } catch (e) {
    if (e instanceof GitAdapterError) {
      process.stderr.write(e.message + "\n");
      process.exit(1);
    }
    process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
    process.exit(2);
  }
  try {
    const { quiet, profile } = parsed;
    const isTTY = process.stderr.isTTY === true;
    const uiMode = resolveUiMode(quiet, isTTY);

    // Build ProgressReporter based on uiMode.
    let reporter: ProgressReporter;
    let controller: ProgressController | null = null;
    if (uiMode === "quiet") {
      reporter = {
        emit(event) {
          if (event.type === "warning") {
            process.stderr.write(event.message + "\n");
          }
        },
      };
    } else {
      controller = new ProgressController(
        stderrSink,
        { nowMs: () => performance.now() },
        {
          setInterval(fn, ms) {
            const id = setInterval(fn, ms);
            return () => clearInterval(id);
          },
        },
        uiMode,
      );
      const ctrl = controller;
      reporter = { emit: (event) => ctrl.handleEvent(event) };
    }

    const stateStore = parsed.stateFilePath ? new NodeStateStore(parsed.stateFilePath) : undefined;

    const repoPath = resolve(parsed.repositoryPath);
    const startMs = performance.now();

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

    const priorState = await loadPriorState(stateStore, parsed, repoPath, reporter);

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

    const traversalPlanner = new DefaultBranchTraversalPlanner(adapter, planningProfiler);
    const traversalExtractor = new DefaultCommitTraversalExtractor(adapter, traversalProfiler);
    const fileChangeExpander = new DefaultFileChangeExpander(adapter);
    const projector = new DefaultFactProjector(repoName, remoteUrl, projectionProfiler);

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
      branches: [...parsed.branches],
      granularity: parsed.perFile ? "file" : "commit",
      range: parsed.range,
      priorState,
      sessionTimestamp,
    });

    rootProfiler.stop();

    const elapsedMs = performance.now() - startMs;

    if (!quiet) {
      const summaryLines = formatSummaryLines({
        recordsWritten: result.recordsWritten,
        commitsTraversed: result.commitsTraversed,
        filesCreated: sink.filesCreated,
        bytesWritten: sink.bytesWritten,
        elapsedMs,
        branches: result.branches,
      });
      process.stderr.write("\n");
      for (const line of summaryLines) {
        process.stderr.write(line + "\n");
      }
      if (profile) {
        const profileLines = formatProfileLines(rootProfiler.entries());
        if (profileLines.length > 0) {
          process.stderr.write("\n");
          for (const line of profileLines) {
            process.stderr.write(line + "\n");
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof GitAdapterError) {
      process.stderr.write(e.message + "\n");
      process.exit(1);
    }
    process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
    process.exit(2);
  }
}

main().catch((e) => {
  process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
  process.exit(2);
});
