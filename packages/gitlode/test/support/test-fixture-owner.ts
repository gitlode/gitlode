import { execFile, type ChildProcess } from "node:child_process";
import { writeSync } from "node:fs";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";

import type { FixtureWorkOwner } from "./fixture-git.js";

const execute = promisify(execFile);
type ProcessRow = { ProcessId: number; ParentProcessId: number; CreationDate: string };
async function windowsProcesses(): Promise<ProcessRow[]> {
  const { stdout } = await execute(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,@{n='CreationDate';e={if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{''}}}) | ConvertTo-Json -Compress",
    ],
    { timeout: 1500 },
  );
  return JSON.parse(stdout) as ProcessRow[];
}

/** Only these fixture tests opt into this lifetime; no process or root registry is global. */
export class TestFixtureOwner implements FixtureWorkOwner {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  readonly roots = new Set<string>();
  readonly diagnostics: string[] = [];
  readonly timeline: { event: string; elapsedMs: number; pid?: number; root?: string }[] = [];
  private readonly started = performance.now();
  private event(event: string, detail: { pid?: number; root?: string } = {}): void {
    this.timeline.push({ event, elapsedMs: performance.now() - this.started, ...detail });
  }
  private readonly pending = new Set<Promise<unknown>>();
  private readonly children = new Map<ChildProcess, { closed: boolean; close: Promise<void> }>();
  private readonly terminations: Promise<void>[] = [];
  private uncertain = false;
  private disposed = false;
  quiescent = false;
  private readonly abort = () => {
    this.event("cancellation");
    this.controller.abort(this.external.reason);
    for (const child of this.children.keys()) this.stop(child);
  };
  private readonly external: AbortSignal;
  private readonly waitMs: number;
  private readonly report: (message: string) => void;
  constructor(
    external: AbortSignal,
    waitMs = 4000,
    report: (message: string) => void = (message) => {
      writeSync(2, message);
    },
  ) {
    this.external = external;
    this.waitMs = waitMs;
    this.report = report;
    external.addEventListener("abort", this.abort, { once: true });
    if (external.aborted) this.abort();
  }
  check(): void {
    this.signal.throwIfAborted();
    if (this.disposed) throw new Error("fixture owner already disposed");
  }
  root(path: string): void {
    // Registration deliberately precedes cancellation checks, including mkdtemp races.
    this.roots.add(path);
    this.event("root-registered", { root: path });
  }
  work<T>(operation: () => Promise<T>): Promise<T> {
    this.check();
    const pending = Promise.resolve().then(() => {
      this.check();
      return operation();
    });
    this.pending.add(pending);
    void pending.then(
      () => this.pending.delete(pending),
      () => this.pending.delete(pending),
    );
    return pending.then((value) => {
      this.check();
      return value;
    });
  }
  run<T>(body: () => Promise<T>): Promise<T> {
    return this.work(async () => {
      this.event("body-start");
      try {
        return await body();
      } finally {
        this.event("body-settled");
      }
    });
  }
  child(child: ChildProcess): void {
    const state = { closed: false, close: Promise.resolve() };
    this.event("child-registered", { pid: child.pid });
    state.close = new Promise<void>((resolve) => {
      child.once("close", () => {
        state.closed = true;
        this.event("child-close", { pid: child.pid });
        resolve();
      });
    });
    this.children.set(child, state);
    if (this.signal.aborted) this.stop(child);
  }
  diagnostic(error: unknown): void {
    this.uncertain = true;
    this.diagnostics.push(error instanceof Error ? error.message : String(error));
  }
  private stop(child: ChildProcess): void {
    const state = this.children.get(child)!;
    if (state.closed || !child.pid) return;
    const termination = (async () => {
      this.event("termination-start", { pid: child.pid });
      if (process.platform === "win32") {
        // Observe the owned tree while its root is alive. A missing root or failed observation
        // cannot prove that already orphaned descendants have stopped: retain every root.
        const before = await windowsProcesses();
        const parent = before.find((row) => row.ProcessId === child.pid);
        if (!parent || state.closed || child.exitCode !== null || child.signalCode !== null)
          throw new Error("owned Windows tree identity unavailable");
        const tree = new Map<number, ProcessRow>([[parent.ProcessId, parent]]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const row of before)
            if (tree.has(row.ParentProcessId) && !tree.has(row.ProcessId)) {
              tree.set(row.ProcessId, row);
              changed = true;
            }
        }
        if (state.closed || child.exitCode !== null || child.signalCode !== null)
          throw new Error("owned Windows root exited before tree termination");
        await execute("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { timeout: 1500 });
        await state.close;
        const after = await windowsProcesses();
        if (
          after.some(
            (row) =>
              tree.get(row.ProcessId)?.CreationDate === row.CreationDate ||
              tree.has(row.ParentProcessId),
          )
        )
          throw new Error("owned Windows tree still observed after close");
      } else {
        // Owned fixture launches use a private process group, including sidecar Git children.
        process.kill(-child.pid!, "SIGTERM");
        let grace: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          state.close,
          new Promise<void>((resolve) => {
            grace = setTimeout(resolve, 250);
          }),
        ]);
        clearTimeout(grace);
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
        await state.close;
        try {
          process.kill(-child.pid!, 0);
          throw new Error("owned process group still observed after close");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
    })().catch((error) => {
      this.uncertain = true;
      this.diagnostic(error);
    });
    this.terminations.push(termination);
  }
  async dispose() {
    this.event("disposal-start");
    this.external.removeEventListener("abort", this.abort);
    // A bounded barrier covers bodies, all separately registered I/O and child close. Never
    // await this from an inner finally whose own completion belongs to pending.
    const settled = (async () => {
      while (this.pending.size) await Promise.allSettled([...this.pending]);
      await Promise.all(this.terminations);
      await Promise.all([...this.children.values()].map((state) => state.close));
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const confirmed = await Promise.race([
      settled.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), this.waitMs);
      }),
    ]);
    clearTimeout(timer);
    this.quiescent = confirmed && !this.uncertain;
    if (!confirmed) {
      this.controller.abort(new Error("fixture disposal deadline"));
      for (const child of this.children.keys()) this.stop(child);
    }
    this.disposed = true;
    if (!confirmed || this.uncertain) {
      this.diagnostic("fixture quiescence unconfirmed; retained owned roots");
    } else {
      for (const root of this.roots) {
        try {
          await rm(root, { recursive: true, force: true });
          this.event("root-removed", { root });
        } catch (error) {
          this.diagnostic(error);
        }
      }
    }
    if (this.diagnostics.length) {
      try {
        this.report(
          `Retained fixture diagnostics: ${JSON.stringify({ roots: [...this.roots], diagnostics: this.diagnostics, timeline: this.timeline })}\n`,
        );
      } catch {
        /* Reporting is secondary to the original test failure. */
      }
    }
    this.event("disposal-return");
    return {
      removed: confirmed && !this.uncertain && !this.diagnostics.length,
      roots: [...this.roots],
      diagnostics: [...this.diagnostics],
      timeline: [...this.timeline],
    };
  }
}

/** Teardown may add a cleanup failure only when no primary test error already exists. */
export async function disposeTestFixtures(
  owners: TestFixtureOwner[],
  primaryFailed: boolean,
): Promise<void> {
  const results = await Promise.all(owners.splice(0).map((owner) => owner.dispose()));
  const failures = results.filter((result) => !result.removed);
  if (failures.length && !primaryFailed)
    throw new Error(`Fixture cleanup failed: ${JSON.stringify(failures)}`);
}
