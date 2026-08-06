import { Worker } from "node:worker_threads";

import type {
  ExecutionRunReporters,
  WorkerRunMessage,
  WorkerRunRequest,
  WorkerRunResult,
} from "./types.js";

function runtimeErrorResult(message: string, stack?: string): WorkerRunResult {
  return {
    kind: "runtime-error",
    message,
    stack,
  };
}

function isWorkerRunMessage(value: unknown): value is WorkerRunMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const msg = value as { type?: unknown };
  return msg.type === "progress" || msg.type === "diagnostic" || msg.type === "result";
}

export async function dispatchWorkerRunRequest(
  request: WorkerRunRequest,
  reporters: ExecutionRunReporters,
): Promise<WorkerRunResult> {
  return await new Promise<WorkerRunResult>((resolve) => {
    const worker = new Worker(new URL("./worker-entry.js", import.meta.url));

    let settled = false;
    let resultReceived = false;

    const settle = (result: WorkerRunResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      void worker.terminate();
      resolve(result);
    };

    worker.on("message", (value: unknown) => {
      if (!isWorkerRunMessage(value)) {
        settle(runtimeErrorResult("Worker sent an invalid message payload."));
        return;
      }

      if (value.type === "progress") {
        reporters.progressReporter.emit(value.event);
        return;
      }

      if (value.type === "diagnostic") {
        reporters.diagnosticReporter.report(value.diagnostic);
        return;
      }

      resultReceived = true;
      settle(value.result);
    });

    worker.on("error", (error) => {
      settle(runtimeErrorResult(error.message, error.stack));
    });

    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        settle(runtimeErrorResult(`Worker exited unexpectedly with code ${String(code)}.`));
        return;
      }

      if (!settled && code === 0 && !resultReceived) {
        settle(runtimeErrorResult("Worker exited without returning a result message."));
      }
    });

    worker.postMessage(request);
  });
}
