import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { GitAdapter, RawCommit } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import { OutputWriter, splitMessage, toISO8601 } from "../output/index.js";
import type { OutputCommit } from "../output/index.js";
import type { ExtractorConfig, ExtractionResult, StateFile } from "./types.js";

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
  constructor(
    private readonly config: ExtractorConfig,
    private readonly adapter: GitAdapter,
  ) {}

  async run(): Promise<ExtractionResult> {
    const startTime = performance.now();
    const repoPath = resolve(this.config.repositoryPath);

    const remoteUrl = await this.adapter.getRemoteUrl(repoPath);
    const repoName = deriveRepoName(remoteUrl, repoPath);

    // Read and validate state file if configured
    const stateMap = new Map<string, string>();
    if (this.config.stateFilePath) {
      try {
        const raw = await readFile(this.config.stateFilePath, "utf8");
        const stateFile = JSON.parse(raw) as StateFile;
        if (stateFile.version !== 1) {
          throw new Error(`Unsupported state file version: ${stateFile.version}`);
        }
        const recordedPath = resolve(stateFile.repositoryPath);
        if (recordedPath !== repoPath) {
          throw new Error(
            `State file was created for a different repository: ${stateFile.repositoryPath}`,
          );
        }
        for (const entry of stateFile.branches) {
          stateMap.set(entry.name, entry.lastCommitHash);
        }
      } catch (err) {
        if (
          err instanceof Error &&
          "code" in err &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          // State file does not yet exist — full extraction
        } else {
          throw err;
        }
      }
    }

    const writer = new OutputWriter(
      this.config.outputDir,
      this.config.outputPrefix,
      this.config.rotation,
    );

    const branchHeads = new Map<string, string>();
    const visited = new Set<string>();
    let commitsWritten = 0;

    try {
      for (const branch of this.config.branches) {
        let head: string;
        try {
          head = await this.adapter.resolveRef(repoPath, branch);
        } catch (err) {
          if (err instanceof GitAdapterError && err.code === "REF_NOT_FOUND") {
            process.stderr.write(
              `Warning: Branch "${branch}" no longer exists in the repository. Skipping.\n`,
            );
            continue;
          }
          throw err;
        }
        branchHeads.set(branch, head);

        // Determine excludeHash for this branch
        let excludeHash: string | undefined;
        if (this.config.range?.type === "commit") {
          excludeHash = this.config.range.hash;
        } else if (this.config.range === undefined || this.config.range === null) {
          const lastHash = stateMap.get(branch);
          if (lastHash !== undefined) {
            excludeHash = lastHash;
          }
        }
        // For range.type === "date": no excludeHash; filtering handled per-commit below

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
          if (!this.config.quiet && commitsWritten % 100 === 0) {
            process.stderr.write(`\rProcessed ${commitsWritten} commits...`);
          }
        };

        try {
          for await (const commit of this.adapter.walkCommits(repoPath, head, excludeHash)) {
            await writeCommit(commit);
          }
        } catch (err) {
          if (err instanceof GitAdapterError && err.code === "COMMIT_NOT_FOUND") {
            process.stderr.write(
              `Warning: Last commit hash for branch "${branch}" no longer exists. Falling back to full extraction.\n`,
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
      if (!this.config.quiet) {
        if (commitsWritten > 0 && commitsWritten % 100 !== 0) {
          process.stderr.write(`\rProcessed ${commitsWritten} commits...\n`);
        } else if (commitsWritten >= 100) {
          process.stderr.write("\n");
        }
      }
      await writer.close();
    }

    // Write state file atomically — only reached on success (no exception)
    if (this.config.stateFilePath && branchHeads.size > 0) {
      const newState: StateFile = {
        version: 1,
        generatedAt: new Date().toISOString(),
        repositoryPath: repoPath,
        branches: Array.from(branchHeads.entries()).map(([name, lastCommitHash]) => ({
          name,
          lastCommitHash,
        })),
      };
      const tmpPath = `${this.config.stateFilePath}.tmp`;
      await writeFile(tmpPath, JSON.stringify(newState, null, 2), "utf8");
      await rename(tmpPath, this.config.stateFilePath);
    }

    return {
      commitsWritten,
      filesCreated: writer.filesCreated,
      bytesWritten: writer.bytesWritten,
      elapsedMs: performance.now() - startTime,
      branches: Array.from(branchHeads.keys()),
    };
  }
}
