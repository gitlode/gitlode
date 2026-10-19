import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { modes, runCase, runOrdered } from "./case.ts";
import { errorIdentity } from "./deadlines.ts";
import { CaseIO } from "./io.mjs";

const [evidence, endText] = process.argv.slice(2);
const end = Number(endText);
const io = new CaseIO();
const { admitted, unreached, primary } = await runOrdered(
  modes,
  async (mode) => {
    await runCase(mode, evidence, end - 4000);
    process.stdout.write(JSON.stringify({ mode, status: "passed" }) + "\n");
  },
  end,
);
try {
  await io.run("campaign receipt", end, (signal) =>
    writeFile(
      join(evidence, "campaign.json"),
      JSON.stringify(
        {
          admitted,
          unreached,
          primary: primary ? errorIdentity(primary) : undefined,
          status: primary ? "incomplete" : "independent-review-pending",
          end,
        },
        null,
        2,
      ),
      { signal },
    ),
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      phase: "campaign receipt failure",
      admitted,
      unreached,
      primary: primary ? errorIdentity(primary) : undefined,
      secondary: { name: error.name, message: "receipt I/O failure; retain roots" },
      pendingIO: io.snapshot(),
      retained: true,
    }) + "\n",
  );
  process.exitCode = 1;
}
if (primary) process.exitCode = 1;
