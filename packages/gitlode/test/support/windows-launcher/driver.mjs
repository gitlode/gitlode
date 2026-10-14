// Start before tsx/runner bootstrap, compilation and owner startup.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const start = Number(process.hrtime.bigint()) / 1e6;
const end = start + 260000;
const evidence = resolve(process.argv[2]);
await mkdir(evidence, { recursive: true });
let timedOut = false;
const runner = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
    resolve("packages/gitlode/test/support/windows-launcher/runner.mjs"),
    evidence,
    String(end),
  ],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
runner.stdout.pipe(process.stdout);
runner.stderr.resume();
const timer = setTimeout(
  () => {
    timedOut = true;
    // Runner death cannot establish absence. Retain all roots when an independent owner is lost.
    runner.kill();
  },
  Math.max(0, end - 4000 - Number(process.hrtime.bigint()) / 1e6),
);
let finalTimer;
const closed = await Promise.race([
  new Promise((resolveClosed) => {
    runner.once("error", () => resolveClosed({ code: null, spawnError: true }));
    runner.once("close", (code, signal) => resolveClosed({ code, signal }));
  }),
  new Promise((resolveClosed) => {
    finalTimer = setTimeout(
      () => {
        timedOut = true;
        runner.kill();
        runner.stdout.destroy();
        runner.stderr.destroy();
        runner.unref();
        resolveClosed({ code: null, settlementUnknown: true });
      },
      Math.max(0, end - Number(process.hrtime.bigint()) / 1e6),
    );
  }),
]);
clearTimeout(timer);
clearTimeout(finalTimer);
await writeFile(
  join(evidence, "driver.json"),
  JSON.stringify(
    {
      start,
      end,
      elapsedMs: Number(process.hrtime.bigint()) / 1e6 - start,
      closed,
      timedOut,
      rootDeletionAuthorized: false,
      runnerDeathIsAbsence: false,
    },
    null,
    2,
  ),
);
process.exitCode = timedOut || closed.code !== 0 ? 1 : 0;
