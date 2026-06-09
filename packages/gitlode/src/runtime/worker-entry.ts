import { parentPort } from "node:worker_threads";

import type { ProgressReporter } from "../core/index.js";
import { GitAdapterError } from "../git/index.js";
import { executeWorkerRunRequest } from "./execution.js";
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
  const reporter: ProgressReporter = {
    emit(event) {
      postMessage({ type: "progress", event });
    },
  };

  const renderDiagnostic = (severity: "warn" | "error", message: string): void => {
    postMessage({ type: "diagnostic", severity, message });
  };

  try {
    const result = await executeWorkerRunRequest(request, {
      reporter,
      renderDiagnostic,
    });
    postMessage({ type: "result", result });
  } catch (error) {
    const result =
      error instanceof GitAdapterError ? userErrorResult(error) : runtimeErrorResult(error);
    postMessage({ type: "result", result });
  }
});
