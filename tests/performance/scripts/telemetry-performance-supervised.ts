import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { supervisePerformance, supervisionOptions } from "./tooling/performance-supervisor.js";

async function main() {
  const { workerArgs, limits } = supervisionOptions(process.argv.slice(2));
  const directory = dirname(fileURLToPath(import.meta.url));
  const artifactIndex = workerArgs.indexOf("--artifacts");
  const artifacts =
    artifactIndex < 0 ? join(directory, "../.benchmark-artifacts") : workerArgs[artifactIndex + 1];
  if (!artifacts || artifacts.startsWith("--")) throw new Error("missing --artifacts directory");
  const result = await supervisePerformance({
    executable: process.execPath,
    args: [...process.execArgv, join(directory, "telemetry-performance.ts"), ...workerArgs],
    artifacts: resolve(artifacts),
    limits,
    onProgress: (line) => process.stderr.write(`${line}\n`),
    onFailure: (line) => process.stderr.write(`${line}\n`),
  });
  process.stderr.write(
    result.terminalEvidenceSaved
      ? `[performance] supervision artifact: ${result.artifactPath}\n`
      : `[performance] terminal supervision artifact unavailable: ${result.artifactPath}\n`,
  );
  process.exitCode = result.exitCode;
}

try {
  await main();
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? ` (${error.code.slice(0, 40)})`
      : "";
  process.stderr.write(`[performance] supervision failed before terminal evidence${code}\n`);
  process.exitCode = 2;
}
