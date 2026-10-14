import { spawn } from "node:child_process";
import { join } from "node:path";

import { now, cutoff, until, settleCleanup } from "./deadlines.ts";
import { Frames, frameLimit, output } from "./protocol.ts";

type Completion = { code: number; stdout: Buffer; stderr: Buffer; absent: true };
type Pending = {
  resolve: (value: Completion) => void;
  reject: (error: Error) => void;
  code?: number;
  started: boolean;
  observationDenied?: boolean;
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
  private frames = new Frames();
  private readyObserved = false;
  private disposal?: Promise<void>;
  private queuedBytes = 0;
  private writes = new Set<Promise<void>>();
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
      if (!this.shutdownObserved) this.fail(new Error("host lost; retain root"));
      resolve();
    });
  });
  compileMs = 0;
  hostInJob = false;
  readonly faultReceipts: Array<{ kind: string; phase: string }> = [];
  readonly exits = new Map<string, number>();
  readonly events: Array<{ kind: string; id?: string; at: number }> = [];
  private readonly splitControl: boolean;

  constructor(splitControl = false) {
    this.splitControl = splitControl;
    // Consumers may not yet be awaiting these barriers when host startup fails.
    void this.ready.catch(() => {});
    void this.shutdown.catch(() => {});
    this.host.on("error", () => this.fail(new Error("host spawn failure; retain root")));
    this.host.stdin.on("error", () => this.fail(new Error("control write failure; retain root")));
    // Drain diagnostic output without retaining exception text or inherited request values.
    this.host.stderr.resume();
    this.host.stdout.on("data", (data: Buffer) => {
      if (this.failure) return;
      try {
        this.frames.push(data, (message) => this.message(message));
      } catch {
        this.fail(new Error("invalid control receipt; retain root"));
      }
    });
    this.host.stdout.once("end", () => {
      try {
        this.frames.end();
      } catch {
        this.fail(new Error("truncated control receipt; retain root"));
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
    if (this.events.length < 100)
      this.events.push({
        kind: String(message.kind).slice(0, 32),
        ...(typeof message.id === "string" && /^\d{1,16}$/.test(message.id)
          ? { id: message.id }
          : {}),
        at: now(),
      });
    if (
      message.kind === "ready" &&
      !this.readyObserved &&
      !this.sealed &&
      message.version === 1 &&
      typeof message.compileMs === "number" &&
      Number.isFinite(message.compileMs) &&
      message.compileMs >= 0 &&
      typeof message.hostInJob === "boolean"
    ) {
      this.compileMs = message.compileMs;
      this.readyObserved = true;
      this.hostInJob = message.hostInJob === true;
      this.readyResolve();
      return;
    }
    if (message.kind === "fatal") {
      this.faultReceipts.push({
        kind: "fatal",
        phase:
          typeof message.phase === "string" && /^[a-z-]{1,32}$/.test(message.phase)
            ? message.phase
            : "unknown",
      });
      throw new Error("host uncertainty; retain root");
    }
    if (
      message.kind === "shutdown" &&
      !this.shutdownObserved &&
      this.sealed &&
      this.pending.size === 0
    ) {
      this.shutdownObserved = true;
      this.shutdownResolve();
      return;
    }
    const id = message.id;
    const item = typeof id === "string" ? this.pending.get(id) : undefined;
    if (!item) throw new Error("unknown launch receipt; retain root");
    if (
      message.kind === "faultInjected" &&
      message.fault === "observation-loss" &&
      item.started &&
      !item.observationDenied
    ) {
      item.observationDenied = true;
      this.faultReceipts.push({ kind: "injected", phase: "observation-loss" });
      return;
    }
    if (
      message.kind === "started" &&
      !item.started &&
      Number.isSafeInteger(message.pid) &&
      (message.pid as number) > 0
    ) {
      item.started = true;
      return;
    }
    if (message.kind === "launchError" && !item.started) {
      this.pending.delete(id as string);
      const identity = message.error === "Win32Exception" ? "Win32Exception" : "LaunchError";
      item.reject(new Error(`native launch failure: ${identity}`));
      return;
    }
    if (
      message.kind === "exit" &&
      item.started &&
      item.code === undefined &&
      Number.isSafeInteger(message.code) &&
      (message.code as number) >= 0
    ) {
      item.code = message.code as number;
      this.exits.set(id as string, item.code);
      return;
    }
    if (
      message.kind === "complete" &&
      item.code !== undefined &&
      message.absent === true &&
      typeof message.stdout === "string" &&
      typeof message.stderr === "string"
    ) {
      const stdout = output(message.stdout),
        stderr = output(message.stderr);
      this.pending.delete(id as string);
      item.resolve({ code: item.code, stdout, stderr, absent: true });
      return;
    }
    throw new Error("malformed/out-of-order protocol; retain root");
  }
  private send(message: object) {
    if (this.failure) throw this.failure;
    let bytes = Buffer.from(JSON.stringify(message) + "\n", "utf8");
    const byteCount = bytes.length;
    if (bytes.length - 1 > frameLimit || this.queuedBytes + bytes.length > frameLimit + 1) {
      this.fail(new Error("control write exceeds bound; retain root"));
      throw this.failure;
    }
    this.queuedBytes += bytes.length;
    const written = new Promise<void>((resolve, reject) => {
      // The smallest Unicode oracle splits the request within its first Japanese code point.
      if (this.splitControl) {
        const index = bytes.indexOf(Buffer.from("日本語", "utf8"));
        if (index >= 0) {
          this.host.stdin.write(bytes.subarray(0, index + 1));
          bytes = bytes.subarray(index + 1);
        }
      }
      this.host.stdin.write(bytes, (error) => {
        this.queuedBytes -= byteCount;
        if (error) {
          this.fail(new Error("control write failure; retain root"));
          reject(this.failure);
        } else resolve();
      });
    });
    this.writes.add(written);
    void written.then(
      () => this.writes.delete(written),
      () => this.writes.delete(written),
    );
  }
  launch(exe: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv = process.env) {
    if (this.sealed || !this.readyObserved)
      throw this.failure ?? new Error("admission sealed/not ready");
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
  dispose(enclosingEnd = Infinity) {
    return (this.disposal ??= this.cleanup(cutoff(enclosingEnd, bounds.cleanup)));
  }
  private async cleanup(end: number) {
    let sendError: unknown;
    if (!this.sealed) {
      this.sealed = true;
      try {
        this.send({ kind: "shutdown" });
      } catch (error) {
        sendError = error;
      }
    }
    await settleCleanup(end, [
      {
        name: "control writes",
        run: async () => {
          await Promise.all([...this.writes]);
          if (sendError) throw sendError;
        },
      },
      { name: "shutdown observation", run: () => this.shutdown },
      { name: "host/output settlement", run: () => this.closed },
    ]);
  }
}
export async function finite<T>(body: Promise<T>, ms: number, phase: string): Promise<T> {
  return until(body, now() + ms, phase);
}
