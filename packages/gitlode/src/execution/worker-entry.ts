import { parentPort } from "node:worker_threads";

import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import { GitAdapterError } from "@gitlode/internal-contracts/git";
import type { ProgressReporter } from "@gitlode/internal-contracts/progress";

import { executeWorkerRunRequest } from "./execute-run.js";
import type { WorkerRunMessage, WorkerRunRequest, WorkerRunResult } from "./types.js";

function runtimeErrorResult(error: unknown): WorkerRunResult {
  if (error instanceof Error) {
    return {
      kind: "runtime-error",
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    kind: "runtime-error",
    message: String(error),
  };
}

function userErrorResult(error: GitAdapterError): WorkerRunResult {
  return {
    kind: "user-error",
    message: error.message,
  };
}

function postMessage(message: WorkerRunMessage): void {
  parentPort?.postMessage(message);
}

if (parentPort === null) {
  throw new Error("worker-entry must run in a worker thread.");
}

parentPort.once("message", async (request: WorkerRunRequest) => {
  const progressReporter: ProgressReporter = {
    emit(event) {
      postMessage({ type: "progress", event });
    },
  };

  const diagnosticReporter: DiagnosticReporter = {
    report(diagnostic) {
      postMessage({ type: "diagnostic", diagnostic });
    },
  };

  try {
    const result = await executeWorkerRunRequest(request, {
      progressReporter,
      diagnosticReporter,
    });
    postMessage({ type: "result", result });
  } catch (error) {
    const result =
      error instanceof GitAdapterError ? userErrorResult(error) : runtimeErrorResult(error);
    postMessage({ type: "result", result });
  }
});
