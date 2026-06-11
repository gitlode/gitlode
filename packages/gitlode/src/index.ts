#!/usr/bin/env node
import nodeFs from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { BootstrapInput } from "./cli/index.js";
import { loadBootstrapInput } from "./cli/index.js";
import type { ExtractionState, ProgressReporter } from "./core/index.js";
import { IsomorphicGitAdapter, JsDiffAdapter } from "./git-impl/index.js";
import { GitAdapterError } from "./git/index.js";
import {
  createBootstrapRenderer,
  createProgressRuntime,
  renderSuccessReport,
  stderrSink,
} from "./presentation/index.js";
import { createStyling } from "./presentation/progress/index.js";
import {
  assertSupportedRepositoryObjectFormat,
  dispatchWorkerRunRequest,
  type IsoDateTimeString,
  type WorkerRunInput,
} from "./runtime/index.js";
import { loadPriorState, NodeStateStore } from "./state/index.js";

function toWorkerRunInput(bootstrapInput: BootstrapInput): WorkerRunInput {
  return {
    repositoryPath: bootstrapInput.repositoryPath,
    refs: bootstrapInput.refs,
    outputDir: bootstrapInput.outputDir,
    outputPrefix: bootstrapInput.outputPrefix,
    rotation: bootstrapInput.rotation,
    range:
      bootstrapInput.range === undefined
        ? undefined
        : bootstrapInput.range.type === "ref"
          ? { type: "ref", sinceRef: bootstrapInput.range.sinceRef }
          : {
              type: "date",
              since: bootstrapInput.range.since.toISOString() as IsoDateTimeString,
            },
    perFile: bootstrapInput.perFile,
    maxDiffSize: bootstrapInput.maxDiffSize,
    profile: bootstrapInput.profile,
    repoName: bootstrapInput.repoName,
    repoUrl: bootstrapInput.repoUrl,
    configPath: bootstrapInput.configPath,
    extensions: bootstrapInput.extensions,
  };
}

async function loadPriorStateForWorker(
  bootstrapInput: BootstrapInput,
  reporter: ProgressReporter,
): Promise<ExtractionState> {
  const resolvedRepoPath = resolve(bootstrapInput.repositoryPath);
  const gitAdapter = new IsomorphicGitAdapter({
    fs: nodeFs,
    diffAdapter: new JsDiffAdapter(),
  });

  const supportedFormats = gitAdapter.supportedObjectFormats();
  const repositoryObjectFormat = await gitAdapter.getRepositoryObjectFormat(resolvedRepoPath);
  assertSupportedRepositoryObjectFormat(repositoryObjectFormat, supportedFormats);

  const stateStore = bootstrapInput.stateFilePath
    ? new NodeStateStore(bootstrapInput.stateFilePath)
    : undefined;

  return loadPriorState(
    stateStore,
    {
      incremental: bootstrapInput.incremental,
      missingState: bootstrapInput.missingState,
      stateFilePath: bootstrapInput.stateFilePath,
    },
    resolvedRepoPath,
    repositoryObjectFormat,
    reporter,
  );
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
    const priorState = await loadPriorStateForWorker(bootstrapInput, progressRuntime.reporter);

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

    if (bootstrapInput.stateFilePath && result.state.refs.length > 0) {
      const stateStore = new NodeStateStore(bootstrapInput.stateFilePath);
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
