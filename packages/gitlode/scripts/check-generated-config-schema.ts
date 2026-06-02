import { spawn } from "node:child_process";
import * as nodePath from "node:path";
import { fileURLToPath } from "node:url";

type CheckTask = {
  name: string;
  generateScript: string;
  targets: string[];
};

const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const packageRoot = nodePath.resolve(__dirname, "..");

const tasks: CheckTask[] = [
  {
    name: "config-schema",
    generateScript: "schema:generate",
    targets: ["schemas/config-v1.schema.json"],
  },
];

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  useShell = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stderr}`));
    });
  });
}

async function runGenerateScript(scriptName: string): Promise<void> {
  await runCommand("npm", ["run", scriptName], packageRoot, true);
}

async function getGitStatus(targets: string[]): Promise<string> {
  const status = await runCommand("git", ["status", "--porcelain", "--", ...targets], packageRoot);

  return status.trim();
}

async function checkTask(task: CheckTask): Promise<void> {
  console.log(`\n[check-generated] ${task.name}: run ${task.generateScript}`);
  await runGenerateScript(task.generateScript);

  console.log(`[check-generated] ${task.name}: verify tracked output`);
  const status = await getGitStatus(task.targets);

  if (status.length > 0) {
    throw new Error(
      [
        `[check-generated] ${task.name} has uncommitted generated output changes.`,
        "Please run the generator and commit updated files:",
        `- npm run ${task.generateScript}`,
        `- git diff -- ${task.targets.join(" ")}`,
      ].join("\n"),
    );
  }

  console.log(`[check-generated] ${task.name}: OK`);
}

function resolveSelectedTasks(taskNames: string[]): CheckTask[] {
  if (taskNames.length === 0) {
    return tasks;
  }

  const unknownNames = taskNames.filter((name) => !tasks.some((task) => task.name === name));

  if (unknownNames.length > 0) {
    throw new Error(
      `Unknown check task(s): ${unknownNames.join(", ")}\nAvailable tasks: ${tasks
        .map((task) => task.name)
        .join(", ")}`,
    );
  }

  return tasks.filter((task) => taskNames.includes(task.name));
}

async function main(): Promise<void> {
  const selectedTasks = resolveSelectedTasks(process.argv.slice(2));

  for (const task of selectedTasks) {
    await checkTask(task);
  }

  console.log("\n[check-generated] all checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
