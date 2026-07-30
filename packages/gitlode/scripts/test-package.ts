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
  files: { path: string }[];
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
  options: { allowFailure?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const npmExecutable = process.env["npm_execpath"];
    const executable = command === "npm" && npmExecutable ? process.execPath : command;
    const commandArgs = command === "npm" && npmExecutable ? [npmExecutable, ...args] : args;
    const child = spawn(executable, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
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

const temporaryRoot = await mkdtemp(join(tmpdir(), "gitlode-package-"));
assert(
  isAbsolute(temporaryRoot) && relative(repositoryRoot, temporaryRoot).startsWith(".."),
  "Packed-artifact test directory must be outside the monorepo",
);

try {
  const packDirectory = join(temporaryRoot, "pack");
  const consumerDirectory = join(temporaryRoot, "consumer");
  const repositoryDirectory = join(temporaryRoot, "repository");
  const isoOutputDirectory = join(temporaryRoot, "output-isomorphic");
  const cliOutputDirectory = join(temporaryRoot, "output-git-cli");
  await Promise.all([
    mkdir(packDirectory),
    mkdir(consumerDirectory),
    mkdir(repositoryDirectory),
    mkdir(isoOutputDirectory),
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
  assert(
    packResult.files.some((file) => file.path === "dist/worker-entry.js"),
    "Tarball is missing worker-entry.js",
  );
  assert(
    packResult.files.some((file) => file.path === "schemas/config-v1.schema.json"),
    "Tarball is missing the configuration schema",
  );

  await writeFile(
    join(consumerDirectory, "package.json"),
    JSON.stringify({ name: "gitlode-packed-consumer", private: true, type: "module" }),
  );
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath, "typescript@^7.0.2"],
    consumerDirectory,
  );

  const installedPackage = join(consumerDirectory, "node_modules", "gitlode");
  const installedIndex = join(installedPackage, "dist", "index.js");
  const installedPluginApi = join(installedPackage, "dist", "plugin-api.js");
  const installedWorker = join(installedPackage, "dist", "worker-entry.js");
  await Promise.all([access(installedIndex), access(installedPluginApi), access(installedWorker)]);

  const indexSource = await readFile(installedIndex, "utf8");
  assert(indexSource.startsWith("#!/usr/bin/env node\n"), "Installed CLI shebang is missing");
  await access(join(consumerDirectory, "node_modules", ".bin", "gitlode"));

  const help = await run("node", [installedIndex, "--help"], consumerDirectory);
  assert(help.stdout.includes("Extract Git commit history"), "Installed CLI help failed");
  const version = await run("node", [installedIndex, "--version"], consumerDirectory);
  assert(
    version.stdout.trim() === packageManifest.version,
    `Unexpected installed CLI version: ${version.stdout}`,
  );

  const resolution = await run(
    "node",
    [
      "--input-type=module",
      "--eval",
      "console.log(import.meta.resolve('gitlode')); console.log(import.meta.resolve('gitlode/plugin-api'));",
    ],
    consumerDirectory,
  );
  assert(
    resolution.stdout
      .trim()
      .split(/\r?\n/)
      .every(
        (url) =>
          url.includes("/node_modules/gitlode/") || url.includes("\\node_modules\\gitlode\\"),
      ),
    `Package resolution escaped the installed artifact:\n${resolution.stdout}`,
  );

  await run("git", ["init", "-b", "main"], repositoryDirectory);
  await run("git", ["config", "user.name", "Package Test"], repositoryDirectory);
  await run("git", ["config", "user.email", "package-test@example.com"], repositoryDirectory);
  await writeFile(join(repositoryDirectory, "sample.txt"), "first\nsecond\n");
  await run("git", ["add", "sample.txt"], repositoryDirectory);
  await run("git", ["commit", "-m", "initial"], repositoryDirectory);
  await writeFile(join(repositoryDirectory, "sample.txt"), "first\nchanged\nthird\n");
  await run("git", ["add", "sample.txt"], repositoryDirectory);
  await run("git", ["commit", "-m", "modify sample"], repositoryDirectory);

  const pluginDirectory = join(consumerDirectory, "test-plugin");
  await mkdir(pluginDirectory);
  await writeFile(
    join(pluginDirectory, "package.json"),
    JSON.stringify({
      name: "gitlode-packed-test-plugin",
      type: "module",
      peerDependencies: { gitlode: "^999.0.0" },
    }),
  );
  await writeFile(
    join(pluginDirectory, "index.js"),
    [
      "export default async function () {",
      "  return {",
      "    async init() { return { type: 'ready' }; },",
      "    async project() { return { type: 'success', data: { packed: true } }; },",
      "  };",
      "}",
      "",
    ].join("\n"),
  );

  const isomorphicConfig = join(consumerDirectory, "isomorphic.json");
  await writeFile(
    isomorphicConfig,
    JSON.stringify({
      version: 1,
      extraction: { refs: ["main"] },
      output: { directory: isoOutputDirectory, prefix: "isomorphic" },
      runtime: { gitAdapter: "isomorphic-git" },
      extensions: {
        "packed-plugin": {
          entrypoint: "./test-plugin/index.js",
          failurePolicy: "fatal",
        },
      },
    }),
  );
  const isomorphicRun = await run(
    "node",
    [installedIndex, "--config", isomorphicConfig, "--per-file", repositoryDirectory],
    consumerDirectory,
  );
  assert(
    isomorphicRun.stderr.includes("declares peer gitlode ^999.0.0"),
    `Compatibility warning was not emitted:\n${isomorphicRun.stderr}`,
  );
  const isomorphicRecords = await readJsonLines(isoOutputDirectory);
  assert(
    isomorphicRecords.some((record) => {
      const file = record["file"] as { additions?: unknown; deletions?: unknown } | undefined;
      const extensions = record["extensions"] as Record<string, unknown> | undefined;
      return (
        typeof file?.additions === "number" &&
        typeof file.deletions === "number" &&
        extensions?.["packed-plugin"] !== undefined
      );
    }),
    "Isomorphic Git extraction did not exercise line diff and dynamic plugin enrichment",
  );

  const gitCliConfig = join(consumerDirectory, "git-cli.json");
  await writeFile(
    gitCliConfig,
    JSON.stringify({
      version: 1,
      extraction: { refs: ["main"] },
      output: { directory: cliOutputDirectory, prefix: "git-cli" },
      runtime: { gitAdapter: "git-cli" },
    }),
  );
  await run(
    "node",
    [installedIndex, "--config", gitCliConfig, "--per-file", repositoryDirectory],
    consumerDirectory,
  );
  const gitCliRecords = await readJsonLines(cliOutputDirectory);
  assert(gitCliRecords.length > 0, "Git CLI adapter extraction produced no records");

  await writeFile(
    join(consumerDirectory, "consumer.ts"),
    [
      'import type { PluginFactory } from "gitlode/plugin-api";',
      "const factory: PluginFactory = async () => ({",
      "  async init() { return { type: 'ready' }; },",
      "  async project() { return { type: 'skip' }; },",
      "});",
      "void factory;",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(consumerDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      files: ["consumer.ts"],
    }),
  );
  await run(
    "node",
    [join(consumerDirectory, "node_modules", "typescript", "bin", "tsc")],
    consumerDirectory,
  );

  const sourceMapPaths = packResult.files
    .map((file) => file.path)
    .filter((path) => path.startsWith("dist/") && path.endsWith(".js.map"));
  assert(sourceMapPaths.length > 0, "Tarball contains no JavaScript source maps");

  for (const sourceMapPath of sourceMapPaths) {
    const map = JSON.parse(await readFile(join(installedPackage, sourceMapPath), "utf8")) as {
      mappings?: string;
      sources?: string[];
      sourcesContent?: (string | null)[];
    };
    assert((map.mappings?.length ?? 0) > 0, `${sourceMapPath} contains no mappings`);
    const typescriptSourceIndexes = (map.sources ?? [])
      .map((source, index) => ({ source, index }))
      .filter(({ source }) => source.endsWith(".ts"));
    assert(
      typescriptSourceIndexes.length > 0,
      `${sourceMapPath} does not map to TypeScript sources`,
    );
    assert(
      typescriptSourceIndexes.every(({ index }) => {
        const sourceContent = map.sourcesContent?.[index];
        return typeof sourceContent === "string" && sourceContent.length > 0;
      }),
      `${sourceMapPath} does not embed content for every mapped TypeScript source`,
    );
  }

  process.stdout.write(
    [
      `Packed artifact: ${tarballPath}`,
      `Installed outside monorepo: ${consumerDirectory}`,
      `Tarball files: ${packResult.files.length}`,
      `Source maps with embedded TypeScript sources: ${sourceMapPaths.length}`,
      `Isomorphic Git records: ${isomorphicRecords.length}`,
      `Git CLI records: ${gitCliRecords.length}`,
      "CLI, worker, line diff, schemas, dynamic plugin, compatibility warning, TypeScript consumer, and source maps passed.",
      "",
    ].join("\n"),
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
