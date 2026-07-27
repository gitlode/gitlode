#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { BootstrapInput } from "./cli/index.js";
import { loadBootstrapInput } from "./cli/index.js";
import { executeRun, type ExecutionRunInput } from "./execution/index.js";
import { GitAdapterError } from "./git/index.js";
import {
  createBootstrapRenderer,
  createProgressRuntime,
  renderSuccessReport,
  stderrSink,
} from "./presentation/index.js";
import { createStyling } from "./presentation/progress/index.js";

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
    missingState: bootstrapInput.missingState,
    stateFilePath: bootstrapInput.stateFilePath,
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
      bootstrapRenderer.renderTermination(parseResult);
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
      onProgress(event) {
        progressRuntime.reporter.emit(event);
      },
      onDiagnostic(severity, message) {
        progressRuntime.presenter.renderDiagnostic(severity, message);
      },
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
      success: result.success,
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
  return pathToFileURL(argvEntry).href === import.meta.url;
}

if (shouldRunAsCli()) {
  main().catch((error) => {
    process.stderr.write(
      (error instanceof Error ? (error.stack ?? error.message) : String(error)) + "\n",
    );
    process.exit(2);
  });
}
