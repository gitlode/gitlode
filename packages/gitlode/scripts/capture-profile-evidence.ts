import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../test/support/performance-fixtures.js";

const execute = promisify(execFile);
const cli = resolve("packages/gitlode/dist/index.js");
const quantities = { commits: 5, files: 2, plugins: 2, rotations: 1, scale: 0 };
const root = await mkdtemp(join(tmpdir(), "gitlode-p3-capture-"));

function scopeExcerpt(stderr: string, scope: string): string {
  const lines = stderr.split(/\r?\n/u);
  const start = lines.indexOf(`  Scope: ${scope}`);
  if (start < 0) throw new Error(`missing Scope: ${scope}`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("  Scope: "));
  return lines.slice(start, next < 0 ? undefined : next).join("\n");
}

async function capture(
  name: string,
  family: "commit" | "file" | "plugin",
  scope: string,
): Promise<void> {
  const repository = join(root, name);
  const output = join(root, `${name}-output`);
  await mkdir(output);
  await createPerformanceRepository(
    repository,
    family === "commit" ? "commit_heavy_repository" : "file_heavy_repository",
    quantities,
  );
  let config = join(repository, "gitlode.config.json");
  if (family === "plugin")
    config = (await createPluginProjectionFixture(repository, quantities)).configPath;
  else
    await writeFile(
      config,
      JSON.stringify({ version: 1, runtime: { gitAdapter: "isomorphic-git" } }),
    );
  const result = await execute(
    process.execPath,
    [
      cli,
      "--profile",
      "--ref",
      "main",
      "--output-dir",
      output,
      "--config",
      config,
      ...(family === "commit" ? [] : ["--per-file"]),
      repository,
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  console.log(`=== ${name} stdout (${Buffer.byteLength(result.stdout)} bytes) ===`);
  console.log(result.stdout);
  console.log(`=== ${name} stderr excerpt ===`);
  console.log(scopeExcerpt(result.stderr, scope));
}

try {
  await capture("commit", "commit", "gitlode.execution");
  await capture("file", "file", 'gitlode.line_diff@""');
  await capture("plugin", "plugin", "@gitlode/performance-fixture-plugin@1.0.0");
} finally {
  await rm(root, { recursive: true, force: true });
}
