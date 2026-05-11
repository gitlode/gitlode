import { basename, resolve } from "node:path";

import type { GitAdapter } from "../git/index.js";
import { OutputWriter, formatSessionTimestamp } from "../output/index.js";
import { OutputWriterSink } from "../output/output-writer-sink.js";
import { DefaultBranchTraversalPlanner } from "./branch-traversal-planner.js";
import { DefaultCommitRecordProjector } from "./commit-record-projector.js";
import { DefaultCommitTraversalExtractor } from "./commit-traversal-extractor.js";
import { DefaultExtractionCoordinator } from "./extraction-coordinator.js";
import { DefaultFileChangeExpander } from "./file-change-expander.js";
import { DefaultFileChangeRecordProjector } from "./file-change-record-projector.js";
import { DefaultStageProfiler } from "./profiler.js";
import type {
  CheckpointStore,
  CoordinatorDependencies,
  ExtractionCheckpoint,
  ExtractionResult,
  ExtractorConfig,
  MonotonicClock,
  Reporter,
  StageProfiler,
  WallClock,
} from "./types.js";
import { isCommitHash } from "./types.js";

function deriveRepoName(remoteUrl: string | null, repoPath: string): string {
  if (remoteUrl) {
    const lastSegment = remoteUrl.split("/").pop() ?? "";
    const stripped = lastSegment.replace(/\.git$/, "");
    return stripped || basename(repoPath);
  }
  return basename(repoPath);
}

/** Empty checkpoint sentinel used when no prior state is available. */
function emptyCheckpoint(repositoryPath: string): ExtractionCheckpoint {
  return { version: 1, generatedAt: "", repositoryPath, branches: [] };
}

export class Extractor {
  private readonly config: ExtractorConfig;
  private readonly adapter: GitAdapter;
  private readonly reporter: Reporter;
  private readonly wallNow: WallClock;
  private readonly monotonicNow: MonotonicClock;
  private readonly stateStore?: CheckpointStore;
  constructor(
    config: ExtractorConfig,
    adapter: GitAdapter,
    reporter: Reporter,
    wallNow: WallClock,
    monotonicNow: MonotonicClock,
    stateStore?: CheckpointStore,
  ) {
    this.config = config;
    this.adapter = adapter;
    this.reporter = reporter;
    this.wallNow = wallNow;
    this.monotonicNow = monotonicNow;
    this.stateStore = stateStore;
  }

  // --- Checkpoint loading (formerly initializeStateMap) ---

  private async loadPriorCheckpoint(repoPath: string): Promise<ExtractionCheckpoint> {
    if (!this.stateStore || !this.config.incremental) {
      return emptyCheckpoint(repoPath);
    }
    const checkpoint = await this.stateStore.read();
    if (checkpoint === null) {
      if (this.config.missingState === "snapshot") {
        this.reporter.warn(
          `Warning: State file not found: ${this.config.stateFilePath}. Falling back to full snapshot extraction.`,
        );
        return emptyCheckpoint(repoPath);
      }
      // Default behavior: caller (CLI) should have already gated this; treat as empty.
      return emptyCheckpoint(repoPath);
    }
    if (checkpoint.version !== 1) {
      throw new Error(`Unsupported state file version: ${checkpoint.version}`);
    }
    const recordedPath = resolve(checkpoint.repositoryPath);
    if (recordedPath !== repoPath) {
      throw new Error(
        `State file was created for a different repository: ${checkpoint.repositoryPath}`,
      );
    }
    for (const entry of checkpoint.branches) {
      if (!isCommitHash(entry.lastCommitHash)) {
        throw new Error(
          `Invalid commit hash in state file for branch "${entry.name}": ${entry.lastCommitHash}`,
        );
      }
    }
    return checkpoint;
  }

  async run(): Promise<ExtractionResult> {
    const repoPath = resolve(this.config.repositoryPath);
    const enableProfiling = this.config.enableProfiling === true;

    const remoteUrl = await this.adapter.getRemoteUrl(repoPath);
    const repoName = deriveRepoName(remoteUrl, repoPath);

    // Create a fresh root profiler for this run and start it immediately.
    const rootProfiler = new DefaultStageProfiler("elapsed", this.monotonicNow);
    rootProfiler.start();

    // Wire a scoped "git" profiler only when stage-level profiling is enabled.
    if (enableProfiling) {
      const gitProfiler = rootProfiler.createScopedProfiler("git");
      const profilable = this.adapter as unknown as { setProfiler?: (p: StageProfiler) => void };
      if (typeof profilable.setProfiler === "function") {
        profilable.setProfiler(gitProfiler);
      }
    }

    // Load and validate prior checkpoint (includes missing-state warning emission).
    const priorCheckpoint = await this.loadPriorCheckpoint(repoPath);

    const sessionTimestamp = this.wallNow();
    const tsStr = formatSessionTimestamp(sessionTimestamp);
    const writer = new OutputWriter(
      this.config.outputDir,
      (seq) => `${this.config.outputPrefix}-${tsStr}-${String(seq).padStart(6, "0")}.jsonl`,
      this.config.rotation,
    );
    const sink = new OutputWriterSink(writer);

    // Create per-stage scoped profilers only when enabled.
    const planningProfiler = enableProfiling
      ? rootProfiler.createScopedProfiler("planning")
      : undefined;
    const traversalProfiler = enableProfiling
      ? rootProfiler.createScopedProfiler("traversal")
      : undefined;
    const projectionProfiler = enableProfiling
      ? rootProfiler.createScopedProfiler("projection")
      : undefined;
    const writeProfiler = enableProfiling ? rootProfiler.createScopedProfiler("write") : undefined;

    const traversalPlanner = new DefaultBranchTraversalPlanner(this.adapter, planningProfiler);
    const traversalExtractor = new DefaultCommitTraversalExtractor(this.adapter, traversalProfiler);
    const fileChangeExpander = new DefaultFileChangeExpander(this.adapter);
    const commitProjector = new DefaultCommitRecordProjector(
      repoName,
      remoteUrl,
      projectionProfiler,
    );
    const fileProjector = new DefaultFileChangeRecordProjector(
      repoName,
      remoteUrl,
      projectionProfiler,
    );

    const deps: CoordinatorDependencies = {
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      commitProjector,
      fileProjector,
      sink,
      checkpointStore: this.stateStore,
      reporter: this.reporter,
      profiler: writeProfiler,
    };
    const coordinator = new DefaultExtractionCoordinator(deps);

    const result = await coordinator.run({
      repositoryPath: repoPath,
      repoName,
      remoteUrl,
      branches: [...this.config.branches],
      granularity: this.config.perFile ? "file" : "commit",
      range: this.config.range,
      priorCheckpoint,
      sessionTimestamp,
    });

    rootProfiler.stop();

    return {
      recordsWritten: result.recordsWritten,
      filesCreated: sink.filesCreated,
      bytesWritten: sink.bytesWritten,
      branches: result.branches,
      profilingEntries: rootProfiler.entries(),
    };
  }
}
