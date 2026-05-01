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
import type {
  CheckpointStore,
  CoordinatorDependencies,
  ExtractionCheckpoint,
  ExtractionResult,
  ExtractorConfig,
  MonotonicClock,
  Reporter,
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
    const startTime = this.monotonicNow();
    const repoPath = resolve(this.config.repositoryPath);

    const remoteUrl = await this.adapter.getRemoteUrl(repoPath);
    const repoName = deriveRepoName(remoteUrl, repoPath);

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

    // Construct stage instances.
    const traversalPlanner = new DefaultBranchTraversalPlanner(this.adapter);
    const traversalExtractor = new DefaultCommitTraversalExtractor(this.adapter);
    const fileChangeExpander = new DefaultFileChangeExpander(this.adapter);
    const commitProjector = new DefaultCommitRecordProjector(repoName, remoteUrl);
    const fileProjector = new DefaultFileChangeRecordProjector(repoName, remoteUrl);

    const deps: CoordinatorDependencies = {
      traversalPlanner,
      traversalExtractor,
      fileChangeExpander,
      commitProjector,
      fileProjector,
      sink,
      checkpointStore: this.stateStore,
      reporter: this.reporter,
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

    return {
      recordsWritten: result.recordsWritten,
      filesCreated: sink.filesCreated,
      bytesWritten: sink.bytesWritten,
      elapsedMs: this.monotonicNow() - startTime,
      branches: result.branches,
    };
  }
}
