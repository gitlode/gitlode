import { basename, resolve } from "node:path";

import type { FileChange, GitAdapter } from "../git/index.js";
import { OutputWriter, formatSessionTimestamp, splitMessage, toISO8601 } from "../output/index.js";
import type { OutputCommit, OutputFileRecord } from "../output/index.js";
import { DefaultCommitTraversalExtractor } from "./commit-traversal-extractor.js";
import type {
  CheckpointStore,
  CommitFact,
  CommitHash,
  ExtractionCheckpoint,
  ExtractionResult,
  ExtractorConfig,
  FileChangeFact,
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

  private toFileChangeFact(fact: CommitFact, fileChange: FileChange): FileChangeFact {
    return {
      commit: fact,
      file: {
        path: fileChange.path,
        status: fileChange.status,
        additions: fileChange.additions,
        deletions: fileChange.deletions,
      },
    };
  }

  // --- Projection helpers (anticipate future CommitRecordProjector / FileChangeRecordProjector split) ---

  private projectCommitFact(fact: CommitFact): OutputCommit {
    const { subject, body } = splitMessage(fact.message);
    return {
      oid: fact.oid,
      subject,
      body,
      author: {
        name: fact.author.name,
        email: fact.author.email,
        timestamp: toISO8601(fact.author.timestamp, fact.author.timezoneOffset),
      },
      committer: {
        name: fact.committer.name,
        email: fact.committer.email,
        timestamp: toISO8601(fact.committer.timestamp, fact.committer.timezoneOffset),
      },
      parents: fact.parents,
      repository: { name: fact.repository.name, url: fact.repository.url },
    };
  }

  private projectFileChangeFact(fact: FileChangeFact): OutputFileRecord {
    return {
      ...this.projectCommitFact(fact.commit),
      file: {
        path: fact.file.path,
        status: fact.file.status,
        additions: fact.file.additions,
        deletions: fact.file.deletions,
      },
    };
  }

  // --- Checkpoint helpers ---

  private async initializeStateMap(repoPath: string): Promise<Map<string, CommitHash>> {
    const stateMap = new Map<string, CommitHash>();
    if (this.stateStore && this.config.mode === "incremental") {
      const checkpoint = await this.stateStore.read();
      if (checkpoint === null) {
        if (this.config.onMissingState === "snapshot") {
          this.reporter.warn(
            `Warning: State file not found: ${this.config.stateFilePath}. Falling back to full snapshot extraction.`,
          );
          // stateMap stays empty → full traversal
        }
      } else {
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
          stateMap.set(entry.name, entry.lastCommitHash);
        }
      }
    }
    return stateMap;
  }

  async run(): Promise<ExtractionResult> {
    const startTime = this.monotonicNow();
    const repoPath = resolve(this.config.repositoryPath);

    const remoteUrl = await this.adapter.getRemoteUrl(repoPath);
    const repoName = deriveRepoName(remoteUrl, repoPath);

    const stateMap = await this.initializeStateMap(repoPath);

    const sessionTs = this.wallNow();
    const tsStr = formatSessionTimestamp(sessionTs);
    const writer = new OutputWriter(
      this.config.outputDir,
      (seq) => `${this.config.outputPrefix}-${tsStr}-${String(seq).padStart(6, "0")}.jsonl`,
      this.config.rotation,
    );

    const traverser = new DefaultCommitTraversalExtractor(this.adapter);
    const recordsRef = { count: 0 };
    let candidateCheckpoint: ExtractionCheckpoint = {
      version: 1,
      generatedAt: sessionTs.toISOString(),
      repositoryPath: repoPath,
      branches: [],
    };

    try {
      const result = await traverser.extract(
        {
          repositoryPath: repoPath,
          repoName,
          remoteUrl,
          branches: [...this.config.branches],
          mode: this.config.mode,
          priorBranchMap: stateMap,
          range: this.config.range,
          generatedAt: sessionTs.toISOString(),
        },
        this.reporter,
      );
      candidateCheckpoint = result.candidateCheckpoint;

      for await (const fact of result.commitFacts) {
        if (this.config.outputMode === "commit") {
          await writer.write(this.projectCommitFact(fact));
          recordsRef.count++;
          this.reporter.progress(recordsRef.count);
        } else {
          const parentOid = fact.parents[0] as CommitHash | undefined;
          const fileChanges = await this.adapter.getFileChanges(
            repoPath,
            fact.oid as CommitHash,
            parentOid,
          );
          for (const fileChange of fileChanges) {
            await writer.write(this.projectFileChangeFact(this.toFileChangeFact(fact, fileChange)));
            recordsRef.count++;
            this.reporter.progress(recordsRef.count);
          }
        }
      }
    } finally {
      this.reporter.done(recordsRef.count);
      await writer.close();
    }

    // Write checkpoint atomically — only reached on success (no exception)
    if (this.stateStore && candidateCheckpoint.branches.length > 0) {
      await this.stateStore.write(candidateCheckpoint);
    }

    return {
      recordsWritten: recordsRef.count,
      filesCreated: writer.filesCreated,
      bytesWritten: writer.bytesWritten,
      elapsedMs: this.monotonicNow() - startTime,
      branches: candidateCheckpoint.branches.map((b) => b.name),
    };
  }
}
