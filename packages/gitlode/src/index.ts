#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { GitAdapterError } from "@gitlode/internal-contracts/git";

import type { BootstrapInput } from "./cli/index.js";
import { loadBootstrapInput } from "./cli/index.js";
import {
  executeRun,
  type ExecutionRunInput,
  type ExecutionSuccessPayload,
  type MissingStatePolicy,
} from "./execution/index.js";
import {
  createBootstrapRenderer,
  createProgressRuntime,
  createStyling,
  renderSuccessReport,
  stderrSink,
  type SuccessReportData,
} from "./presentation/index.js";

function toExecutionMissingStatePolicy(
  option: BootstrapInput["missingState"],
): MissingStatePolicy | undefined {
  switch (option) {
    case undefined:
      return undefined;
    case "error":
      return "error";
    case "snapshot":
      return "snapshot";
    default:
      return option satisfies never;
  }
}

function toExecutionRunInput(bootstrapInput: BootstrapInput): ExecutionRunInput {
  return {
    repositoryPath: bootstrapInput.repositoryPath,
    refs: bootstrapInput.refs,
    outputDir: bootstrapInput.outputDir,
    outputPrefix: bootstrapInput.outputPrefix,
    rotation: bootstrapInput.rotation,
    range: bootstrapInput.range,
    granularity: bootstrapInput.perFile ? "file" : "commit",
    maxDiffSize: bootstrapInput.maxDiffSize,
    profile: bootstrapInput.profile,
    gitAdapter: bootstrapInput.gitAdapter,
    repoName: bootstrapInput.repoName,
    repoUrl: bootstrapInput.repoUrl,
    pluginBaseDirectory: bootstrapInput.configBaseDir,
    pluginDeclarations: bootstrapInput.extensions,
    incremental: bootstrapInput.incremental,
    missingState: toExecutionMissingStatePolicy(bootstrapInput.missingState),
    stateFilePath: bootstrapInput.stateFilePath,
  };
}

function toSuccessReportData(success: ExecutionSuccessPayload): SuccessReportData {
  return {
    recordsWritten: success.recordsWritten,
    commitsTraversed: success.commitsTraversed,
    filesCreated: success.filesCreated,
    bytesWritten: success.bytesWritten,
    elapsedMs: success.elapsedMs,
    refs: success.refs,
    profileReport: success.profileReport,
  };
}

async function main(): Promise<void> {
  const isTTY = process.stderr.isTTY === true;
  const styling = createStyling(isTTY);
  const bootstrapRenderer = createBootstrapRenderer(stderrSink);

  let bootstrapInput: BootstrapInput;
  try {
    const parseResult = await loadBootstrapInput();
    if (parseResult.kind !== "success") {
      if (parseResult.kind === "user-error") {
        bootstrapRenderer.renderUserError(parseResult.message);
      }
      process.exitCode = parseResult.exitCode;
      return;
    }
    bootstrapInput = parseResult.value;
  } catch (error) {
    bootstrapRenderer.renderRuntimeError(error);
    process.exitCode = 2;
    return;
  }

  const progressRuntime = createProgressRuntime({
    sink: stderrSink,
    clock: {
      nowMs() {
        return performance.now();
      },
    },
    scheduler: {
      setInterval(fn, ms) {
        const intervalId = setInterval(fn, ms);
        return () => clearInterval(intervalId);
      },
    },
    quiet: bootstrapInput.quiet,
    isTTY,
    styling,
  });

  try {
    const result = await executeRun(toExecutionRunInput(bootstrapInput), {
      progressReporter: progressRuntime.progressReporter,
      diagnosticReporter: progressRuntime.diagnosticReporter,
    });

    if (result.kind === "runtime-error") {
      progressRuntime.presenter.renderRuntimeError(
        result.stack ? new Error(`${result.message}\n${result.stack}`) : new Error(result.message),
      );
      process.exitCode = 2;
      return;
    }

    if (result.kind === "user-error") {
      progressRuntime.presenter.renderUserError(result.message);
      process.exitCode = 1;
      return;
    }

    renderSuccessReport({
      presenter: progressRuntime.presenter,
      quiet: bootstrapInput.quiet,
      profile: bootstrapInput.profile,
      data: toSuccessReportData(result.success),
    });
  } catch (error) {
    if (error instanceof GitAdapterError) {
      progressRuntime.presenter.renderUserError(error.message);
      process.exitCode = 1;
      return;
    }

    progressRuntime.presenter.renderRuntimeError(error);
    process.exitCode = 2;
  }
}

function shouldRunAsCli(): boolean {
  const argvEntry = process.argv[1];
  if (!argvEntry) {
    return false;
  }

  try {
    return realpathSync(argvEntry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (shouldRunAsCli()) {
  main().catch((error) => {
    process.stderr.write(
      (error instanceof Error ? (error.stack ?? error.message) : String(error)) + "\n",
    );
    process.exit(2);
  });
}
