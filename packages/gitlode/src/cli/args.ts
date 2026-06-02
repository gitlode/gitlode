import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { Argument, Command, CommanderError, Option } from "commander";
import { z } from "zod";

import type { CommitOid, ExtractorConfig } from "../core/index.js";
import { GitAdapterError } from "../git/index.js";
import type { GitAdapter } from "../git/index.js";
import { loadConfigFile } from "./config/index.js";
import type { LoadedConfigFile } from "./config/index.js";
import { type BootstrapTermination } from "./errors.js";

export interface ParsedArgs extends ExtractorConfig {
  quiet: boolean;
  profile: boolean;
  repoName?: string;
  repoUrl?: string;
  configPath?: string;
  loadedConfig?: LoadedConfigFile;
}

export type ParseArgsResult =
  | { kind: "parsed"; parsed: ParsedArgs }
  | { kind: "termination"; termination: BootstrapTermination };

const RawOptsSchema = z.object({
  ref: z.array(z.string()).optional(),
  incremental: z.boolean(),
  outputDir: z.string().optional(),
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
  repoName: z.string().optional(),
  repoUrl: z.string().optional(),
  config: z.string().optional(),
});

export const program = new Command()
  .name("gitlode")
  .description("Extract Git commit history to JSON Lines")
  .configureOutput({
    writeErr() {
      // Intentionally suppress Commander stderr output for bootstrap errors.
      // `parseArgs()` uses `exitOverride()` and catches the resulting
      // `CommanderError`, so gitlode owns bootstrap error rendering instead of
      // forwarding the raw Commander output from here.
    },
  })
  .addArgument(new Argument("<repository-path>", "Local path to the Git repository"))
  .addHelpOption(new Option("-h, --help", "display help for command").hideHelp())
  .addOption(
    new Option(
      "-r, --ref <ref>",
      "Ref to use as traversal starting point. Accepts branch name, tag, or commit object ID. Repeatable.",
    )
      .argParser((val: string, prev: string[] | undefined) => [...(prev ?? []), val])
      .helpGroup("Required Input"),
  )
  .addOption(
    new Option(
      "--since-ref <ref>",
      "Exclude commits reachable from this ref. Accepts commit object ID (OID), tag name, or branch name. Only valid in snapshot mode.",
    ).helpGroup("Extraction Range (Snapshot Mode)"),
  )
  .addOption(
    new Option(
      "--since-date <ISO8601>",
      "Extract only commits with committer timestamp after this datetime (ISO 8601)",
    ).helpGroup("Extraction Range (Snapshot Mode)"),
  )
  .addOption(
    new Option(
      "--incremental",
      "When set, extract only commits new since the last recorded state. When absent, perform a snapshot extraction independently of prior state.",
    )
      .default(false)
      .helpGroup("Incremental Extraction"),
  )
  .addOption(
    new Option(
      "-s, --state <path>",
      "Path to state file. In snapshot mode, content is ignored but file is updated on success. Required when --incremental.",
    ).helpGroup("Incremental Extraction"),
  )
  .addOption(
    new Option(
      "--missing-state <error|snapshot>",
      'Behavior when --incremental and state file does not exist: "error" (default) exits with code 1; "snapshot" warns and falls back to full extraction. Only valid with --incremental.',
    ).helpGroup("Incremental Extraction"),
  )
  .addOption(
    new Option("-o, --output-dir <path>", "Directory to write output .jsonl files").helpGroup(
      "Output and Repository Metadata",
    ),
  )
  .addOption(
    new Option(
      "--output-prefix <string>",
      "Filename prefix for output files (derived from remote origin if omitted)",
    ).helpGroup("Output and Repository Metadata"),
  )
  .addOption(
    new Option(
      "--per-file",
      "When set, emit one record per changed file within each commit. When absent, emit one record per commit (default granularity).",
    )
      .default(false)
      .helpGroup("Output and Repository Metadata"),
  )
  .addOption(
    new Option(
      "--max-diff-size <bytes>",
      "Skip line-level diff computation for files exceeding this size (e.g. 100K, 1M). Skipped diffs are emitted with null additions/deletions counts. Default: disabled (off). Only applies with --per-file extraction mode.",
    ).helpGroup("Output and Repository Metadata"),
  )
  .addOption(
    new Option(
      "--repo-name <string>",
      "Override the repository name written to each output record (default: derived from remote origin URL or directory name)",
    ).helpGroup("Output and Repository Metadata"),
  )
  .addOption(
    new Option(
      "--repo-url <string>",
      "Override the repository URL written to each output record (default: derived from remote origin URL, or null if no remote is configured)",
    ).helpGroup("Output and Repository Metadata"),
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
  )
  .addOption(
    new Option(
      "-q, --quiet",
      "Suppress progress and summary output (for CI, cron, and scripted usage)",
    )
      .default(false)
      .helpGroup("Runtime and Diagnostics"),
  )
  .addOption(
    new Option(
      "--profile",
      "Print per-stage timing information as an aligned block to stderr after a successful extraction. Suppressed by --quiet.",
    )
      .default(false)
      .helpGroup("Runtime and Diagnostics"),
  )
  .addOption(
    new Option(
      "-c, --config <path>",
      "Path to a JSON configuration file for declaring enrichment plugins.",
    ).helpGroup("Configuration File"),
  );

