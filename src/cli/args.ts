import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { Argument, Command, CommanderError, Option } from "commander";
import { z } from "zod";

import type { CommitOid, ExtractorConfig } from "../core/index.js";
import { GitAdapterError } from "../git/index.js";
import type { GitAdapter } from "../git/index.js";

export interface ParsedArgs extends ExtractorConfig {
  quiet: boolean;
  profile: boolean;
}

const RawOptsSchema = z.object({
  ref: z.array(z.string()),
  incremental: z.boolean(),
  outputDir: z.string(),
  outputPrefix: z.string().optional(),
  state: z.string().optional(),
  missingState: z.string().optional(),
  sinceRef: z.string().optional(),
  sinceDate: z.string().optional(),
  rotateLines: z.string().optional(),
  rotateSize: z.string().optional(),
  maxDiffSize: z.string().optional(),
  quiet: z.boolean(),
  profile: z.boolean(),
  perFile: z.boolean(),
});

export const program = new Command()
  .name("gitrail")
  .description("Extract Git commit history to JSON Lines")
  .addArgument(new Argument("<repository-path>", "Local path to the Git repository"))
  .addHelpOption(new Option("-h, --help", "display help for command").hideHelp())
  .option(
    "-r, --ref <ref>",
    "Ref to use as traversal starting point. Accepts branch name, tag, or commit object ID. Repeatable.",
    (val, prev: string[]) => [...prev, val],
    [],
  )
  .addOption(
    new Option(
      "-q, --quiet",
      "Suppress progress and summary output (for CI, cron, and scripted usage)",
    )
      .default(false)
      .helpGroup("General"),
  )
  .addOption(
    new Option(
      "--profile",
      "Print per-stage timing information as an aligned block to stderr after a successful extraction. Suppressed by --quiet.",
    )
      .default(false)
      .helpGroup("General"),
  )
  .addOption(
    new Option("-o, --output-dir <path>", "Directory to write output .jsonl files")
      .default("./")
      .helpGroup("Output"),
  )
  .addOption(
    new Option(
      "--output-prefix <string>",
      "Filename prefix for output files (derived from remote origin if omitted)",
    ).helpGroup("Output"),
  )
  .addOption(
    new Option(
      "--per-file",
      "When set, emit one record per changed file within each commit. When absent, emit one record per commit (default granularity).",
    )
      .default(false)
      .helpGroup("Output"),
  )
  .addOption(
    new Option(
      "--max-diff-size <bytes>",
      "Skip line-level diff computation for files exceeding this size (e.g. 100K, 1M). Skipped diffs are emitted with null additions/deletions counts. Default: disabled (off). Only applies with --per-file extraction mode.",
    ).helpGroup("Output"),
  )
  .addOption(
    new Option(
      "--incremental",
      "When set, extract only commits new since the last recorded state. When absent, perform a snapshot extraction independently of prior state.",
    )
      .default(false)
      .helpGroup("Differential Extraction"),
  )
  .addOption(
    new Option(
      "-s, --state <path>",
      "Path to state file. In snapshot mode, content is ignored but file is updated on success. Required when --incremental.",
    ).helpGroup("Differential Extraction"),
  )
  .addOption(
    new Option(
      "--missing-state <error|snapshot>",
      'Behavior when --incremental and state file does not exist: "error" (default) exits with code 1; "snapshot" warns and falls back to full extraction. Only valid with --incremental.',
    ).helpGroup("Differential Extraction"),
  )
  .addOption(
    new Option(
      "--since-ref <ref>",
      "Exclude commits reachable from this ref. Accepts commit object ID (OID), tag name, or branch name. Only valid in snapshot mode.",
    ).helpGroup("Differential Extraction"),
  )
  .addOption(
    new Option(
      "--since-date <ISO8601>",
      "Extract only commits with committer timestamp after this datetime (ISO 8601)",
    ).helpGroup("Differential Extraction"),
  )
  .addOption(
    new Option("--rotate-lines <n>", "Start a new output file after N lines").helpGroup(
      "File Rotation",
    ),
  )
  .addOption(
    new Option("--rotate-size <bytes>", "Start a new output file after N bytes").helpGroup(
      "File Rotation",
    ),
  );

function userError(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

const ROTATE_SIZE_MIN = 1_048_576n; // 1 MiB
const ROTATE_SIZE_MAX = 68_719_476_736n; // 64 GiB

/**
 * Parse a binary size string (e.g. "100K", "1M") to bytes.
 * Supports suffixes K (1024), M (1048576), G (1073741824).
 * @param raw - Raw input string
 * @param minBytes - Minimum allowed value in bytes; null for no minimum
 * @param maxBytes - Maximum allowed value in bytes; null for no maximum
 * @param optionName - CLI option name for error messages
 */
function parseBinarySize(
  raw: string,
  minBytes: bigint | null,
  maxBytes: bigint | null,
  optionName: string,
): number {
  const trimmed = raw.trim();
  const match = /^(\d+)([kKmMgG]?)$/.exec(trimmed);
  if (!match) {
    userError(
      `${optionName} must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)`,
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
  if (minBytes !== null && maxBytes !== null && (bytes < minBytes || bytes > maxBytes)) {
    userError(`${optionName} must be between ${Number(minBytes)} and ${Number(maxBytes)} bytes`);
  }
  if (minBytes !== null && maxBytes === null && bytes < minBytes) {
    userError(`${optionName} must be at least ${Number(minBytes)} byte`);
  }
  if (minBytes === null && maxBytes !== null && bytes > maxBytes) {
    userError(`${optionName} must be at most ${Number(maxBytes)} bytes`);
  }
  return Number(bytes);
}

function parseRotateSizeBytes(raw: string): number {
  return parseBinarySize(raw, ROTATE_SIZE_MIN, ROTATE_SIZE_MAX, "--rotate-size");
}

function parseMaxDiffSizeBytes(raw: string): number {
  // Allow any value from 1 byte with no upper limit (users may set very high thresholds)
  return parseBinarySize(raw, 1n, null, "--max-diff-size");
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

  let opts: z.infer<typeof RawOptsSchema>;
  try {
    opts = RawOptsSchema.parse(program.opts());
  } catch (err) {
    if (err instanceof z.ZodError) {
      userError(err.issues[0]?.message ?? "Invalid CLI options");
    }
    throw err;
  }

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
  const maxDiffSizeRaw = opts.maxDiffSize;
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

  let maxDiffSize: number | undefined;
  if (maxDiffSizeRaw !== undefined) {
    maxDiffSize = parseMaxDiffSizeBytes(maxDiffSizeRaw);
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

  let resolvedSinceRef: CommitOid | undefined;
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
    maxDiffSize,
    quiet,
    profile,
  };
}
