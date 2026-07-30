import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { checkPackage, createPackageFromTarballData } from "@arethetypeswrong/core";

const packageRoot = resolve(import.meta.dirname, "..");
const ignoredResolutionKinds = new Set(["node10", "node16-cjs"]);

function run(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const npmExecutable = process.env["npm_execpath"];
    const executable = command === "npm" && npmExecutable ? process.execPath : command;
    const commandArgs = command === "npm" && npmExecutable ? [npmExecutable, ...args] : args;
    const child = spawn(executable, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolveOutput(stdout);
      else reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stderr}`));
    });
  });
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "gitlode-attw-"));
try {
  const packOutput = await run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", temporaryDirectory],
    packageRoot,
  );
  const [{ filename }] = JSON.parse(packOutput) as [{ filename: string }];
  const tarballPath = join(temporaryDirectory, basename(filename));
  const result = await checkPackage(
    createPackageFromTarballData(new Uint8Array(await readFile(tarballPath))),
    { entrypoints: [".", "./plugin-api"] },
  );
  if (!result.types) throw new Error("Are the Types Wrong reported that the package has no types");

  const problems = result.problems.filter(
    (problem) =>
      !("resolutionKind" in problem) || !ignoredResolutionKinds.has(problem.resolutionKind),
  );
  if (problems.length > 0) {
    throw new Error(
      `Are the Types Wrong ESM-only validation failed:\n${JSON.stringify(problems, null, 2)}`,
    );
  }
  process.stdout.write("Are the Types Wrong ESM-only validation passed.\n");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
