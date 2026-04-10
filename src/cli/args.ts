import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { defineCommand, parseArgs as parseCittyArgs } from "citty";
import type { ArgsDef } from "citty";
import { GitAdapterError } from "../git/index.js";
import type { GitAdapter } from "../git/index.js";
import type { ExtractorConfig } from "../core/index.js";

// Define all citty args on a defineCommand descriptor.
// The schema is defined separately so it can be passed directly to parseCittyArgs.
const argsDef = {
  "repository-path": {
    type: "positional" as const,
    required: true as const,
    description: "Local path to the Git repository",
  },
  branch: {
    type: "string" as const,
    description:
      "Ref (branch name) to use as traversal starting point. Repeatable for multiple branches.",
  },
  "output-dir": {
    type: "string" as const,
    default: "./",
    description: "Directory to write output .jsonl files",
  },
  "output-prefix": {
    type: "string" as const,
    description: "Filename prefix for output files (derived from remote origin if omitted)",
  },
  state: {
    type: "string" as const,
    description:
      "Path to state file. If file exists → differential mode. If not → full extraction, then create file.",
  },
  "since-commit": {
    type: "string" as const,
    description: "Extract only commits newer than this hash (exclusive)",
  },
  "since-date": {
    type: "string" as const,
    description: "Extract only commits with committer timestamp after this datetime (ISO 8601)",
  },
  "rotate-lines": {
    type: "string" as const,
    description: "Start a new output file after N lines",
  },
  "rotate-size": {
    type: "string" as const,
    description: "Start a new output file after N bytes",
  },
} satisfies ArgsDef;

// defineCommand descriptor (provides structured metadata and enables --help generation
// when imported by index.ts; run() is intentionally omitted here)
export const cmdDefinition = defineCommand({
  meta: {
    name: "gitrail",
    description: "Extract Git commit history to JSON Lines",
  },
  args: argsDef,
});

function userError(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

export async function parseArgs(adapter: GitAdapter): Promise<ExtractorConfig> {
  const rawArgv = process.argv.slice(2);

  // Citty only keeps the last occurrence of a string flag when it appears multiple times.
  // Manually collect all --branch values to support repeatable usage.
  const branches: string[] = [];
  for (let i = 0; i < rawArgv.length; i++) {
    const arg = rawArgv[i]!;
    if (arg === "--branch") {
      const val = rawArgv[i + 1];
      if (val !== undefined && !val.startsWith("-")) {
        branches.push(val);
        i++;
      }
    } else if (arg.startsWith("--branch=")) {
      const val = arg.slice("--branch=".length);
      if (val) branches.push(val);
    }
  }

  const parsed = parseCittyArgs(rawArgv, argsDef) as {
    [key: string]: string | string[] | boolean | undefined;
    _: string[];
  };

  const sinceCommit = parsed["since-commit"] as string | undefined;
  const sinceDate = parsed["since-date"] as string | undefined;
  const state = parsed["state"] as string | undefined;
  const outputDir = (parsed["output-dir"] ?? "./") as string;
  const outputPrefix = parsed["output-prefix"] as string | undefined;
  const rotateLinesRaw = parsed["rotate-lines"] as string | undefined;
  const rotateSizeRaw = parsed["rotate-size"] as string | undefined;
  const repoPath = parsed["repository-path"] as string | undefined;

  // --- Mutual exclusion checks (before any I/O) ---
  if (sinceCommit && sinceDate) {
    userError("--since-commit and --since-date cannot be used together");
  }
  if (state && sinceCommit) {
    userError(
      "--state and --since-commit cannot be used together. Use --state for incremental runs.",
    );
  }
  if (state && sinceDate) {
    userError(
      "--state and --since-date cannot be used together. Use --state for incremental runs.",
    );
  }

  // --- Format validation (before any I/O) ---
  if (branches.length === 0) {
    userError("At least one --branch must be specified");
  }

  let maxLines: number | undefined;
  if (rotateLinesRaw !== undefined) {
    const n = Number(rotateLinesRaw);
    if (!Number.isInteger(n) || n <= 0) {
      userError("--rotate-lines must be a positive integer");
    }
    maxLines = n;
  }

  let maxBytes: number | undefined;
  if (rotateSizeRaw !== undefined) {
    const n = Number(rotateSizeRaw);
    if (!Number.isInteger(n) || n <= 0) {
      userError("--rotate-size must be a positive integer");
    }
    maxBytes = n;
  }

  let sinceDateObj: Date | undefined;
  if (sinceDate !== undefined) {
    const d = new Date(sinceDate);
    if (isNaN(d.getTime())) {
      userError(
        "Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
      );
    }
    sinceDateObj = d;
  }

  // --- File system and Git validation ---
  if (!repoPath) {
    userError("Repository path is required");
  }

  const resolvedRepoPath = resolve(repoPath);
  if (!existsSync(resolvedRepoPath)) {
    userError(`Repository not found: ${repoPath}`);
  }

  // Validate that the path is a Git repository
  try {
    await adapter.resolveRef(resolvedRepoPath, branches[0]!);
  } catch (e) {
    if (e instanceof GitAdapterError) {
      if (e.code === "NOT_A_REPOSITORY") {
        userError(`Not a Git repository: ${repoPath}`);
      }
      if (e.code !== "REF_NOT_FOUND") {
        throw e;
      }
      // REF_NOT_FOUND means valid repo but branch doesn't exist — extractor will surface this
    } else {
      throw e;
    }
  }

  const resolvedOutputDir = resolve(outputDir);
  if (!existsSync(resolvedOutputDir)) {
    userError(`Output directory not found: ${outputDir}`);
  }

  // --- Since-commit validation ---
  if (sinceCommit) {
    for (const branch of branches) {
      const branchHead = await adapter.resolveRef(resolvedRepoPath, branch).catch((e: unknown) => {
        if (e instanceof GitAdapterError && e.code === "REF_NOT_FOUND") return null;
        throw e;
      });
      if (branchHead === null) continue;

      try {
        const iter = adapter.walkCommits(resolvedRepoPath, branchHead, sinceCommit);
        await iter[Symbol.asyncIterator]().next();
      } catch (e) {
        if (e instanceof GitAdapterError && e.code === "COMMIT_NOT_FOUND") {
          userError(`Commit ${sinceCommit} not found in branch ${branch}`);
        }
        throw e;
      }
    }
  }

  // --- Output prefix derivation ---
  let prefix: string;
  if (outputPrefix) {
    prefix = outputPrefix;
  } else {
    const remoteUrl = await adapter.getRemoteUrl(resolvedRepoPath);
    if (remoteUrl) {
      const lastSegment = remoteUrl.split("/").pop() ?? "";
      const stripped = lastSegment.replace(/\.git$/, "");
      prefix = stripped || basename(resolvedRepoPath);
    } else {
      prefix = basename(resolvedRepoPath);
    }
  }

  return {
    repositoryPath: repoPath,
    branches,
    outputDir: resolvedOutputDir,
    outputPrefix: prefix,
    rotation: { maxLines, maxBytes },
    range: sinceCommit
      ? { type: "commit", hash: sinceCommit }
      : sinceDateObj
        ? { type: "date", since: sinceDateObj }
        : undefined,
    stateFilePath: state,
  };
}
