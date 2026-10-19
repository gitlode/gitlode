import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { now, cutoff, remaining, until, receipt, errorIdentity } from "./deadlines.ts";
import { CaseIO } from "./io.mjs";
import { WindowsLauncher, bounds } from "./launcher.ts";

export const modes = [
  "unicode",
  "transport",
  "launch-races",
  "orphan-normal",
  "orphan-cancel",
  "observation-loss",
  "host-death",
  "malformed",
  "driver-cleanup",
];

export async function runCase(mode: string, evidence: string, campaignEnd = Infinity) {
  const start = now();
  const caseEnd = cutoff(campaignEnd, bounds.test);
  const workEnd = caseEnd - bounds.cleanup;
  const root = join(evidence, `${mode} spaced root`);
  const io = new CaseIO();
  let outer: WindowsLauncher | undefined;
  let primary: unknown, outcome: unknown;
  const secondary: unknown[] = [];
  let safe = false;
  let child: ReturnType<WindowsLauncher["launch"]> | undefined;
  let operationEnd = workEnd;
  const steps: unknown[] = [];
  // Arm before setup I/O; this owner remains live through the final receipt attempt.
  const watchdog = setTimeout(
    () => {
      void outer?.dispose(caseEnd).catch(() => {});
    },
    remaining(workEnd, Infinity),
  );
  try {
    await io.run("case mkdir", workEnd, () => mkdir(root, { recursive: true }));
    if (now() >= workEnd) throw new Error("case admission cutoff; retain root");
    outer = new WindowsLauncher();
    await until(outer.ready, cutoff(workEnd, bounds.ready), "outer ready");
    if (now() >= workEnd) throw new Error("case admission cutoff; retain root");
    operationEnd = cutoff(workEnd, bounds.operation);
    child = outer.launch(
      process.execPath,
      [
        "--import",
        pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
        resolve("packages/gitlode/test/support/windows-launcher/scenario.mjs"),
        mode,
        root,
        process.env.STAGE_B_GIT ?? "C:\\Program Files\\Git\\cmd\\git.exe",
        String(operationEnd),
      ],
      root,
    );
    if (mode === "driver-cleanup") {
      const armed = await receipt(
        join(root, "driver-abandoned.json"),
        cutoff(operationEnd - bounds.cleanup, 10000),
        "driver fault setup",
      );
      assert.equal((armed as { fault: string }).fault, "runner-timeout-armed");
      const faultEnd = cutoff(operationEnd - bounds.cleanup, 100);
      await assert.rejects(
        until(child.completion, faultEnd, "controlled runner timeout"),
        /controlled runner timeout deadline/,
      );
      steps.push({ phase: "controlled runner timeout reached", armed, atMs: now() - start });
      child.cancel();
    }
    const result = await until(child.completion, operationEnd, "outer command");
    outcome = {
      code: result.code,
      absent: result.absent,
      stdoutBytes: result.stdout.length,
      stderrBytes: result.stderr.length,
    };
    safe = result.absent;
    if (mode !== "driver-cleanup") {
      const saved = JSON.parse(
        await io.run("scenario read", workEnd, (signal: AbortSignal) =>
          readFile(join(root, "scenario.json"), { encoding: "utf8", signal }),
        ),
      ) as Record<string, unknown>;
      await io.run("scenario copy", workEnd, (signal: AbortSignal) =>
        writeFile(join(evidence, `${mode}-scenario.json`), JSON.stringify(saved, null, 2), {
          signal,
        }),
      );
      assert.equal(result.code, 0);
      assert.equal(saved.unexpected, undefined);
      if (["observation-loss", "host-death", "malformed"].includes(mode)) {
        assert.equal(saved.uncertain, true);
        assert.equal((saved.primary as { message: string }).message, `stage-b-body:${mode}`);
        assert(saved.secondary);
      } else assert.equal(saved.retained, false);
    } else assert.equal(result.code, 123);
  } catch (error) {
    primary = error;
  }
  const cleanupEnd = cutoff(caseEnd, bounds.cleanup);
  if (primary && child) {
    try {
      child.cancel();
      const result = await until(child.completion, cleanupEnd, "outer cancellation settlement");
      safe = result.absent;
    } catch (error) {
      secondary.push(error);
    }
  }
  try {
    await outer?.dispose(cleanupEnd);
  } catch (error) {
    secondary.push(error);
    primary ??= error;
    safe = false;
  }
  try {
    await io.run("case receipt", caseEnd, (signal: AbortSignal) =>
      writeFile(
        join(evidence, `${mode}-driver.json`),
        JSON.stringify(
          {
            mode,
            elapsedMs: now() - start,
            compileMs: outer?.compileMs,
            hostInJob: outer?.hostInJob,
            outcome,
            observedOuterAbsence: safe,
            retained: true,
            root,
            steps,
            events: outer?.events,
            primary: primary ? errorIdentity(primary) : undefined,
            secondary: secondary.map(errorIdentity),
            pendingIO: io.snapshot(),
            cutoffs: {
              caseEnd,
              workEnd,
              operationEnd,
              cleanupEnd,
              remainingMs: remaining(caseEnd, Infinity),
            },
            bounds,
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
    // Final I/O failure must not erase the body/cleanup outcome when the file cannot be saved.
    process.stderr.write(
      JSON.stringify({
        mode,
        phase: "case receipt failure",
        primary: errorIdentity(primary),
        secondary: secondary.map(errorIdentity),
        pendingIO: io.snapshot(),
        retained: true,
      }) + "\n",
    );
  } finally {
    clearTimeout(watchdog);
  }
  // Retain successful roots too for the bounded review; never delete historical roots.
  if (primary) throw primary;
}

export async function runOrdered(
  entries: string[],
  run: (mode: string) => Promise<void>,
  end: number,
) {
  const admitted: string[] = [];
  let primary: unknown;
  for (const mode of entries) {
    if (now() + bounds.test > end - bounds.cleanup) {
      primary = new Error("campaign admission cutoff; retain roots");
      break;
    }
    admitted.push(mode);
    try {
      await run(mode);
    } catch (error) {
      primary = error;
      break;
    }
  }
  return { admitted, unreached: entries.slice(admitted.length), primary };
}
