import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
type SourceRevisionExecutor = typeof execFileAsync;

export async function resolveSourceRevision(
  checkoutRoot: string,
  executor: SourceRevisionExecutor = execFileAsync,
): Promise<string> {
  const resolvedRoot = await realpath(checkoutRoot);
  const safeDirectory = resolvedRoot.replaceAll("\\", "/");
  const result = await executor(
    "git",
    ["-c", `safe.directory=${safeDirectory}`, "-C", resolvedRoot, "rev-parse", "HEAD"],
    { windowsHide: true },
  );
  const revision = result.stdout.trim();
  if (!/^[0-9a-f]{7,64}$/i.test(revision)) throw new Error("Git returned an invalid HEAD revision");
  return revision;
}
