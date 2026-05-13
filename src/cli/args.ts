import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { defineCommand, parseArgs as parseCittyArgs } from "citty";
import type { ArgsDef } from "citty";

import type { CommitHash, ExtractorConfig } from "../core/index.js";
import { GitAdapterError } from "../git/index.js";
import type { GitAdapter } from "../git/index.js";

export interface ParsedArgs extends ExtractorConfig {
  quiet: boolean;
  profile: boolean;
}

// Define all citty args on a defineCommand descriptor.
// The schema is defined separately so it can be passed directly to parseCittyArgs.
const argsDef = {
  "repository-path": {
    type: "positional" as const,
    required: true as const,
    description: "Local path to the Git repository",
  },
  incremental: {
    type: "boolean" as const,
    default: false,
    description:
      "When set, extract only commits new since the last recorded state. When absent, perform a snapshot extraction independently of prior state.",
  },
  branch: {
    type: "string" as const,
    alias: "b",
    description:
      "Ref (branch name) to use as traversal starting point. Repeatable for multiple branches.",
  },
  "output-dir": {
    type: "string" as const,
    default: "./",
    alias: "o",
    description: "Directory to write output .jsonl files",
  },
  "output-prefix": {
    type: "string" as const,
    description: "Filename prefix for output files (derived from remote origin if omitted)",
  },
  state: {
    type: "string" as const,
    alias: "s",
    description:
      "Path to state file. In snapshot mode, content is ignored but file is updated on success. Required when --incremental.",
  },
  "missing-state": {
    type: "string" as const,
    description:
      'Behavior when --incremental and state file does not exist: "error" (default) exits with code 1; "snapshot" warns and falls back to full extraction. Only valid with --incremental.',
  },
  "since-ref": {
    type: "string" as const,
    description:
      "Exclude commits reachable from this ref. Accepts commit hash, tag name, or branch name. Only valid in snapshot mode.",
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
  quiet: {
    type: "boolean" as const,
    default: false,
    alias: "q",
    description: "Suppress progress and summary output (for CI, cron, and scripted usage)",
  },
  profile: {
    type: "boolean" as const,
    default: false,
    description:
      "Print per-stage timing information as an aligned block to stderr after a successful extraction. Suppressed by --quiet.",
  },
  "per-file": {
    type: "boolean" as const,
    default: false,
    description:
      "When set, emit one record per changed file within each commit. When absent, emit one record per commit (default granularity).",
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

export async function parseArgs(adapter: GitAdapter): Promise<ParsedArgs> {
  const rawArgv = process.argv.slice(2);

  // Citty only keeps the last occurrence of a string flag when it appears multiple times.
  // Manually collect all --branch / -b values to support repeatable usage.
  // Citty receives rawArgv unchanged because alias "b" is declared in argsDef,
  // so mri correctly parses -b as a string flag and avoids positional arg corruption.
  const branches: string[] = [];
  for (let i = 0; i < rawArgv.length; i++) {
    const arg = rawArgv[i]!;
    if (arg === "--branch" || arg === "-b") {
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

  const incremental = Boolean(parsed["incremental"]);
  const sinceRef = parsed["since-ref"] as string | undefined;
  const sinceDate = parsed["since-date"] as string | undefined;
  const state = parsed["state"] as string | undefined;
  const missingStateRaw = parsed["missing-state"] as string | undefined;
  const outputDir = (parsed["output-dir"] ?? "./") as string;
  const outputPrefix = parsed["output-prefix"] as string | undefined;
  const rotateLinesRaw = parsed["rotate-lines"] as string | undefined;
  const rotateSizeRaw = parsed["rotate-size"] as string | undefined;
  const repoPath = parsed["repository-path"] as string | undefined;
  const quiet = Boolean(parsed["quiet"]);
  const profile = Boolean(parsed["profile"]);
  const perFile = Boolean(parsed["per-file"]);

  // --- Phase 1: Format and mutual exclusion checks (no I/O) ---
  if (
    missingStateRaw !== undefined &&
    missingStateRaw !== "error" &&
    missingStateRaw !== "snapshot"
  ) {
    userError('--missing-state must be "error" or "snapshot"');
  }

  if (sinceRef && sinceDate) {
    userError("--since-ref and --since-date cannot be used together");
  }
  if (incremental && sinceRef) {
    userError("--since-ref cannot be used with --incremental");
  }
  if (incremental && sinceDate) {
    userError("--since-date cannot be used with --incremental");
  }
  if (missingStateRaw !== undefined && !incremental) {
    userError("--missing-state is only valid with --incremental");
  }
  if (incremental && !state) {
    userError("--state is required when using --incremental");
  }

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

  // --- Phase 2: File system validation ---
  if (!repoPath) {
    userError("Repository path is required");
  }

  const resolvedRepoPath = resolve(repoPath);
  if (!existsSync(resolvedRepoPath)) {
    userError(`Repository not found: ${repoPath}`);
  }

  const resolvedOutputDir = resolve(outputDir);
  if (!existsSync(resolvedOutputDir)) {
    userError(`Output directory not found: ${outputDir}`);
  }

  if (state) {
    const resolvedStatePath = resolve(state);
    const stateParentDir = dirname(resolvedStatePath);
    if (!existsSync(stateParentDir)) {
      userError(`Parent directory for state file not found: ${stateParentDir}`);
    }
    if (incremental && missingStateRaw !== "snapshot" && !existsSync(resolvedStatePath)) {
      userError(`State file not found: ${resolvedStatePath}`);
    }
  }

  // --- Phase 3: Git validation ---
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

  let resolvedSinceRef: CommitHash | undefined;
  if (sinceRef) {
    try {
      resolvedSinceRef = await adapter.resolveRef(resolvedRepoPath, sinceRef);
    } catch (e) {
      if (e instanceof GitAdapterError && e.code === "REF_NOT_FOUND") {
        userError(`Ref not found: ${sinceRef}`);
      }
      throw e;
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
    incremental,
    missingState: incremental ? ((missingStateRaw ?? "error") as "error" | "snapshot") : undefined,
    range: resolvedSinceRef
      ? { type: "ref", ref: resolvedSinceRef }
      : sinceDateObj
        ? { type: "date", since: sinceDateObj }
        : undefined,
    stateFilePath: state,
    perFile,
    quiet,
    profile,
  };
}