class TerminationSignal extends Error {
  readonly termination: BootstrapTermination;

  constructor(termination: BootstrapTermination) {
    super(getTerminationMessage(termination));
    this.name = "TerminationSignal";
    this.termination = termination;
  }
}

function getTerminationMessage(termination: BootstrapTermination): string {
  if (termination.kind === "user-error") {
    return termination.message;
  }
  return "Bootstrap terminated successfully";
}

function userError(msg: string): never {
  throw new TerminationSignal({ kind: "user-error", message: msg, exitCode: 1 });
}

function successTermination(): never {
  throw new TerminationSignal({ kind: "success", exitCode: 0 });
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

function isCliValueProvided(name: string): boolean {
  return program.getOptionValueSource(name) === "cli";
}

export async function parseArgs(adapter: GitAdapter): Promise<ParseArgsResult> {
  try {
    program.exitOverride();
    try {
      program.parse(process.argv);
    } catch (err) {
      if (err instanceof CommanderError) {
        if (err.code === "commander.helpDisplayed") successTermination();
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

    const refsFromCli: string[] = opts.ref ?? [];
    const incremental = opts.incremental;
    const sinceRefFromCli = opts.sinceRef;
    const sinceDateFromCli = opts.sinceDate;
    const state = opts.state;
    const missingStateRaw = opts.missingState;
    const outputDirFromCli = opts.outputDir;
    const outputPrefixFromCli = opts.outputPrefix;
    const rotateLinesRaw = opts.rotateLines;
    const rotateSizeRaw = opts.rotateSize;
    const maxDiffSizeRaw = opts.maxDiffSize;
    const repoPath = program.args[0] as string | undefined;
    const quiet = opts.quiet;
    const profile = opts.profile;
    const perFile = opts.perFile;
    const repoNameFromCli = opts.repoName;
    const repoUrlFromCli = opts.repoUrl;
    const configRaw = opts.config;

    // --- Phase 1: Format and mutual exclusion checks (no I/O) ---
    if (
      missingStateRaw !== undefined &&
      missingStateRaw !== "error" &&
      missingStateRaw !== "snapshot"
    ) {
      userError('--missing-state must be "error" or "snapshot"');
    }

    if (sinceRefFromCli && sinceDateFromCli) {
      userError("--since-ref and --since-date cannot be used together");
    }
    if (incremental && sinceRefFromCli) {
      userError("--since-ref cannot be used with --incremental");
    }
    if (incremental && sinceDateFromCli) {
      userError("--since-date cannot be used with --incremental");
    }
    if (missingStateRaw !== undefined && !incremental) {
      userError("--missing-state is only valid with --incremental");
    }
    if (incremental && !state) {
      userError("--state is required when using --incremental");
    }

    let cliMaxLines: number | undefined;
    if (rotateLinesRaw !== undefined) {
      const n = Number(rotateLinesRaw);
      if (!Number.isInteger(n) || n <= 0) {
        userError("--rotate-lines must be a positive integer");
      }
      cliMaxLines = n;
    }

    let cliMaxBytes: number | undefined;
    if (rotateSizeRaw !== undefined) {
      cliMaxBytes = parseRotateSizeBytes(rotateSizeRaw);
    }

    let maxDiffSize: number | undefined;
    if (maxDiffSizeRaw !== undefined) {
      maxDiffSize = parseMaxDiffSizeBytes(maxDiffSizeRaw);
    }

    let sinceDateFromCliObj: Date | undefined;
    if (sinceDateFromCli !== undefined) {
      const d = new Date(sinceDateFromCli);
      if (isNaN(d.getTime())) {
        userError(
          "Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
        );
      }
      sinceDateFromCliObj = d;
    }

    // --- Phase 2: Config load/validation (when explicit --config is passed) ---
    let loadedConfig: LoadedConfigFile | undefined;
    let resolvedConfigPath: string | undefined;
    if (configRaw !== undefined) {
      resolvedConfigPath = resolve(configRaw);
      const loadedResult = await loadConfigFile(resolvedConfigPath);
      if (loadedResult.kind === "termination") {
        userError(loadedResult.termination.message);
      }
      loadedConfig = loadedResult.loaded;
    }

    const configExtraction = loadedConfig?.config.extraction;
    const configOutput = loadedConfig?.config.output;
    const configRepository = loadedConfig?.config.repository;
    const configRuntime = loadedConfig?.config.runtime;

    const effectiveRefs =
      refsFromCli.length > 0 ? refsFromCli : [...(configExtraction?.refs ?? [])];
    if (effectiveRefs.length === 0) {
      userError("At least one --ref must be specified");
    }

    const hasCliRange = sinceRefFromCli !== undefined || sinceDateFromCliObj !== undefined;
    const hasConfigRange = configExtraction?.range !== undefined;
    if (incremental && hasConfigRange) {
      userError("Config extraction.range cannot be used with --incremental");
    }

    const effectiveRange = hasCliRange
      ? {
          sinceRef: sinceRefFromCli,
          sinceDate: sinceDateFromCliObj,
        }
      : {
          sinceRef: configExtraction?.range?.sinceRef,
          sinceDate: configExtraction?.range?.sinceDate,
        };

    let sinceDateFromConfigObj: Date | undefined;
    if (!hasCliRange && effectiveRange.sinceDate !== undefined) {
      const d = new Date(effectiveRange.sinceDate);
      if (isNaN(d.getTime())) {
        userError(
          "Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
        );
      }
      sinceDateFromConfigObj = d;
    }

    const outputDir =
      (isCliValueProvided("outputDir") ? outputDirFromCli : configOutput?.directory) ?? "./";
    const outputPrefix = outputPrefixFromCli ?? configOutput?.prefix;
    const repoName = repoNameFromCli ?? configRepository?.name;
    const repoUrl = repoUrlFromCli ?? configRepository?.url;
    const effectiveProfile = profile || configRuntime?.profile === true;

    const configMaxLines = configOutput?.rotation?.lines;
    const configMaxBytesRaw = configOutput?.rotation?.size;
    const configMaxBytes =
      configMaxBytesRaw === undefined ? undefined : parseRotateSizeBytes(configMaxBytesRaw);
    const maxLines = cliMaxLines ?? configMaxLines;
    const maxBytes = cliMaxBytes ?? configMaxBytes;

    let effectiveSinceDateObj: Date | undefined;
    if (hasCliRange) {
      effectiveSinceDateObj = sinceDateFromCliObj;
    } else {
      effectiveSinceDateObj = sinceDateFromConfigObj;
    }

    // --- Phase 3: File system validation ---
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

    // --- Phase 4: Git validation ---
    try {
      await adapter.resolveRef(resolvedRepoPath, effectiveRefs[0]!);
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
    if (effectiveRange.sinceRef) {
      try {
        resolvedSinceRef = await adapter.resolveRef(resolvedRepoPath, effectiveRange.sinceRef);
      } catch (e) {
        if (e instanceof GitAdapterError && e.code === "REF_NOT_FOUND") {
          userError(`Ref not found: ${effectiveRange.sinceRef}`);
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
      kind: "parsed",
      parsed: {
        repositoryPath: repoPath,
        refs: effectiveRefs,
        outputDir: resolvedOutputDir,
        outputPrefix: prefix,
        rotation: { maxLines, maxBytes },
        incremental,
        missingState: incremental
          ? ((missingStateRaw ?? "error") as "error" | "snapshot")
          : undefined,
        range: resolvedSinceRef
          ? { type: "ref", ref: resolvedSinceRef }
          : effectiveSinceDateObj
            ? { type: "date", since: effectiveSinceDateObj }
            : undefined,
        stateFilePath: state,
        perFile,
        maxDiffSize,
        quiet,
        profile: effectiveProfile,
        repoName,
        repoUrl,
        configPath: resolvedConfigPath,
        loadedConfig,
      },
    };
  } catch (err) {
    if (err instanceof TerminationSignal) {
      return { kind: "termination", termination: err.termination };
    }
    throw err;
  }
}
