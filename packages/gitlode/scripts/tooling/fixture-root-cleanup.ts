import { lstat, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const marker = ".gitlode-fixture-owner";
export async function registerFixtureRoot(root: string): Promise<void> {
  const owner = process.env.GITLODE_PERFORMANCE_SUPERVISION_ID;
  if (!owner || process.env.GITLODE_PERFORMANCE_SUPERVISED !== "1" || !process.connected) return;
  await writeFile(join(root, marker), owner, { flag: "wx" });
  await new Promise<void>((resolve, reject) => {
    process.send?.({ type: "performance-fixture-root", root }, (error: Error | null) =>
      error ? reject(error) : resolve(),
    );
  });
}

/** Called only after group cleanup and a durable non-success disposal barrier. */
export async function disposeFixtureRoot(root: string, owner: string): Promise<void> {
  const parent = await realpath(tmpdir());
  const physical = await realpath(root);
  const stat = await lstat(root);
  if (
    dirname(physical) !== parent ||
    !basename(root).startsWith("gitlode-performance-") ||
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    (typeof process.getuid === "function" && stat.uid !== process.getuid()) ||
    (await readFile(join(root, marker), "utf8")) !== owner
  )
    throw new Error("fixture root ownership check failed; retained");
  await rm(physical, { recursive: true, force: false });
}
