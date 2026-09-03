import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function buildAggregationCollectorBundle(outputDirectory: string) {
  const sourcePath = fileURLToPath(
    new URL("../../../scripts/telemetry-aggregation-child.ts", import.meta.url),
  );
  const tsdownCli = resolve(dirname(sourcePath), "../../../node_modules/tsdown/dist/run.mjs");
  await execFileAsync(
    process.execPath,
    [
      tsdownCli,
      sourcePath,
      "--out-dir",
      outputDirectory,
      "--format",
      "esm",
      "--platform",
      "node",
      "--target",
      "node22",
      "--no-dts",
      "--sourcemap",
      "false",
      "--clean",
    ],
    { cwd: resolve(dirname(sourcePath), "../../.."), windowsHide: true },
  );
  const files = (await readdir(outputDirectory, { recursive: true })).filter((file) =>
    /\.(?:js|mjs)$/.test(file),
  );
  const entry = files.find((file) =>
    /(?:^|[\\/])telemetry-aggregation-child\.(?:js|mjs)$/.test(file),
  );
  if (!entry) throw new Error(`aggregation collector entry was not generated: ${files.join(", ")}`);
  const bundlePath = resolve(outputDirectory, entry);
  const bundleParts = await Promise.all(
    files
      .sort()
      .map(async (file) =>
        Buffer.concat([Buffer.from(file), await readFile(resolve(outputDirectory, file))]),
      ),
  );
  const bytesContent = Buffer.concat(bundleParts);
  return {
    path: bundlePath,
    identity: "telemetry-aggregation-child.mjs",
    bytes: bytesContent.byteLength,
    bytesContent,
  };
}
