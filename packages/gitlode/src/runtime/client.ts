import { Worker } from "node:worker_threads";

import type { ProgressEvent } from "../core/index.js";
import type {
  WorkerDiagnosticSeverity,
  WorkerRunMessage,
  WorkerRunRequest,
  WorkerRunResult,
} from "./types.js";

export interface WorkerRunDispatchHandlers {
  readonly onProgress: (event: ProgressEvent) => void;
  readonly onDiagnostic: (severity: WorkerDiagnosticSeverity, message: string) => void;
}

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
  handlers: WorkerRunDispatchHandlers,
): Promise<WorkerRunResult> {
  return await new Promise<WorkerRunResult>((resolve) => {
    const worker = new Worker(new URL("./worker-entry.js", import.meta.url));

    let settled = false;

    const settle = (result: WorkerRunResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    worker.on("message", (value: unknown) => {
      if (!isWorkerRunMessage(value)) {
        settle(runtimeErrorResult("Worker sent an invalid message payload."));
        return;
      }

      if (value.type === "progress") {
        handlers.onProgress(value.event);
        return;
      }

      if (value.type === "diagnostic") {
        handlers.onDiagnostic(value.severity, value.message);
        return;
      }

      settle(value.result);
    });

    worker.on("error", (error) => {
      settle(runtimeErrorResult(error.message, error.stack));
    });

    worker.on("exit", (code) => {
      if (!settled && code !== 0) {
        settle(runtimeErrorResult(`Worker exited unexpectedly with code ${String(code)}.`));
      }
    });

    worker.postMessage(request);
  });
}
