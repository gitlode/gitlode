import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type PackResult = {
  filename: string;
};

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const packageManifest = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
) as { version: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = {},
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const npmExecutable = process.env["npm_execpath"];
    const executable = command === "npm" && npmExecutable ? process.execPath : command;
    const commandArgs = command === "npm" && npmExecutable ? [npmExecutable, ...args] : args;
    const child = spawn(executable, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...environment, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveResult({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed (${code})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
  });
}

function runInstalledGitlode(args: string[], cwd: string): Promise<CommandResult> {
  return run("npm", ["exec", "--", "gitlode", ...args], cwd);
}

async function readJsonLines(directory: string): Promise<Record<string, unknown>[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".jsonl"));
  assert(files.length > 0, `No JSONL output was produced in ${directory}`);
  const records: Record<string, unknown>[] = [];
  for (const file of files) {
    const contents = await readFile(join(directory, file), "utf8");
    records.push(
      ...contents
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    );
  }
  return records;
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "gitlode-installed-package-"));
assert(
  isAbsolute(temporaryRoot) && relative(repositoryRoot, temporaryRoot).startsWith(".."),
  "Installed-package system test directory must be outside the monorepo",
);

try {
  const packDirectory = join(temporaryRoot, "pack");
  const consumerDirectory = join(temporaryRoot, "consumer");
  const repositoryDirectory = join(temporaryRoot, "repository");
  const isomorphicOutputDirectory = join(temporaryRoot, "output-isomorphic");
  const cliOutputDirectory = join(temporaryRoot, "output-git-cli");
  await Promise.all([
    mkdir(packDirectory),
    mkdir(consumerDirectory),
    mkdir(repositoryDirectory),
    mkdir(isomorphicOutputDirectory),
    mkdir(cliOutputDirectory),
  ]);

  const packCommand = await run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", packDirectory],
    packageRoot,
  );
  const [packResult] = JSON.parse(packCommand.stdout) as PackResult[];
  assert(packResult !== undefined, "npm pack did not return package metadata");
  const tarballPath = join(packDirectory, basename(packResult.filename));

  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({ name: "gitlode-system-test-consumer", private: true, type: "module" })}\n`,
  );
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath, "typescript@^7.0.2"],
    consumerDirectory,
  );

  const help = await runInstalledGitlode(["--help"], consumerDirectory);
  assert(help.stdout.includes("Extract Git commit history"), "Installed CLI help failed");
  const version = await runInstalledGitlode(["--version"], consumerDirectory);
  assert(
    version.stdout.trim() === packageManifest.version,
    `Unexpected installed CLI version: ${version.stdout}`,
  );

  const installedSchema = join(
    consumerDirectory,
    "node_modules",
    "gitlode",
    "schemas",
    "config-v1.schema.json",
  );
  await access(installedSchema);
  const schema = JSON.parse(await readFile(installedSchema, "utf8")) as { title?: unknown };
  assert(schema.title === "gitlode configuration v1", "Published configuration schema is invalid");

  await run("git", ["init", "-b", "main"], repositoryDirectory);
  await run("git", ["config", "user.name", "Package Test"], repositoryDirectory);
  await run("git", ["config", "user.email", "package-test@example.com"], repositoryDirectory);
  await writeFile(join(repositoryDirectory, "sample.txt"), "first\nsecond\n");
  await run("git", ["add", "sample.txt"], repositoryDirectory);
  await run("git", ["commit", "-m", "initial"], repositoryDirectory, {
    GIT_AUTHOR_DATE: "2020-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z",
  });
  await writeFile(join(repositoryDirectory, "sample.txt"), "first\nchanged\nthird\n");
  await run("git", ["add", "sample.txt"], repositoryDirectory);
  await run("git", ["commit", "-m", "modify sample"], repositoryDirectory, {
    GIT_AUTHOR_DATE: "2020-01-02T00:00:00Z",
    GIT_COMMITTER_DATE: "2020-01-02T00:00:00Z",
  });

  const pluginDirectory = join(consumerDirectory, "test-plugin");
  await mkdir(pluginDirectory);
  await writeFile(
    join(pluginDirectory, "package.json"),
    `${JSON.stringify({ name: "gitlode-system-test-plugin", private: true, type: "module" })}\n`,
  );
  await writeFile(
    join(pluginDirectory, "index.js"),
    [
      "export default async function () {",
      "  return {",
      "    async init() { return { type: 'ready' }; },",
      "    async project() { return { type: 'success', data: { installed: true } }; },",
      "  };",
      "}",
      "",
    ].join("\n"),
  );

  const isomorphicConfig = join(consumerDirectory, "isomorphic.json");
  await writeFile(
    isomorphicConfig,
    `${JSON.stringify({
      version: 1,
      extraction: { refs: ["main"] },
      output: { directory: isomorphicOutputDirectory, prefix: "isomorphic" },
      runtime: { gitAdapter: "isomorphic-git" },
      extensions: {
        "system-test-plugin": {
          entrypoint: "./test-plugin/index.js",
          failurePolicy: "fatal",
        },
      },
    })}\n`,
  );
  await runInstalledGitlode(
    ["--config", isomorphicConfig, "--per-file", repositoryDirectory],
    consumerDirectory,
  );
  const isomorphicRecords = await readJsonLines(isomorphicOutputDirectory);
  assert(
    isomorphicRecords.some((record) => {
      const file = record["file"] as
        | { path?: unknown; additions?: unknown; deletions?: unknown }
        | undefined;
      const extensions = record["extensions"] as Record<string, unknown> | undefined;
      return (
        file?.path === "sample.txt" &&
        file.additions === 2 &&
        file.deletions === 1 &&
        (extensions?.["system-test-plugin"] as { installed?: unknown } | undefined)?.installed ===
          true
      );
    }),
    "Isomorphic Git extraction did not produce the expected line diff and plugin enrichment",
  );

  const gitCliConfig = join(consumerDirectory, "git-cli.json");
  await writeFile(
    gitCliConfig,
    `${JSON.stringify({
      version: 1,
      extraction: { refs: ["main"] },
      output: { directory: cliOutputDirectory, prefix: "git-cli" },
      runtime: { gitAdapter: "git-cli" },
    })}\n`,
  );
  await runInstalledGitlode(
    ["--config", gitCliConfig, "--per-file", repositoryDirectory],
    consumerDirectory,
  );
  const gitCliRecords = await readJsonLines(cliOutputDirectory);
  assert(gitCliRecords.length > 0, "Git CLI adapter extraction produced no records");

  await writeFile(
    join(consumerDirectory, "consumer.ts"),
    [
      'import type { PluginFactory, PluginRuntimeContext } from "gitlode/plugin-api";',
      "function useRuntime(runtime: PluginRuntimeContext) {",
      "  runtime.tracer.startSpan('consumer.check').end();",
      "  runtime.meter.createCounter('consumer.check').add(1);",
      "}",
      "const factory: PluginFactory = async () => ({",
      "  async init() { return { type: 'ready' }; },",
      "  async project() { return { type: 'skip' }; },",
      "});",
      "void factory;",
      "void useRuntime;",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      files: ["consumer.ts"],
    })}\n`,
  );
  await run(
    "node",
    [join(consumerDirectory, "node_modules", "typescript", "bin", "tsc")],
    consumerDirectory,
  );

  const pluginApiDeclaration = await readFile(
    join(consumerDirectory, "node_modules", "gitlode", "dist", "plugin-api.d.ts"),
    "utf8",
  );
  assert(
    pluginApiDeclaration.includes("readonly tracer: Tracer") &&
      pluginApiDeclaration.includes("readonly meter: Meter"),
    "PluginRuntimeContext declaration does not expose Tracer and Meter",
  );
  assert(
    !pluginApiDeclaration.includes("Instrumentation") &&
      !pluginApiDeclaration.includes("PluginEntry"),
    "Plugin API declaration exposes a removed telemetry or private runtime type",
  );

  process.stdout.write(
    [
      `Installed package version: ${packageManifest.version}`,
      `Isomorphic Git records: ${isomorphicRecords.length}`,
      `Git CLI records: ${gitCliRecords.length}`,
      "Installed CLI, worker, both Git adapters, line diff, dynamic plugin, schema, and TypeScript consumer passed.",
      "",
    ].join("\n"),
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
