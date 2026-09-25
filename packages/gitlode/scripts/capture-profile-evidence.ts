import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { supportsColorStderr } from "chalk";

import {
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../test/support/performance-fixtures.js";

const execute = promisify(execFile);
const cli = resolve("packages/gitlode/dist/index.js");
const quantities = { commits: 5, files: 2, plugins: 2, rotations: 1, scale: 0 };
const temporaryPrefix = "gitlode-p3-capture-";
const executionTimeoutMs = 120_000;

const scenarios = {
  commit: { family: "commit", scope: "gitlode.execution" },
  file: { family: "file", scope: 'gitlode.line_diff@""' },
  plugin: { family: "plugin", scope: "@gitlode/performance-fixture-plugin@1.0.0" },
} as const;

type ScenarioName = keyof typeof scenarios;
type RunMode =
  | { kind: "capture" }
  | { kind: "plain"; scenario: ScenarioName }
  | { kind: "terminal"; scenario: ScenarioName };

function usage(): string {
  return [
    "Usage:",
    "  npx tsx packages/gitlode/scripts/capture-profile-evidence.ts",
    "  npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --terminal <commit|file|plugin>",
    "  npx tsx packages/gitlode/scripts/capture-profile-evidence.ts --plain <commit|file|plugin>",
  ].join("\n");
}

function parseRunMode(args: string[]): RunMode {
  if (args.length === 0) return { kind: "capture" };
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log(usage());
    process.exit(0);
  }
  if (args.length === 2 && args[0] === "--plain" && args[1] in scenarios)
    return { kind: "plain", scenario: args[1] as ScenarioName };
  if (args.length === 2 && args[0] === "--terminal" && args[1] in scenarios)
    return { kind: "terminal", scenario: args[1] as ScenarioName };
  throw new Error(`invalid arguments\n${usage()}`);
}

function scopeExcerpt(stderr: string, scope: string): string {
  const lines = stderr.split(/\r?\n/u);
  const start = lines.indexOf(`  Scope: ${scope}`);
  if (start < 0) throw new Error(`missing Scope: ${scope}`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("  Scope: "));
  return lines.slice(start, next < 0 ? undefined : next).join("\n");
}

function assertOwnedTemporaryRoot(root: string): void {
  const resolvedRoot = resolve(root);
  if (
    dirname(resolvedRoot) !== resolve(tmpdir()) ||
    !basename(resolvedRoot).startsWith(temporaryPrefix) ||
    basename(resolvedRoot).length <= temporaryPrefix.length
  )
    throw new Error(`refusing to clean unowned temporary path: ${resolvedRoot}`);
}

async function createScenario(root: string, name: ScenarioName) {
  const { family } = scenarios[name];
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
  const args = [
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
  ];
  return { args, config, output, repository };
}

async function capture(root: string, name: ScenarioName): Promise<void> {
  const fixture = await createScenario(root, name);
  const result = await execute(process.execPath, fixture.args, {
    maxBuffer: 2 * 1024 * 1024,
    timeout: executionTimeoutMs,
  });
  console.log(`=== ${name} stdout (${Buffer.byteLength(result.stdout)} bytes) ===`);
  console.log(result.stdout);
  console.log(`=== ${name} stderr excerpt ===`);
  console.log(scopeExcerpt(result.stderr, scenarios[name].scope));
}

async function capturePlain(root: string, name: ScenarioName): Promise<void> {
  const fixture = await createScenario(root, name);
  const result = await execute(process.execPath, fixture.args, {
    maxBuffer: 2 * 1024 * 1024,
    timeout: executionTimeoutMs,
  });
  console.error(`=== ${name} plain stdout (${Buffer.byteLength(result.stdout)} bytes) ===`);
  process.stdout.write(result.stdout);
  console.error(`=== ${name} plain stderr (${Buffer.byteLength(result.stderr)} bytes) ===`);
  process.stderr.write(result.stderr);
}

function environmentValue(name: string): string {
  const value = process.env[name];
  return value === undefined ? "<unset>" : JSON.stringify(value);
}

function reportTerminalEnvironment(): void {
  const color = supportsColorStderr ? `level ${supportsColorStderr.level}` : "unavailable";
  console.error(`[profile-terminal] stderr color support: ${color}`);
  console.error(
    `[profile-terminal] color environment: FORCE_COLOR=${environmentValue("FORCE_COLOR")}, TERM=${environmentValue("TERM")}, CI=${environmentValue("CI")}, COLORTERM=${environmentValue("COLORTERM")}, TERM_PROGRAM=${environmentValue("TERM_PROGRAM")}`,
  );
  if (!supportsColorStderr)
    console.error(
      "[profile-terminal] color is suppressed by terminal/environment detection; do not use this run as color evidence.",
    );
}

async function runInTerminal(
  root: string,
  name: ScenarioName,
  abortSignal: AbortSignal,
): Promise<void> {
  if (process.stdout.isTTY !== true || process.stderr.isTTY !== true)
    throw new Error(
      "real-terminal mode requires direct TTY stdout and stderr; run the command directly without piping or redirection",
    );
  reportTerminalEnvironment();
  console.error(`[profile-terminal] preparing ${name} five-commit fixture under ${root}`);
  const fixture = await createScenario(root, name);
  console.error(`[profile-terminal] repository: ${fixture.repository}`);
  console.error(`[profile-terminal] config: ${fixture.config}`);
  console.error(`[profile-terminal] JSONL output: ${fixture.output}`);
  console.error(
    `[profile-terminal] starting CLI with inherited stdout/stderr (deadline ${executionTimeoutMs / 1000}s)`,
  );
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, fixture.args, {
      signal: abortSignal,
      stdio: "inherit",
    });
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, executionTimeoutMs);
    child.once("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(deadline);
      if (code === 0) {
        resolvePromise();
        return;
      }
      if (timedOut) {
        reject(new Error(`${name} CLI exceeded the ${executionTimeoutMs / 1000}s deadline`));
        return;
      }
      reject(
        new Error(`${name} CLI exited with code ${String(code)} and signal ${String(signal)}`),
      );
    });
  });
  console.error(`[profile-terminal] ${name} completed; temporary fixture will now be removed`);
}

async function main(): Promise<void> {
  const mode = parseRunMode(process.argv.slice(2));
  const root = await mkdtemp(join(tmpdir(), temporaryPrefix));
  assertOwnedTemporaryRoot(root);
  const abortController = new AbortController();
  let cleanup: Promise<void> | undefined;
  const clean = () => {
    cleanup ??= rm(root, { recursive: true, force: true });
    return cleanup;
  };
  const interrupt = (signal: "SIGINT" | "SIGTERM") => {
    console.error(`\n[profile-terminal] received ${signal}; cleaning ${root}`);
    abortController.abort();
    void clean().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    if (mode.kind === "terminal") await runInTerminal(root, mode.scenario, abortController.signal);
    else if (mode.kind === "plain") await capturePlain(root, mode.scenario);
    else for (const name of Object.keys(scenarios) as ScenarioName[]) await capture(root, name);
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    await clean();
  }
}

main().catch((error: unknown) => {
  console.error(`[profile-terminal] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
