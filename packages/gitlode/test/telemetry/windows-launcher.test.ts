import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, it } from "vitest";

import { WindowsLauncher, finite, bounds } from "../support/windows-launcher/launcher.ts";

const modes = [
  "transport",
  "launch-races",
  "orphan-normal",
  "orphan-cancel",
  "observation-loss",
  "host-death",
  "malformed",
  "driver-cleanup",
];
for (const mode of modes) {
  it.skipIf(process.platform !== "win32")(
    `standalone Windows launcher: ${mode}`,
    { timeout: bounds.test },
    async () => {
      // Include ordinary setup and both fresh hosts inside this case's timer.
      const start = performance.now();
      const evidence = resolve(
        process.env.STAGE_B_EVIDENCE ?? `.cache/windows-launcher-stage-b-${randomUUID()}`,
      );
      await mkdir(evidence, { recursive: true });
      const root = join(evidence, `${mode} spaced root`);
      await mkdir(root);
      const outer = new WindowsLauncher();
      let primary: unknown;
      let safe = false;
      let outcome: unknown;
      try {
        await finite(outer.ready, bounds.ready, "outer ready");
        const child = outer.launch(
          process.execPath,
          [
            "--import",
            pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
            resolve("packages/gitlode/test/support/windows-launcher/scenario.mjs"),
            mode,
            root,
            process.env.STAGE_B_GIT ?? "C:\\Program Files\\Git\\cmd\\git.exe",
          ],
          root,
        );
        if (mode === "driver-cleanup") {
          await finite(
            (async () => {
              for (;;) {
                try {
                  await readFile(join(root, "driver-abandoned.json"));
                  return;
                } catch (error) {
                  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
                  await new Promise<void>((resolve) => {
                    setTimeout(resolve, 10);
                  });
                }
              }
            })(),
            10000,
            "driver fault setup",
          );
          child.cancel();
        }
        const result = await finite(child.completion, bounds.operation, "outer command");
        outcome = { ...result, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
        safe = result.absent;
        expect(result.code).toBe(mode === "driver-cleanup" ? 9 : 0);
        if (mode !== "driver-cleanup") {
          const receipt: unknown = JSON.parse(await readFile(join(root, "scenario.json"), "utf8"));
          await writeFile(
            join(evidence, `${mode}-scenario.json`),
            JSON.stringify(receipt, null, 2),
          );
        }
      } catch (error) {
        primary = error;
      }
      try {
        await outer.dispose();
      } catch (error) {
        safe = false;
        primary ??= error;
      }
      // Preserve fault roots even when the independent outer owner proves cleanup is safe.
      if (
        safe &&
        !primary &&
        ["transport", "launch-races", "orphan-normal", "orphan-cancel"].includes(mode)
      )
        await rm(root, { recursive: true });
      await writeFile(
        join(evidence, `${mode}-driver.json`),
        JSON.stringify(
          {
            mode,
            elapsedMs: performance.now() - start,
            compileMs: outer.compileMs,
            hostInJob: outer.hostInJob,
            outcome,
            observedOuterAbsence: safe,
            retained:
              !safe ||
              Boolean(primary) ||
              !["transport", "launch-races", "orphan-normal", "orphan-cancel"].includes(mode),
            error: primary instanceof Error ? primary.stack : primary,
            bounds,
          },
          null,
          2,
        ),
      );
      if (primary) throw primary;
    },
  );
}
