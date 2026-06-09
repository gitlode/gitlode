#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { BootstrapInput } from "./cli/args.js";
import { createBootstrapRenderer, loadBootstrapInput } from "./cli/index.js";
import { createStyling } from "./cli/progress/index.js";
import { NodeStateStore, createProgressRuntime, renderSuccessReport } from "./cli/runtime/index.js";
import { stderrSink } from "./cli/runtime/progress-runtime.js";
import { GitAdapterError } from "./git/index.js";
import { executeRuntimeSession } from "./runtime/index.js";

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
    const result = await executeRuntimeSession(bootstrapInput, {
      reporter: progressRuntime.reporter,
      renderDiagnostic: progressRuntime.presenter.renderDiagnostic.bind(progressRuntime.presenter),
    });

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
