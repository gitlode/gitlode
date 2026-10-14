import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { modes, runCase, runOrdered } from "./case.ts";
import { errorIdentity } from "./deadlines.ts";

const [evidence, endText] = process.argv.slice(2);
const end = Number(endText);
const { admitted, unreached, primary } = await runOrdered(
  modes,
  async (mode) => {
    await runCase(mode, evidence, end - 4000);
    process.stdout.write(JSON.stringify({ mode, status: "passed" }) + "\n");
  },
  end,
);
await writeFile(
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
);
if (primary) process.exitCode = 1;
