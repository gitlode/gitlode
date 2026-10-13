import {
  execFile,
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
export function fixtureExec(
  owner: FixtureWorkOwner | undefined,
  executable: string,
  args: readonly string[],
  options: ExecFileOptionsWithStringEncoding,
) {
  return fixtureWork(owner, async () => {
    const pending = execute(executable, [...args], {
      ...options,
      ...(owner && process.platform !== "win32" ? { detached: true } : {}),
    });
    try {
      owner?.child(pending.child);
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
