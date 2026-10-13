import {
  execFile,
  spawn,
  type ChildProcess,
  type ExecFileOptionsWithStringEncoding,
} from "node:child_process";
import { promisify } from "node:util";

/** Owned fixture commands never inherit repository locations or injected Git configuration. */
export function fixtureGitEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(
    Object.entries(source).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  return {
    ...environment,
    TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  };
}

export const foregroundMaintenanceConfig = [
  "-c",
  "maintenance.autoDetach=false",
  "-c",
  "gc.autoDetach=false",
] as const;

/** Optional invocation-local tooling seam. The caller owns final disposal and body settlement. */
export interface FixtureWorkOwner {
  readonly signal: AbortSignal;
  check(): void;
  work<T>(operation: () => Promise<T>): Promise<T>;
  child(child: ChildProcess): void;
  root(path: string): void;
  diagnostic(error: unknown): void;
}

export function fixtureWork<T>(
  owner: FixtureWorkOwner | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  return owner ? owner.work(operation) : operation();
}

const execute = promisify(execFile);
// execFile does not forward detached to spawn in Node 22. Only explicit Unix fixture
// ownership needs a private group; no-owner and Windows calls retain execFile semantics.
function ownedUnixFixture(
  executable: string,
  args: readonly string[],
  options: ExecFileOptionsWithStringEncoding,
  owner: FixtureWorkOwner,
) {
  const child = spawn(executable, [...args], {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
  const bytes = { stdout: 0, stderr: 0 };
  let failure: Error | undefined;
  const pending = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    for (const stream of ["stdout", "stderr"] as const)
      child[stream].on("data", (chunk: Buffer) => {
        bytes[stream] += chunk.length;
        if (bytes[stream] <= (options.maxBuffer ?? 1024 * 1024)) chunks[stream].push(chunk);
        else if (!failure) {
          failure = new Error(`owned fixture ${stream} exceeds maxBuffer`);
          try {
            owner.diagnostic(failure);
          } catch {
            /* Preserve the buffer failure. */
          }
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch (error) {
            try {
              owner.diagnostic(error);
            } catch {
              /* Preserve the buffer failure. */
            }
          }
        }
      });
    child.once("error", (error) => {
      failure = error;
    });
    child.once("close", (code, signal) => {
      const stdout = Buffer.concat(chunks.stdout).toString("utf8"),
        stderr = Buffer.concat(chunks.stderr).toString("utf8");
      if (failure || code !== 0)
        reject(
          Object.assign(
            failure ?? new Error(`owned fixture exited: ${String(code)}, ${String(signal)}`),
            { stdout, stderr, code, signal },
          ),
        );
      else resolve({ stdout, stderr });
    });
  });
  return Object.assign(pending, { child });
}

export function fixtureExec(
  owner: FixtureWorkOwner | undefined,
  executable: string,
  args: readonly string[],
  options: ExecFileOptionsWithStringEncoding,
  notify?: (pid: number | undefined) => void,
) {
  return fixtureWork(owner, async () => {
    const pending =
      owner && process.platform !== "win32"
        ? ownedUnixFixture(executable, args, options, owner)
        : execute(executable, [...args], options);
    try {
      owner?.child(pending.child);
      notify?.(pending.child.pid);
    } catch (error) {
      try {
        owner?.diagnostic(
          `child registration failed; quiescence unavailable for PID ${pending.child.pid}`,
        );
      } catch {
        /* Preserve registration failure. */
      }
      void pending.catch(() => undefined);
      throw error;
    }
    return await pending;
  });
}
