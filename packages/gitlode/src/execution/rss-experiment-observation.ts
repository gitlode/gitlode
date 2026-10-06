import { appendFileSync } from "node:fs";
import { isMainThread, threadId } from "node:worker_threads";

export function observeRssExperiment(boundary: string, detail?: unknown): void {
  const path = process.env.GITLODE_RSS_EXPERIMENT_LOG;
  if (!path) return;
  const timestamp = new Date().toISOString();
  const memory = process.memoryUsage();
  appendFileSync(
    path,
    JSON.stringify({
      boundary,
      timestamp,
      pid: process.pid,
      threadId,
      isMainThread,
      ...memory,
      detail,
    }) + "\n",
  );
}
