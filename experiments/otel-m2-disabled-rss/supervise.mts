import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { supervisePerformance, SUPERVISION_DEFAULTS } from "../../packages/gitlode/scripts/tooling/performance-supervisor.js";
import { writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../../..");
const args = process.argv.slice(2);
const preflight = args[0] === "preflight";
const label = preflight ? "supervision-preflight" : args[0] === "prepare" ? "prepare" : `run-${args[1]}`;
const result = await supervisePerformance({ executable: process.execPath, args: [...process.execArgv, join(directory, preflight ? "preflight-worker.mts" : "driver.mts"), ...args], artifacts: join(root, "evidence", label), limits: { ...SUPERVISION_DEFAULTS, executionMs: preflight ? 2000 : 300000, processingMs: 300000 }, onProgress: line => console.error(line), onFailure: line => console.error(line) });
await writeFile(join(root, "evidence", `${label}-supervisor-result.json`), JSON.stringify(result, null, 2));
const terminal = JSON.parse(await readFile(result.artifactPath, "utf8"));
assert.equal(terminal.cleanupConfirmed, true);
assert.deepEqual(terminal.cleanupErrors, []);
assert.equal(result.terminalEvidenceSaved, true);
if (preflight) {
  assert.equal(result.status, "inconclusive");
  assert.match(result.failure ?? "", /deadline/);
  console.log("Detached supervision deadline/cleanup preflight passed");
} else {
  process.exitCode = result.exitCode;
}
