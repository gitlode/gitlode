import { spawn } from "node:child_process";
import { join } from "node:path";

type Completion = { code: number; stdout: Buffer; stderr: Buffer; absent: true };
type Pending = {
  resolve: (value: Completion) => void;
  reject: (error: Error) => void;
  code?: number;
  started: boolean;
};

// These are hang-detection budgets, including fresh host compilation, not performance thresholds.
export const bounds = { ready: 6000, operation: 16000, cleanup: 4000, test: 30000 };
export class WindowsLauncher {
  readonly host = spawn(
    join(process.env.SystemRoot ?? "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-File", join(import.meta.dirname, "host.ps1")],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  private pending = new Map<string, Pending>();
  private sequence = 0;
  private failure?: Error;
  private sealed = false;
  private text = "";
  private stderr = "";
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private shutdownResolve!: () => void;
  private shutdownReject!: (error: Error) => void;
  private shutdownObserved = false;
  readonly ready = new Promise<void>((resolve, reject) => {
    this.readyResolve = resolve;
    this.readyReject = reject;
  });
  private shutdown = new Promise<void>((resolve, reject) => {
    this.shutdownResolve = resolve;
    this.shutdownReject = reject;
  });
  readonly closed = new Promise<void>((resolve) => {
    this.host.once("close", () => {
      if (!this.shutdownObserved) this.fail(new Error(`host lost; retain root: ${this.stderr}`));
      resolve();
    });
  });
  compileMs = 0;
  hostInJob = false;

  constructor() {
    // Consumers may not yet be awaiting these barriers when host startup fails.
    void this.ready.catch(() => {});
    void this.shutdown.catch(() => {});
    this.host.on("error", (error) => this.fail(error));
    this.host.stdin.on("error", (error) => this.fail(error));
    this.host.stderr.on("data", (data: Buffer) => {
      this.stderr = (this.stderr + data.toString()).slice(-65536);
    });
    this.host.stdout.setEncoding("utf8");
    this.host.stdout.on("data", (data: string) => {
      this.text += data;
      if (this.text.length > 1048576) {
        this.fail(new Error("oversized protocol; retain root"));
        return;
      }
      let end: number;
      while ((end = this.text.indexOf("\n")) >= 0) {
        const line = this.text.slice(0, end);
        this.text = this.text.slice(end + 1);
        try {
          this.message(JSON.parse(line) as Record<string, unknown>);
        } catch (error) {
          this.fail(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }
  private fail(error: Error) {
    this.failure ??= error;
    this.sealed = true;
    this.readyReject(this.failure);
    this.shutdownReject(this.failure);
    for (const item of this.pending.values()) item.reject(this.failure);
    this.pending.clear();
    // Closing control requests host cleanup; it never establishes observed absence.
    this.host.stdin.end();
  }
  private message(message: Record<string, unknown>) {
    if (this.failure) return;
    if (
      message.kind === "ready" &&
      message.version === 1 &&
      typeof message.compileMs === "number"
    ) {
      this.compileMs = message.compileMs;
      this.hostInJob = message.hostInJob === true;
      this.readyResolve();
      return;
    }
    if (message.kind === "fatal")
      throw new Error(`host uncertainty; retain root: ${String(message.error)}`);
    if (message.kind === "shutdown" && this.sealed && this.pending.size === 0) {
      this.shutdownObserved = true;
      this.shutdownResolve();
      return;
    }
    const id = message.id;
    const item = typeof id === "string" ? this.pending.get(id) : undefined;
    if (!item) throw new Error("unknown launch receipt; retain root");
    if (message.kind === "started" && !item.started && typeof message.pid === "number") {
      item.started = true;
      return;
    }
    if (message.kind === "launchError" && !item.started) {
      this.pending.delete(id as string);
      item.reject(new Error(String(message.error)));
      return;
    }
    if (
      message.kind === "exit" &&
      item.started &&
      item.code === undefined &&
      typeof message.code === "number"
    ) {
      item.code = message.code;
      return;
    }
    if (
      message.kind === "complete" &&
      item.code !== undefined &&
      message.absent === true &&
      typeof message.stdout === "string" &&
      typeof message.stderr === "string"
    ) {
      const stdout = Buffer.from(message.stdout, "base64"),
        stderr = Buffer.from(message.stderr, "base64");
      if (stdout.length > 65536 || stderr.length > 65536) throw new Error("output exceeds bound");
      this.pending.delete(id as string);
      item.resolve({ code: item.code, stdout, stderr, absent: true });
      return;
    }
    throw new Error("malformed/out-of-order protocol; retain root");
  }
  private send(message: object) {
    if (this.failure) throw this.failure;
    const text = JSON.stringify(message);
    if (text.length > 1048576) throw new Error("launch request exceeds bound");
    this.host.stdin.write(text + "\n");
  }
  launch(exe: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv = process.env) {
    if (this.sealed) throw this.failure ?? new Error("admission sealed");
    const id = String(++this.sequence);
    const entries = Object.entries(environment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    );
    for (const [key, value] of entries)
      if (key.includes("=") || (key + value).includes("\0")) throw new Error("invalid environment");
    if ([exe, cwd, ...args].some((value) => value.includes("\0")))
      throw new Error("invalid argument");
    const block =
      entries
        .sort(([a], [b]) => a.toUpperCase().localeCompare(b.toUpperCase()))
        .map(([key, value]) => `${key}=${value}`)
        .join("\0") + "\0\0";
    const completion = new Promise<Completion>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, started: false });
      try {
        this.send({ kind: "launch", id, exe, args, cwd, environment: block });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
    void completion.catch(() => {});
    return {
      id,
      completion,
      cancel: () => this.send({ kind: "cancel", id }),
      denyObservation: () => this.send({ kind: "denyObservation", id }),
    };
  }
  async dispose() {
    if (!this.sealed) {
      this.sealed = true;
      this.send({ kind: "shutdown" });
    }
    await finite(this.shutdown, bounds.cleanup, "shutdown observation");
    await finite(this.closed, bounds.cleanup, "host/output settlement");
  }
}
export async function finite<T>(body: Promise<T>, ms: number, phase: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      body,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${phase} deadline; retain root`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
