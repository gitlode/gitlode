import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Argument, Command, CommanderError, Option } from "commander";
import { z } from "zod";

import type { RotationConfig } from "../core/index.js";
import { MISSING_STATES } from "../core/index.js";
import { loadConfigFile } from "./config/index.js";
import type { ConfigExtensionsSection, ProjectConfigurationV1 } from "./config/index.js";
import { ROTATE_SIZE_MAX, ROTATE_SIZE_MIN } from "./consts.js";
import type { BootstrapResult, BootstrapTermination } from "./errors.js";

export type BootstrapInputRange =
  | { readonly type: "ref"; readonly sinceRef: string }
  | { readonly type: "date"; readonly since: Date };

export interface BootstrapInput {
  readonly repositoryPath: string;
  readonly refs: readonly string[];
  readonly outputDir: string;
  readonly outputPrefix?: string;
  readonly rotation: RotationConfig;
  readonly incremental: boolean;
  readonly missingState?: (typeof MISSING_STATES)[number];
  readonly range?: BootstrapInputRange;
  readonly stateFilePath?: string;
  readonly perFile: boolean;
  readonly maxDiffSize?: number;
  readonly quiet: boolean;
  readonly profile: boolean;
  repoName?: string;
  repoUrl?: string;
  configPath?: string;
  extensions?: ConfigExtensionsSection;
}

// #region Zod schemas and parsing logic

/**
 * Parse a binary size string (e.g. "100K", "1M") to bytes.
 * Supports suffixes K (1024), M (1048576), G (1073741824).

 * - minBytes - Minimum allowed value in bytes; null for no minimum
 * - maxBytes - Maximum allowed value in bytes; null for no maximum
 * - optionName - name for error messages
 */
