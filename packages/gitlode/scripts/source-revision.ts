import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Resolve the revision of a checkout owned by this process without changing Git config. */
export async function resolveSourceRevision(checkoutRoot: string): Promise<string> {
  const resolvedRoot = await realpath(checkoutRoot);
  const safeDirectory = resolvedRoot.replaceAll("\\", "/");
  const result = await execFileAsync(
    "git",
    ["-c", `safe.directory=${safeDirectory}`, "-C", resolvedRoot, "rev-parse", "HEAD"],
    { windowsHide: true },
  );
  const revision = result.stdout.trim();
  if (!/^[0-9a-f]{7,64}$/i.test(revision)) throw new Error("Git returned an invalid HEAD revision");
  return revision;
}
