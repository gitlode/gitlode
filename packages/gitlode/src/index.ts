#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { BootstrapInput } from "./cli/index.js";
import { loadBootstrapInput } from "./cli/index.js";
import type { ExtractionState } from "./core/index.js";
import { GitAdapterError } from "./git/index.js";
import {
  createBootstrapRenderer,
  createProgressRuntime,
  renderSuccessReport,
  stderrSink,
} from "./presentation/index.js";
import { createStyling } from "./presentation/progress/index.js";
import { dispatchWorkerRunRequest, type WorkerRunInput } from "./runtime/index.js";
import { loadExtractionState, NodeStateStore } from "./state/index.js";
import { createEmptyState } from "./state/state-store.js";

function toWorkerRunInput(bootstrapInput: BootstrapInput): WorkerRunInput {
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
    repoName: bootstrapInput.repoName,
    repoUrl: bootstrapInput.repoUrl,
    configBaseDir: bootstrapInput.configBaseDir,
    extensions: bootstrapInput.extensions,
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
    const stateStore = bootstrapInput.stateFilePath
      ? new NodeStateStore(bootstrapInput.stateFilePath)
      : undefined;

    let priorState: ExtractionState;
    if (!stateStore || !bootstrapInput.incremental) {
      priorState = createEmptyState(bootstrapInput.repositoryPath);
    } else {
      const loadedState = await loadExtractionState(stateStore);
      if (loadedState === undefined) {
        if (bootstrapInput.missingState === "error") {
          throw new Error(`State file not found: ${bootstrapInput.stateFilePath}`);
        }
        progressRuntime.reporter.emit({
          type: "warning",
          message: `State file not found: ${bootstrapInput.stateFilePath}. Falling back to full snapshot extraction.`,
        });
        priorState = createEmptyState(bootstrapInput.repositoryPath);
      } else {
        priorState = loadedState;
      }
    }

    const result = await dispatchWorkerRunRequest(
      {
        input: toWorkerRunInput(bootstrapInput),
        priorState,
      },
      {
        onProgress(event) {
          progressRuntime.reporter.emit(event);
        },
        onDiagnostic(severity, message) {
          progressRuntime.presenter.renderDiagnostic(severity, message);
        },
      },
    );

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

    if (stateStore !== undefined && result.state.refs.length > 0) {
      await stateStore.write(result.state);
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
