import {
  loadConfigFile,
  type ConfigExtensionsSection,
  type GitAdapterName,
  type ProjectConfigurationV1,
} from "../config/index.js";
import type { MissingStatePolicy } from "../state/index.js";
import {
  dirnameOfFilePath,
  type AbsoluteDirectoryPath,
  type AbsolutePath,
  type IsoDateTimeString,
  resolveFilePath,
} from "../support/index.js";
import { program } from "./command-definition.js";
import type { BootstrapResult } from "./errors.js";
import { runFilesystemPreflight } from "./filesystem-preflight.js";
import type { ParsedCliOptions } from "./option-schema.js";
import { isCliValueProvided, parseCliOptions } from "./parse-options.js";

export type BootstrapInputRange =
  | { readonly type: "ref"; readonly since: string }
  | { readonly type: "date"; readonly since: IsoDateTimeString };

export interface BootstrapOutputRotation {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export interface BootstrapInput {
  readonly repositoryPath: AbsolutePath;
  readonly refs: readonly string[];
  readonly outputDir: AbsolutePath;
  readonly outputPrefix?: string;
  readonly rotation: BootstrapOutputRotation;
  readonly incremental: boolean;
  readonly missingState?: MissingStatePolicy;
  readonly range?: BootstrapInputRange;
  readonly stateFilePath?: AbsolutePath;
  readonly perFile: boolean;
  readonly maxDiffSize?: number;
  readonly quiet: boolean;
  readonly profile: boolean;
  readonly gitAdapter: GitAdapterName;
  readonly repoName?: string;
  readonly repoUrl?: string;
  readonly configBaseDir?: AbsoluteDirectoryPath;
  readonly extensions?: ConfigExtensionsSection;
}

function userError(message: string): BootstrapResult<never> {
  return { kind: "user-error", message, exitCode: 1 };
}

function validateOptionCombinations(args: ParsedCliOptions): BootstrapResult<true> {
  if (args.sinceRef && args.sinceDate) {
    return userError("--since-ref and --since-date cannot be used together");
  }
  if (args.incremental && args.sinceRef) {
    return userError("--since-ref cannot be used with --incremental");
  }
  if (args.incremental && args.sinceDate) {
    return userError("--since-date cannot be used with --incremental");
  }
  if (args.missingState !== undefined && !args.incremental) {
    return userError("--missing-state is only valid with --incremental");
  }
  if (args.incremental && !args.state) {
    return userError("--state is required when using --incremental");
  }
  return { kind: "success", value: true };
}

export async function loadBootstrapInput(): Promise<BootstrapResult<BootstrapInput>> {
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

  let loadedConfig: ProjectConfigurationV1 | undefined;
  let configBaseDir: AbsoluteDirectoryPath | undefined;
  if (configRaw !== undefined) {
    const resolvedConfigPath = resolveFilePath(configRaw);
    configBaseDir = dirnameOfFilePath(resolvedConfigPath);
    const loadedResult = await loadConfigFile(resolvedConfigPath);
    if (loadedResult.kind === "failure") {
      return userError(loadedResult.diagnostic.message);
    }
    loadedConfig = loadedResult.value;
  }

  const configExtraction = loadedConfig?.extraction;
  const configOutput = loadedConfig?.output;
  const configRepository = loadedConfig?.repository;
  const configRuntime = loadedConfig?.runtime;

  const effectiveRefs = refsFromCli.length > 0 ? refsFromCli : [...(configExtraction?.refs ?? [])];
  if (effectiveRefs.length === 0) {
    return userError("At least one --ref must be specified");
  }

  const hasCliRange = sinceRefFromCli !== undefined || sinceDateFromCli !== undefined;
  const hasConfigRange = configExtraction?.range !== undefined;
  if (incremental && hasConfigRange) {
    return userError("Config extraction.range cannot be used with --incremental");
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
  const effectiveGitAdapter = configRuntime?.gitAdapter ?? "isomorphic-git";

  const maxLines = cliMaxLines ?? configOutput?.rotation?.lines;
  const maxBytes = cliMaxBytes ?? configOutput?.rotation?.size;

  const filesystemResult = runFilesystemPreflight({
    repositoryPath: repoPath,
    outputDirectory: outputDir,
    statePath: state,
    incremental,
    missingState,
  });
  if (filesystemResult.kind !== "success") {
    return filesystemResult;
  }

  return {
    kind: "success",
    value: {
      repositoryPath: filesystemResult.value.repositoryPath,
      refs: effectiveRefs,
      outputDir: filesystemResult.value.outputDirectory,
      outputPrefix,
      rotation: { maxLines, maxBytes },
      incremental,
      missingState: incremental ? (missingState ?? "error") : undefined,
      range: effectiveRange.sinceRef
        ? { type: "ref", since: effectiveRange.sinceRef }
        : effectiveRange.sinceDate
          ? { type: "date", since: effectiveRange.sinceDate }
          : undefined,
      stateFilePath: filesystemResult.value.statePath,
      perFile,
      maxDiffSize,
      quiet,
      profile: effectiveProfile,
      gitAdapter: effectiveGitAdapter,
      repoName,
      repoUrl,
      configBaseDir,
      extensions: loadedConfig?.extensions,
    },
  };
}
