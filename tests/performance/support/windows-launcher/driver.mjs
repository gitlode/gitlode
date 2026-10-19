// Start before filesystem work, tsx/runner bootstrap, compilation and owner startup.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

import { CaseIO } from "./io.mjs";

const now = () => Number(process.hrtime.bigint()) / 1e6;
const start = now(),
  end = start + 260000,
  workEnd = end - 4000;
const evidence = resolve(process.argv[2]);
const io = new CaseIO();
let runner,
  timedOut = false,
  primary;
const secondary = [];
function stop() {
  timedOut = true;
  for (const action of [
    () => runner?.kill(),
    () => runner?.stdout.destroy(),
    () => runner?.stderr.destroy(),
    () => runner?.unref(),
  ]) {
    try {
      action();
    } catch {
      secondary.push(new Error("runner stop failure; retain roots"));
    }
  }
}
// Remain armed through final receipt I/O. Exit never establishes I/O or job settlement.
const timer = setTimeout(stop, Math.max(0, workEnd - now()));
const finalTimer = setTimeout(
  () => {
    stop();
    process.stderr.write(
      JSON.stringify({
        phase: "driver deadline",
        settlementUnknown: true,
        pendingIO: io.snapshot(),
        retained: true,
      }) + "\n",
    );
    process.exit(1);
  },
  Math.max(0, end - now()),
);
let closed = { code: null, settlementUnknown: true };
try {
  await io.run("driver mkdir", workEnd, () => mkdir(evidence, { recursive: true }));
  if (now() >= workEnd) throw new Error("driver admission cutoff; retain roots");
  runner = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
      resolve("tests/performance/support/windows-launcher/runner.mjs"),
      evidence,
      String(end),
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  runner.stdout.pipe(process.stdout);
  runner.stderr.resume();
  closed = await io.run(
    "runner close",
    end,
    () =>
      new Promise((resolveClosed) => {
        runner.once("error", () => resolveClosed({ code: null, spawnError: true }));
        runner.once("close", (code, signal) => resolveClosed({ code, signal }));
      }),
  );
} catch (error) {
  primary = error;
  stop();
}
try {
  await io.run("driver receipt", end, (signal) =>
    writeFile(
      join(evidence, "driver.json"),
      JSON.stringify(
        {
          start,
          end,
          elapsedMs: now() - start,
          closed,
          timedOut,
          primary: primary
            ? { name: primary.name, message: "driver failure; retain roots" }
            : undefined,
          secondary: secondary.map((error) => ({
            name: error.name,
            message: "driver stop failure",
          })),
          pendingIO: io.snapshot(),
          rootDeletionAuthorized: false,
          runnerDeathIsAbsence: false,
        },
        null,
        2,
      ),
      { signal },
    ),
  );
} catch (error) {
  secondary.push(error);
  primary ??= error;
  process.stderr.write(
    JSON.stringify({
      phase: "driver receipt failure",
      closed,
      timedOut,
      secondaryCount: secondary.length,
      pendingIO: io.snapshot(),
      settlementUnknown: true,
      retained: true,
    }) + "\n",
  );
}
process.exitCode = primary || timedOut || closed.code !== 0 ? 1 : 0;
if (io.snapshot().length === 0) {
  clearTimeout(timer);
  clearTimeout(finalTimer);
}
