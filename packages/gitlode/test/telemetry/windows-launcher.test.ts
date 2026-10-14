import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { it } from "vitest";

import { modes, runCase } from "../support/windows-launcher/case.ts";
import { bounds } from "../support/windows-launcher/launcher.ts";

const evidence = resolve(
  process.env.STAGE_B_EVIDENCE ?? `.cache/windows-launcher-stage-b-${randomUUID()}`,
);
let firstFailure = false;
for (const mode of modes) {
  it.skipIf(process.platform !== "win32")(
    `standalone Windows launcher: ${mode}`,
    { timeout: bounds.test },
    async (context) => {
      if (firstFailure) {
        context.skip();
        return;
      }
      try {
        await runCase(mode, evidence);
      } catch (error) {
        firstFailure = true;
        throw error;
      }
    },
  );
}