export function byteSizeString(options?: {
  minBytes?: bigint;
  maxBytes?: bigint;
  optionName?: string;
}) {
  const optionName = options?.optionName ?? "value";
  const defaultError = `${optionName} must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)`;
  return z
    .string(defaultError)
    .min(1)
    .transform((value, ctx) => {
      const trimmed = value.trim();
      const match = /^(\d+)([kKmMgG]?)$/.exec(trimmed);
      if (!match) {
        ctx.issues.push({
          code: "custom",
          message: defaultError,
          input: value,
        });

        return z.NEVER;
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
      if (options == null) {
        return Number(bytes);
      }

      // range checks
      const { minBytes, maxBytes } = options;
      if (
        minBytes !== undefined &&
        maxBytes !== undefined &&
        (bytes < minBytes || bytes > maxBytes)
      ) {
        ctx.issues.push({
          code: "custom",
          message: `${optionName} must be between ${Number(minBytes)} and ${Number(maxBytes)} bytes`,
          input: value,
        });

        return z.NEVER;
      }
      if (minBytes !== undefined && maxBytes === undefined && bytes < minBytes) {
        ctx.issues.push({
          code: "custom",
          message: `${optionName} must be at least ${Number(minBytes)} byte`,
          input: value,
        });

        return z.NEVER;
      }
      if (minBytes === undefined && maxBytes !== undefined && bytes > maxBytes) {
        ctx.issues.push({
          code: "custom",
          message: `${optionName} must be at most ${Number(maxBytes)} bytes`,
          input: value,
        });

        return z.NEVER;
      }

      return Number(bytes);
    });
}

export function positiveIntegerString(error?: string) {
  return z
    .string({
      error,
    })
    .transform((value, ctx) => {
      const trimmed = value.trim();

      if (!/^[1-9]\d*$/.test(trimmed)) {
        ctx.issues.push({
          code: "custom",
          message: error,
          input: value,
        });

        return z.NEVER;
      }

      const parsed = Number(trimmed);

      if (!Number.isSafeInteger(parsed)) {
        ctx.issues.push({
          code: "custom",
          message: error,
          input: value,
        });

        return z.NEVER;
      }

      return parsed;
    });
}

const CommandArgsSchema = z.object({
  ref: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .transform((val) => val ?? []),
  incremental: z.boolean(),
  outputDir: z.string().min(1).optional(),
  outputPrefix: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  missingState: z
    .enum(MISSING_STATES, {
      error: `--missing-states must be one of the following values: ${MISSING_STATES.join(", ")}`,
    })
    .optional(),
  sinceRef: z.string().min(1).optional(),
  sinceDate: z.iso
    .datetime({
      offset: true,
      error: "Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
    })
    .transform((value) => new Date(value))
    .optional(),
  rotateLines: positiveIntegerString("--rotate-lines must be a positive integer").optional(),
  rotateSize: byteSizeString({
    minBytes: ROTATE_SIZE_MIN,
    maxBytes: ROTATE_SIZE_MAX,
    optionName: "--rotate-size",
  }).optional(),
  maxDiffSize: byteSizeString({ minBytes: 1n, optionName: "--max-diff-size" }).optional(),
  quiet: z.boolean(),
  profile: z.boolean(),
  perFile: z.boolean(),
  repoName: z.string().min(1).optional(),
  repoUrl: z.string().min(1).optional(),
  config: z.string().min(1).optional(),
});

// #endregion

// #region Commander Command

export const program = new Command()
  .name("gitlode")
  .description("Extract Git commit history to JSON Lines")
  .configureOutput({
    writeErr() {
      // Intentionally suppress Commander stderr output for bootstrap errors.
      // `loadBootstrapInput()` uses `exitOverride()` and catches the resulting
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

// #endregion

// #region module local Error

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
  throw new TerminationSignal({ kind: "success-terminate", exitCode: 0 });
}

// #endregion

function isCliValueProvided(name: string): boolean {
  return program.getOptionValueSource(name) === "cli";
}

type ParsedCliOptions = z.infer<typeof CommandArgsSchema>;

async function parseCliOptions(): Promise<BootstrapResult<ParsedCliOptions>> {
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

    let parsedCliOptions: ParsedCliOptions;
    try {
      parsedCliOptions = CommandArgsSchema.parse(program.opts());
    } catch (err) {
      if (err instanceof z.ZodError) {
        userError(err.issues[0]?.message ?? "Invalid CLI options");
      }
      throw err;
    }

    return { kind: "success", value: parsedCliOptions };
  } catch (err) {
    if (err instanceof TerminationSignal) {
      return err.termination;
    }
    throw err;
  }
}

function validateOptionCombinations(args: ParsedCliOptions): BootstrapResult<true> {
  if (args.sinceRef && args.sinceDate) {
    return {
      kind: "user-error",
      message: "--since-ref and --since-date cannot be used together",
      exitCode: 1,
    };
  }
  if (args.incremental && args.sinceRef) {
    return {
      kind: "user-error",
      message: "--since-ref cannot be used with --incremental",
      exitCode: 1,
    };
  }
  if (args.incremental && args.sinceDate) {
    return {
      kind: "user-error",
      message: "--since-date cannot be used with --incremental",
      exitCode: 1,
    };
  }
  if (args.missingState !== undefined && !args.incremental) {
    return {
      kind: "user-error",
      message: "--missing-state is only valid with --incremental",
      exitCode: 1,
    };
  }
  if (args.incremental && !args.state) {
    return {
      kind: "user-error",
      message: "--state is required when using --incremental",
      exitCode: 1,
    };
  }
  return { kind: "success", value: true };
}

export async function loadBootstrapInput(): Promise<BootstrapResult<BootstrapInput>> {
  try {
    const parsedCommandArgsResult = await parseCliOptions();
    if (parsedCommandArgsResult.kind !== "success") {
      return parsedCommandArgsResult;
    }

    const parsedCommandArgs = parsedCommandArgsResult.value;

    const checkResult = validateOptionCombinations(parsedCommandArgs);
    if (checkResult.kind !== "success") {
      return checkResult;
    }

    const refsFromCli = parsedCommandArgs.ref;
    const incremental = parsedCommandArgs.incremental;
    const sinceRefFromCli = parsedCommandArgs.sinceRef;
    const sinceDateFromCli = parsedCommandArgs.sinceDate;
    const state = parsedCommandArgs.state;
    const missingState = parsedCommandArgs.missingState;
    const outputDirFromCli = parsedCommandArgs.outputDir;
    const outputPrefixFromCli = parsedCommandArgs.outputPrefix;
    const cliMaxLines = parsedCommandArgs.rotateLines;
    const cliMaxBytes = parsedCommandArgs.rotateSize;
    const maxDiffSize = parsedCommandArgs.maxDiffSize;
    const repoPath = program.args[0] as string | undefined;
    const quiet = parsedCommandArgs.quiet;
    const profile = parsedCommandArgs.profile;
    const perFile = parsedCommandArgs.perFile;
    const repoNameFromCli = parsedCommandArgs.repoName;
    const repoUrlFromCli = parsedCommandArgs.repoUrl;
    const configRaw = parsedCommandArgs.config;

    // --- Phase 2: Config load/validation (when explicit --config is passed) ---
    let loadedConfig: ProjectConfigurationV1 | undefined;
    let resolvedConfigPath: string | undefined;
    if (configRaw !== undefined) {
      resolvedConfigPath = resolve(configRaw);
      const loadedResult = await loadConfigFile(resolvedConfigPath);
      if (loadedResult.kind !== "success") {
        return loadedResult;
      }
      loadedConfig = loadedResult.value;
    }

    const configExtraction = loadedConfig?.extraction;
    const configOutput = loadedConfig?.output;
    const configRepository = loadedConfig?.repository;
    const configRuntime = loadedConfig?.runtime;

    const effectiveRefs =
      refsFromCli.length > 0 ? refsFromCli : [...(configExtraction?.refs ?? [])];
    if (effectiveRefs.length === 0) {
      userError("At least one --ref must be specified");
    }

    const hasCliRange = sinceRefFromCli !== undefined || sinceDateFromCli !== undefined;
    const hasConfigRange = configExtraction?.range !== undefined;
    if (incremental && hasConfigRange) {
      userError("Config extraction.range cannot be used with --incremental");
    }

    const effectiveRange = hasCliRange
      ? {
          sinceRef: sinceRefFromCli,
          sinceDate: sinceDateFromCli,
        }
      : {
          sinceRef: configExtraction?.range?.sinceRef,
          sinceDate: configExtraction?.range?.sinceDate,
        };

    const outputDir =
      (isCliValueProvided("outputDir") ? outputDirFromCli : configOutput?.directory) ?? "./";
    const outputPrefix = outputPrefixFromCli ?? configOutput?.prefix;
    const repoName = repoNameFromCli ?? configRepository?.name;
    const repoUrl = repoUrlFromCli ?? configRepository?.url;
    const effectiveProfile = profile || configRuntime?.profile === true;

    const configMaxLines = configOutput?.rotation?.lines;
    const configMaxBytes = configOutput?.rotation?.size;
    const maxLines = cliMaxLines ?? configMaxLines;
    const maxBytes = cliMaxBytes ?? configMaxBytes;

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
      if (incremental && missingState !== "snapshot" && !existsSync(resolvedStatePath)) {
        userError(`State file not found: ${resolvedStatePath}`);
      }
    }

    return {
      kind: "success",
      value: {
        repositoryPath: repoPath,
        refs: effectiveRefs,
        outputDir: resolvedOutputDir,
        outputPrefix,
        rotation: { maxLines, maxBytes },
        incremental,
        missingState: incremental ? ((missingState ?? "error") as "error" | "snapshot") : undefined,
        range: effectiveRange.sinceRef
          ? { type: "ref", sinceRef: effectiveRange.sinceRef }
          : effectiveRange.sinceDate
            ? { type: "date", since: effectiveRange.sinceDate }
            : undefined,
        stateFilePath: state,
        perFile,
        maxDiffSize,
        quiet,
        profile: effectiveProfile,
        repoName,
        repoUrl,
        configPath: resolvedConfigPath,
        extensions: loadedConfig?.extensions,
      },
    };
  } catch (err) {
    if (err instanceof TerminationSignal) {
      return err.termination;
    }
    throw err;
  }
}
