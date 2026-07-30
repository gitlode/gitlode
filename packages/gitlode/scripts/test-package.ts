import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = new URL("..", import.meta.url);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "gitlode-package-"));
try {
  const { stdout } = await exec(
    "npm",
    ["pack", "--json", "--pack-destination", temporaryDirectory],
    { cwd: root },
  );
  const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
  await writeFile(join(temporaryDirectory, "package.json"), '{"private":true,"type":"module"}\n');
  await exec("npm", ["install", "--ignore-scripts", join(temporaryDirectory, filename)], {
    cwd: temporaryDirectory,
  });
  const bin = join(temporaryDirectory, "node_modules", ".bin", "gitlode");
  await exec(bin, ["--help"], { cwd: temporaryDirectory });
  const { stdout: version } = await exec(bin, ["--version"], { cwd: temporaryDirectory });
  if (version.trim() !== "0.11.0") throw new Error(`Unexpected CLI version: ${version}`);
  const entry = join(temporaryDirectory, "node_modules", "gitlode", "dist", "index.js");
  if (!(await readFile(entry, "utf8")).startsWith("#!/usr/bin/env node"))
    throw new Error("Installed CLI has no shebang");
  await exec(
    process.execPath,
    ["--input-type=module", "--eval", 'await import("gitlode/plugin-api")'],
    { cwd: temporaryDirectory },
  );
  console.log(`Packed artifact passed smoke tests in ${temporaryDirectory}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
