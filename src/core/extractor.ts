import { basename, resolve } from "node:path";

import type { GitAdapter, RawCommit } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import { OutputWriter, formatSessionTimestamp, splitMessage, toISO8601 } from "../output/index.js";
import type { OutputCommit } from "../output/index.js";
import type {
  CommitHash,
  ExtractorConfig,
  ExtractionResult,
  MonotonicClock,
  Reporter,
  StateFile,
  StateStore,
  WallClock,
} from "./types.js";
import { assertNever, isCommitHash } from "./types.js";

function deriveRepoName(remoteUrl: string | null, repoPath: string): string {
  if (remoteUrl) {
    const lastSegment = remoteUrl.split("/").pop() ?? "";
    const stripped = lastSegment.replace(/\.git$/, "");
    return stripped || basename(repoPath);
  }
  return basename(repoPath);
}

function mapToOutputCommit(
  commit: RawCommit,
  repoName: string,
  remoteUrl: string | null,
): OutputCommit {
  const { subject, body } = splitMessage(commit.message);
  return {
    oid: commit.oid,
    subject,
    body,
    author: {
      name: commit.author.name,
      email: commit.author.email,
      timestamp: toISO8601(commit.author.timestamp, commit.author.timezoneOffset),
    },
    committer: {
      name: commit.committer.name,
      email: commit.committer.email,
      timestamp: toISO8601(commit.committer.timestamp, commit.committer.timezoneOffset),
    },
    parents: commit.parents,
    repository: {
      name: repoName,
      url: remoteUrl,
    },
  };
}

export class Extractor {
  private readonly config: ExtractorConfig;
  private readonly adapter: GitAdapter;
  private readonly reporter: Reporter;
  private readonly wallNow: WallClock;
  private readonly monotonicNow: MonotonicClock;
  private readonly stateStore?: StateStore;
  constructor(
    config: ExtractorConfig,
    adapter: GitAdapter,
    reporter: Reporter,
    wallNow: WallClock,
    monotonicNow: MonotonicClock,
    stateStore?: StateStore,
  ) {
    this.config = config;
    this.adapter = adapter;
    this.reporter = reporter;
    this.wallNow = wallNow;
    this.monotonicNow = monotonicNow;
    this.stateStore = stateStore;
  }

  private async initializeStateMap(repoPath: string): Promise<Map<string, CommitHash>> {
    const stateMap = new Map<string, CommitHash>();
    if (this.stateStore && this.config.mode === "incremental") {
      const stateData = await this.stateStore.read();
      if (stateData === null) {
        if (this.config.onMissingState === "snapshot") {
          this.reporter.warn(
            `Warning: State file not found: ${this.config.stateFilePath}. Falling back to full snapshot extraction.`,
          );
          // stateMap stays empty → full traversal
        }
      } else {
        if (stateData.version !== 1) {
          throw new Error(`Unsupported state file version: ${stateData.version}`);
        }
        const recordedPath = resolve(stateData.repositoryPath);
        if (recordedPath !== repoPath) {
          throw new Error(
            `State file was created for a different repository: ${stateData.repositoryPath}`,
          );
        }
        for (const entry of stateData.branches) {
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

  private async computeNewBranchExclude(
    newBranches: ReadonlySet<string>,
    stateMap: ReadonlyMap<string, CommitHash>,
    repoPath: string,
  ): Promise<CommitHash | undefined> {
    if (newBranches.size === 0 || stateMap.size === 0) {
      return undefined;
    }
    const mergeBase = await this.adapter.findMergeBase(repoPath, Array.from(stateMap.values()));
    return mergeBase ?? undefined;
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

    // Identify new branches (present in config but absent from stateMap) for deduplication
    const newBranches = new Set(
      this.config.mode === "incremental"
        ? this.config.branches.filter((b) => !stateMap.has(b))
        : [],
    );

    const branchHeads = new Map<string, CommitHash>();
    const visited = new Set<string>();
    let commitsWritten = 0;

    try {
      const newBranchExcludeHash = await this.computeNewBranchExclude(
        newBranches,
        stateMap,
        repoPath,
      );

      for (const branch of this.config.branches) {
        let head: CommitHash;
        try {
          head = await this.adapter.resolveRef(repoPath, branch);
        } catch (err) {
          if (err instanceof GitAdapterError && err.code === "REF_NOT_FOUND") {
            this.reporter.warn(
              `Warning: Branch "${branch}" no longer exists in the repository. Skipping.`,
            );
            continue;
          }
          throw err;
        }
        branchHeads.set(branch, head);

        // Determine excludeHash for this branch
        let excludeHash: CommitHash | undefined;
        if (this.config.range === undefined) {
          const lastHash = stateMap.get(branch);
          if (lastHash !== undefined) {
            excludeHash = lastHash;
          } else if (newBranches.has(branch) && newBranchExcludeHash !== undefined) {
            // New branch in incremental mode: use merge base of existing branches
            // to avoid re-extracting commits already present in prior runs
            excludeHash = newBranchExcludeHash;
          }
        } else {
          const range = this.config.range;
          if (range.type === "ref") {
            excludeHash = range.ref;
          } else if (range.type === "date") {
            // no excludeHash; filtering handled per-commit below
          } else {
            assertNever(range);
          }
        }

        const writeCommit = async (commit: RawCommit) => {
          if (visited.has(commit.oid)) return;
          visited.add(commit.oid);
          if (this.config.range?.type === "date") {
            if (commit.committer.timestamp * 1000 <= this.config.range.since.getTime()) {
              return;
            }
          }
          await writer.write(mapToOutputCommit(commit, repoName, remoteUrl));
          commitsWritten++;
          this.reporter.progress(commitsWritten);
        };

        try {
          for await (const commit of this.adapter.walkCommits(repoPath, head, excludeHash)) {
            await writeCommit(commit);
          }
        } catch (err) {
          if (err instanceof GitAdapterError && err.code === "COMMIT_NOT_FOUND") {
            this.reporter.warn(
              `Warning: Last commit hash for branch "${branch}" no longer exists. Falling back to full extraction.`,
            );
            for await (const commit of this.adapter.walkCommits(repoPath, head)) {
              await writeCommit(commit);
            }
          } else {
            throw err;
          }
        }
      }
    } finally {
      this.reporter.done(commitsWritten);
      await writer.close();
    }

    // Write state file atomically — only reached on success (no exception)
    if (this.stateStore && branchHeads.size > 0) {
      const newState: StateFile = {
        version: 1,
        generatedAt: sessionTs.toISOString(),
        repositoryPath: repoPath,
        branches: Array.from(branchHeads.entries()).map(([name, lastCommitHash]) => ({
          name,
          lastCommitHash,
        })),
      };
      await this.stateStore.write(newState);
    }

    return {
      commitsWritten,
      filesCreated: writer.filesCreated,
      bytesWritten: writer.bytesWritten,
      elapsedMs: this.monotonicNow() - startTime,
      branches: Array.from(branchHeads.keys()),
    };
  }
}
