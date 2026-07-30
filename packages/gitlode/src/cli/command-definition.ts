import { Argument, Command, Option } from "commander";

import { packageVersion } from "../package-metadata.js";

export const program = new Command()
  .name("gitlode")
  .description("Extract Git commit history to JSON Lines")
  .configureOutput({
    writeErr() {
      // Intentionally suppress Commander stderr output for bootstrap errors.
      // `parseCliOptions()` uses `exitOverride()` and catches the resulting
      // `CommanderError`, so gitlode owns bootstrap error rendering instead of
      // forwarding the raw Commander output from here.
    },
  })
  .version(packageVersion, "-v, --version", "output the current version")
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
