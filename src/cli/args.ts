import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { Argument, Command, CommanderError, Option } from "commander";

import type { CommitHash, ExtractorConfig } from "../core/index.js";
import { GitAdapterError } from "../git/index.js";
import type { GitAdapter } from "../git/index.js";

export interface ParsedArgs extends ExtractorConfig {
  quiet: boolean;
  profile: boolean;
}

export const program = new Command()
  .name("gitrail")
  .description("Extract Git commit history to JSON Lines")
  .addArgument(new Argument("<repository-path>", "Local path to the Git repository"))
  .option(
    "-r, --ref <ref>",
    "Ref to use as traversal starting point. Accepts branch name, tag, or commit object ID. Repeatable.",
    (val, prev: string[]) => [...prev, val],
    [],
  )
  .option(
    "--incremental",
    "When set, extract only commits new since the last recorded state. When absent, perform a snapshot extraction independently of prior state.",
    false,
  )
  .addOption(
    new Option("-o, --output-dir <path>", "Directory to write output .jsonl files").default("./"),
  )
  .option(
    "--output-prefix <string>",
    "Filename prefix for output files (derived from remote origin if omitted)",
  )
  .option(
    "-s, --state <path>",
    "Path to state file. In snapshot mode, content is ignored but file is updated on success. Required when --incremental.",
  )
  .option(
    "--missing-state <error|snapshot>",
    'Behavior when --incremental and state file does not exist: "error" (default) exits with code 1; "snapshot" warns and falls back to full extraction. Only valid with --incremental.',
  )
  .option(
    "--since-ref <ref>",
    "Exclude commits reachable from this ref. Accepts commit hash, tag name, or branch name. Only valid in snapshot mode.",
  )
  .option(
    "--since-date <ISO8601>",
    "Extract only commits with committer timestamp after this datetime (ISO 8601)",
  )
  .option("--rotate-lines <n>", "Start a new output file after N lines")
  .option("--rotate-size <bytes>", "Start a new output file after N bytes")
  .option(
    "-q, --quiet",
    "Suppress progress and summary output (for CI, cron, and scripted usage)",
    false,
  )
  .option(
    "--profile",
    "Print per-stage timing information as an aligned block to stderr after a successful extraction. Suppressed by --quiet.",
    false,
  )
  .option(
    "--per-file",
    "When set, emit one record per changed file within each commit. When absent, emit one record per commit (default granularity).",
    false,
  );

function userError(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

const ROTATE_SIZE_MIN = 1_048_576n; // 1 MiB
const ROTATE_SIZE_MAX = 68_719_476_736n; // 64 GiB

function parseRotateSizeBytes(raw: string): number {
  const trimmed = raw.trim();
  const match = /^(\d+)([kKmMgG]?)$/.exec(trimmed);
  if (!match) {
    userError(
      "--rotate-size must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)",
    );
  }
  const numPart = BigInt(match[1]!);
  const suffix = match[2]!.toUpperCase();
  const multipliers: Record<string, bigint> = {
    "": 1n,
    K: 1024n,
    M: 1_048_576n,
    G: 1_073_741_824n,
  };
  const bytes = numPart * multipliers[suffix]!;
  if (bytes < ROTATE_SIZE_MIN || bytes > ROTATE_SIZE_MAX) {
    userError("--rotate-size must be between 1048576 and 68719476736 bytes");
  }
  return Number(bytes);
}

export async function parseArgs(adapter: GitAdapter): Promise<ParsedArgs> {
  program.exitOverride();
  try {
    program.parse(process.argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.code === "commander.helpDisplayed") process.exit(0);
      if (err.code === "commander.unknownOption") {
        // err.message format: "error: unknown option '--foo'"
        // Extract just the option name for consistent userError style.
        const match = /'(--[\w-]+)'/.exec(err.message);
        userError(`Unknown option: ${match?.[1] ?? err.message.replace(/^error: /, "")}`);
      }
      userError(err.message.replace(/^error: /, ""));
    }
    throw err;
  }

  // commander.opts<T>() is a type assertion internally (returns `this._optionValues as T`).
  // The type parameter below must be kept in sync with the .option() calls on `program` above.
  // There is no compile-time enforcement of this alignment; a mismatch will cause runtime bugs.
  // See roadmap: "CLI: Schema validation for parsed CLI options" for a tracked follow-up.
  const opts = program.opts<{
    ref: string[];
    incremental: boolean;
    outputDir: string;
    outputPrefix?: string;
    state?: string;
    missingState?: string;
    sinceRef?: string;
    sinceDate?: string;
    rotateLines?: string;
    rotateSize?: string;
    quiet: boolean;
    profile: boolean;
    perFile: boolean;
  }>();

  const refs: string[] = opts.ref;
  const incremental = opts.incremental;
  const sinceRef = opts.sinceRef;
  const sinceDate = opts.sinceDate;
  const state = opts.state;
  const missingStateRaw = opts.missingState;
  const outputDir = opts.outputDir;
  const outputPrefix = opts.outputPrefix;
  const rotateLinesRaw = opts.rotateLines;
  const rotateSizeRaw = opts.rotateSize;
  const repoPath = program.args[0] as string | undefined;
  const quiet = opts.quiet;
  const profile = opts.profile;
  const perFile = opts.perFile;

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

  if (refs.length === 0) {
    userError("At least one --ref must be specified");
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
    maxBytes = parseRotateSizeBytes(rotateSizeRaw);
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
    await adapter.resolveRef(resolvedRepoPath, refs[0]!);
  } catch (e) {
    if (e instanceof GitAdapterError) {
      if (e.code === "NOT_A_REPOSITORY") {
        userError(`Not a Git repository: ${repoPath}`);
      }
      if (e.code !== "REF_NOT_FOUND") {
        throw e;
      }
      // REF_NOT_FOUND means valid repo but ref doesn't exist — extractor will surface this
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
    refs,
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
