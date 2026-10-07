import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertEnabledReport,
  assertGuardActivation,
  sdkEvents,
  writeInstalledLoadGuard,
  type LoadEvent,
} from "./installed-load-guard.js";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type PackResult = {
  filename: string;
};

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const packageRoot = resolve(repositoryRoot, "packages/gitlode");
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
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      stderr += "\nOwned command exceeded 180-second deadline.\n";
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    }, 180_000);
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(deadline);
      if (code === 0 && !timedOut) {
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

async function readOutputBytes(directory: string): Promise<string[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".jsonl")).sort();
  assert(files.length > 0, `No JSONL output was produced in ${directory}`);
  return await Promise.all(
    files.map(async (file) => (await readFile(join(directory, file))).toString("base64")),
  );
}

// Resolve the existing parent before creation so rejection cannot leak a directory.
const temporaryParent = await realpath(tmpdir());
const resolvedRepositoryRoot = await realpath(repositoryRoot);
const temporaryRelative = relative(resolvedRepositoryRoot, temporaryParent);
assert(
  isAbsolute(temporaryRelative) ||
    temporaryRelative === ".." ||
    temporaryRelative.startsWith(".." + sep),
  "Installed-package system test TMP/TEMP directory must be outside the monorepo",
);
const temporaryRoot = await mkdtemp(join(temporaryParent, "gitlode-installed-package-"));
const evidenceDirectory = process.env["GITLODE_PACKAGE_EVIDENCE"];
if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });

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
  const installedDist = join(consumerDirectory, "node_modules", "gitlode", "dist");
  const identities = [];
  for (const file of (await readdir(installedDist, { recursive: true }))
    .filter((file) => /\.[cm]?js$/.test(file))
    .sort()) {
    identities.push({
      path: file,
      sha256: createHash("sha256")
        .update(await readFile(join(installedDist, file)))
        .digest("hex"),
    });
  }
  const compilerVersion = await run(
    "node",
    [join(consumerDirectory, "node_modules", "typescript", "bin", "tsc"), "--version"],
    consumerDirectory,
  );
  const packageIdentity = {
    tarball: basename(tarballPath),
    sha256: createHash("sha256")
      .update(await readFile(tarballPath))
      .digest("hex"),
    node: process.version,
    compiler: compilerVersion.stdout.trim(),
    runtime: identities,
  };
  process.stdout.write(`${JSON.stringify(packageIdentity)}\n`);
  if (evidenceDirectory)
    await writeFile(
      join(evidenceDirectory, "package-identity.json"),
      JSON.stringify(packageIdentity, null, 2),
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

  const preload = await writeInstalledLoadGuard(consumerDirectory);
  async function guarded(name: string, enabled: boolean, deny: boolean, config: string) {
    const output = config === isomorphicConfig ? isomorphicOutputDirectory : cliOutputDirectory;
    // Each invocation owns a fresh output directory; timestamped files from earlier runs
    // otherwise accumulate and make an output-equivalence assertion compare multiple runs.
    await rm(output, { recursive: true, force: true });
    await mkdir(output);
    const log = join(temporaryRoot, `${name}.jsonl`);
    await writeFile(log, "");
    let command: CommandResult;
    try {
      command = await run(
        process.execPath,
        [
          "--import",
          pathToFileURL(preload).href,
          join(installedDist, "index.js"),
          "--config",
          config,
          "--per-file",
          ...(enabled ? ["--profile"] : []),
          repositoryDirectory,
        ],
        consumerDirectory,
        { GITLODE_LOAD_LOG: log, GITLODE_DENY_SDK: deny ? "1" : "0" },
      );
    } finally {
      if (evidenceDirectory) await copyFile(log, join(evidenceDirectory, `${name}.jsonl`));
    }
    const events = (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LoadEvent);
    assertGuardActivation(events);
    assert(
      events.find((event) => event.type === "worker-result")?.result?.kind === "success",
      `${name}: actual worker extraction failed`,
    );
    if (evidenceDirectory)
      await writeFile(
        join(evidenceDirectory, `${name}-command.json`),
        JSON.stringify(command, null, 2),
      );
    return { events, command };
  }

  // The boundary fixture is SDK-free. Separately prove plugin-owned SDK loading is observed
  // and attributed to its importer rather than counted as gitlode session construction.
  const pluginPath = join(pluginDirectory, "index.js");
  const pluginBytes = await readFile(pluginPath, "utf8");
  try {
    await writeFile(pluginPath, 'import "@opentelemetry/sdk-metrics";\n' + pluginBytes);
    const pluginOwned = await guarded("plugin-owned-sdk", false, false, isomorphicConfig);
    assert(
      sdkEvents(pluginOwned.events).some(
        (event) => event.type === "esm-resolve" && event.parent === pathToFileURL(pluginPath).href,
      ),
      "Plugin SDK import was not attributed to the controlled plugin",
    );
    assert(
      pluginOwned.events.find((event) => event.type === "worker-result")?.result?.success
        ?.profileReport === undefined,
      "Plugin-owned SDK load enabled the gitlode session",
    );
  } finally {
    await writeFile(pluginPath, pluginBytes);
  }
  for (const [adapter, config, output] of [
    ["isomorphic", isomorphicConfig, isomorphicOutputDirectory],
    ["git-cli", gitCliConfig, cliOutputDirectory],
  ] as const) {
    const baseline = await readOutputBytes(output);
    for (const deny of [false, true]) {
      const disabled = await guarded(`${adapter}-disabled-${deny}`, false, deny, config);
      assert(
        sdkEvents(disabled.events).length === 0,
        "Disabled resolved/loaded SDK implementation",
      );
      assert(
        !disabled.events.some(
          (event) =>
            event.type === "worker-diagnostic" &&
            event.diagnostic?.message?.includes("Telemetry initialization"),
        ),
        "Disabled warned about initialization",
      );
      assert(
        disabled.events.find((event) => event.type === "worker-result")?.result?.success
          ?.profileReport === undefined,
        "Disabled returned a profile report",
      );
      assert(
        JSON.stringify(await readOutputBytes(output)) === JSON.stringify(baseline),
        "Disabled extraction output changed",
      );
    }
    const enabled = await guarded(`${adapter}-enabled`, true, false, config);
    assertEnabledReport(enabled.events);
    assert(
      sdkEvents(enabled.events).every((event) => event.isolate > 0),
      "CLI host eagerly reached SDK implementation",
    );
    assert(
      sdkEvents(enabled.events).some(
        (event) => event.type === "cjs-load" || event.type === "esm-load",
      ),
      "Enabled did not positively load SDK implementation",
    );
    assert(
      JSON.stringify(await readOutputBytes(output)) === JSON.stringify(baseline),
      "Enabled extraction output changed",
    );
    const degraded = await guarded(`${adapter}-denied`, true, true, config);
    assert(
      degraded.events.some((event) => event.type === "denied"),
      "SDK denial did not activate",
    );
    const warnings = degraded.events.filter(
      (event) =>
        event.type === "worker-diagnostic" &&
        event.diagnostic?.message ===
          "Telemetry initialization degraded; profile data is unavailable.",
    );
    assert(warnings.length === 1, "Degraded must issue one sanitized initialization warning");
    assert(
      degraded.events.find((event) => event.type === "worker-result")?.result?.success
        ?.profileReport === undefined,
      "Degraded returned a report",
    );
    assert(
      JSON.stringify(await readOutputBytes(output)) === JSON.stringify(baseline),
      "Degraded extraction output changed",
    );
    if (adapter === "isomorphic") {
      const disabled = await guarded("missing-chunk-baseline", false, false, config);
      const loadedPaths = (events: LoadEvent[]) =>
        new Set(
          events
            .filter(
              (event) =>
                event.type === "esm-load" && event.realpath?.startsWith(installedDist + sep),
            )
            .map((event) => event.realpath ?? ""),
        );
      const eager = loadedPaths(disabled.events);
      const lazy = [...loadedPaths(enabled.events)].find((path) => !eager.has(path));
      assert(lazy, "Enabled did not load an installed lazy runtime asset");
      const bytes = await readFile(lazy);
      try {
        await rm(lazy);
        const missing = await guarded("missing-enabled-chunk", true, false, config);
        let detected = false;
        try {
          assertEnabledReport(missing.events);
        } catch {
          detected = true;
        }
        assert(detected, "Missing enabled chunk escaped positive report assertion");
        process.stdout.write(
          `Missing enabled asset sensitivity passed: ${relative(installedDist, lazy)}\n`,
        );
      } finally {
        await writeFile(lazy, bytes);
      }
    }
  }

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
} catch (error) {
  if (evidenceDirectory)
    await writeFile(
      join(evidenceDirectory, "first-failure.txt"),
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
  throw error;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
