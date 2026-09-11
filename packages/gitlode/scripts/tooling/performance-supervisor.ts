import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { writeAtomicJson } from "./atomic-json.js";
import type { PerformanceProgress, PerformanceStage } from "./performance-progress.js";

export const SUPERVISION_DEFAULTS = {
  preparationMs: 30 * 60_000,
  executionMs: 5 * 60_000,
  processingMs: 5 * 60_000,
  heartbeatMs: 5_000,
  terminationGraceMs: 2_000,
  cleanupWaitMs: 3_000,
  diagnosticBytes: 16 * 1024,
} as const;

export interface SupervisionLimits {
  readonly preparationMs: number;
  readonly executionMs: number;
  readonly processingMs: number;
  readonly heartbeatMs: number;
  readonly terminationGraceMs: number;
  readonly cleanupWaitMs: number;
  readonly diagnosticBytes: number;
}

export interface SupervisionPersistence {
  readonly writeDiagnostic: (path: string, contents: Buffer) => Promise<void>;
  readonly writeSnapshot: (directory: string, name: string, value: unknown) => Promise<void>;
}

const defaultPersistence: SupervisionPersistence = {
  writeDiagnostic: writeFile,
  writeSnapshot: writeAtomicJson,
};

export function supervisionOptions(args: readonly string[]) {
  const limits: SupervisionLimits = { ...SUPERVISION_DEFAULTS };
  const workerArgs: string[] = [];
  const options = {
    "--preparation-timeout-ms": "preparationMs",
    "--execution-timeout-ms": "executionMs",
    "--processing-timeout-ms": "processingMs",
  } as const;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] as string;
    const key = options[arg as keyof typeof options];
    if (!key) {
      workerArgs.push(arg);
      continue;
    }
    const raw = args[++index];
    const value = Number(raw);
    if (
      !raw ||
      !/^\d+$/.test(raw) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 2_147_483_647
    )
      throw new Error(`${arg} must be an integer from 1 to 2147483647`);
    Object.assign(limits, { [key]: value });
  }
  return { limits, workerArgs };
}

/** Reject malformed IPC rather than allowing a child to reset its deadline with arbitrary data. */
function progressValue(value: unknown): PerformanceProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (!["preparation", "execution", "processing"].includes(String(item.stage))) return undefined;
  if (typeof item.operation !== "string" || !/^[a-z0-9_-]{1,80}$/.test(item.operation))
    return undefined;
  const result: Record<string, unknown> = { stage: item.stage, operation: item.operation };
  for (const key of ["fixture", "adapter", "phase", "state"])
    if (item[key] !== undefined) {
      if (typeof item[key] !== "string" || !/^[a-z0-9_-]{1,100}$/.test(item[key] as string))
        return undefined;
      result[key] = item[key];
    }
  for (const key of ["quantity", "iteration", "pid"])
    if (item[key] !== undefined) {
      if (!Number.isSafeInteger(item[key]) || (item[key] as number) < 0) return undefined;
      result[key] = item[key];
    }
  return result as unknown as PerformanceProgress;
}

function boundedTail(previous: Buffer, chunk: Buffer, maximum: number): Buffer {
  return Buffer.concat([previous, chunk.subarray(-maximum)]).subarray(-maximum);
}

export async function supervisePerformance(input: {
  readonly executable: string;
  readonly args: readonly string[];
  readonly artifacts: string;
  readonly limits?: SupervisionLimits;
  readonly onProgress?: (line: string) => void;
  readonly onFailure?: (line: string) => void;
  readonly persistence?: Partial<SupervisionPersistence>;
}) {
  const limits = input.limits ?? SUPERVISION_DEFAULTS;
  const persistence = { ...defaultPersistence, ...input.persistence };
  const id = `supervision-${Date.now()}-${randomUUID()}`;
  await mkdir(input.artifacts, { recursive: true });
  const started = performance.now();
  const timestamp = new Date().toISOString();
  let stageStarted = started;
  let current: PerformanceProgress = { stage: "preparation", operation: "worker-start" };
  const owned: { pid?: number; heartbeat?: ReturnType<typeof setInterval> } = {};
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let grace: ReturnType<typeof setTimeout> | undefined;
  let cleanupDeadline: ReturnType<typeof setTimeout> | undefined;
  let failure: string | undefined;
  let finishedCode: number | undefined;
  let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  let diagnostics: Buffer = Buffer.alloc(0);
  let droppedDiagnosticBytes = 0;
  let droppedEvents = 0;
  const events: { elapsedMs: number; progress: PerformanceProgress }[] = [];
  const cleanupErrors: string[] = [];
  const finalizationErrors: string[] = [];
  let writes = Promise.resolve();
  let persistenceError = false;
  let diagnosticSaved: boolean | undefined;
  let terminating = false;
  let stopped = false;
  let forceSent = false;
  let settle: () => void = () => {};
  const completion = new Promise<void>((resolve) => {
    settle = resolve;
  });

  function snapshot(status: "running" | "completed" | "inconclusive") {
    return {
      schemaVersion: 1,
      kind: "performance-supervision",
      id,
      startedAt: timestamp,
      status,
      performanceAcceptance: "consult-formal-artifacts",
      limits,
      workerPid: owned.pid,
      elapsedMs: performance.now() - started,
      stageElapsedMs: performance.now() - stageStarted,
      current,
      events: [...events],
      droppedEvents,
      failure,
      exit,
      finishedCode,
      cleanupErrors: [...cleanupErrors],
      finalizationErrors: [...finalizationErrors],
      diagnostics: {
        filename: `${id}.diagnostic.log`,
        retainedBytes: diagnostics.length,
        droppedBytes: droppedDiagnosticBytes,
        saved: diagnosticSaved,
      },
    };
  }
  function persist(status: "running" | "completed" | "inconclusive") {
    const value = snapshot(status);
    writes = writes
      .then(() => persistence.writeSnapshot(input.artifacts, `${id}.json`, value))
      .catch(() => {
        persistenceError = true;
        terminate("supervision-persistence-failed");
      });
  }
  function report() {
    const line = `[performance] ${current.stage}/${current.operation} fixture=${current.fixture ?? "-"} adapter=${current.adapter ?? "-"} quantity=${current.quantity ?? "-"} phase=${current.phase ?? "-"} iteration=${current.iteration ?? "-"} state=${current.state ?? "-"} worker=${owned.pid ?? "-"} child=${current.pid ?? "-"} elapsed=${Math.round(performance.now() - started)}ms stageElapsed=${Math.round(performance.now() - stageStarted)}ms`;
    input.onProgress?.(line);
  }
  function armDeadline() {
    clearTimeout(deadline);
    const key = `${current.stage}Ms` as `${PerformanceStage}Ms`;
    deadline = setTimeout(() => terminate(`${current.stage}-deadline-exceeded`), limits[key]);
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    clearInterval(owned.heartbeat);
    clearTimeout(grace);
    clearTimeout(cleanupDeadline);
    settle();
  }
  function signalGroup(signal: NodeJS.Signals) {
    if (!owned.pid) return;
    try {
      process.kill(-owned.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH")
        cleanupErrors.push(`group-${signal}-failed`);
    }
  }
  function terminate(reason: string) {
    if (stopped || terminating) return;
    terminating = true;
    failure = reason;
    clearTimeout(deadline);
    // The detached worker is the leader of an owned Linux group. Child PIDs from IPC are never kill targets.
    signalGroup("SIGTERM");
    grace = setTimeout(() => {
      signalGroup("SIGKILL");
      forceSent = true;
      if (exit) stop();
      else
        cleanupDeadline = setTimeout(() => {
          cleanupErrors.push("worker-close-not-observed");
          stop();
        }, limits.cleanupWaitMs);
    }, limits.terminationGraceMs);
    persist("inconclusive");
  }
  function diagnostic(chunk: Buffer) {
    droppedDiagnosticBytes += Math.max(
      0,
      diagnostics.length + chunk.length - limits.diagnosticBytes,
    );
    diagnostics = boundedTail(diagnostics, chunk, limits.diagnosticBytes);
  }
  function reportFinalizationFailure(reason: string) {
    try {
      input.onFailure?.(`[performance] ${reason}`);
    } catch {
      // Operator diagnostics are best-effort and must not disrupt bounded finalization.
    }
  }

  if (process.platform !== "linux") {
    failure = "supervised-reference-workflow-requires-linux";
    await persistence.writeSnapshot(input.artifacts, `${id}.json`, snapshot("inconclusive"));
    return {
      exitCode: 2,
      status: "inconclusive" as const,
      failure,
      artifactPath: join(input.artifacts, `${id}.json`),
      terminalEvidenceSaved: true,
    };
  }
  // Refuse to launch if the first evidence write is unavailable.
  await persistence.writeSnapshot(input.artifacts, `${id}.json`, snapshot("running"));
  const worker = spawn(input.executable, [...input.args], {
    detached: true,
    env: {
      ...process.env,
      GITLODE_PERFORMANCE_SUPERVISED: "1",
      GITLODE_PERFORMANCE_ARTIFACTS: input.artifacts,
      GITLODE_PERFORMANCE_SUPERVISION_ID: id,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  owned.pid = worker.pid;
  const interrupt = () => terminate("operator-interrupted");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  worker.stdout?.on("data", (chunk: Buffer) => diagnostic(chunk));
  worker.stderr?.on("data", (chunk: Buffer) => diagnostic(chunk));
  worker.on("message", (message: unknown) => {
    if (terminating || stopped || !message || typeof message !== "object") return;
    const item = message as Record<string, unknown>;
    if (item.type === "performance-stage") {
      const progress = progressValue(item.progress);
      if (!progress) {
        terminate("invalid-stage-message");
        return;
      }
      current =
        progress.stage === "preparation"
          ? progress
          : { ...current, ...progress, pid: progress.pid };
      stageStarted = performance.now();
      events.push({ elapsedMs: stageStarted - started, progress });
      if (events.length > 256) {
        events.shift();
        droppedEvents++;
      }
      armDeadline();
      report();
      persist("running");
    } else if (
      item.type === "performance-child" &&
      Number.isSafeInteger(item.pid) &&
      (item.pid as number) > 0
    ) {
      current = { ...current, pid: item.pid as number };
      report();
      // PID updates and heartbeats never extend the stage deadline.
      persist("running");
    } else if (item.type === "performance-diagnostic" && typeof item.chunk === "string") {
      diagnostic(Buffer.from(item.chunk));
    } else if (
      item.type === "performance-finished" &&
      (item.exitCode === 0 || item.exitCode === 2)
    ) {
      finishedCode = item.exitCode;
    }
  });
  worker.once("error", () => terminate("worker-launch-failed"));
  worker.once("close", (code, signal) => {
    exit = { code, signal };
    if (terminating) {
      if (forceSent) stop();
      return; // Always complete the grace/KILL sequence, including orphaned descendants.
    }
    if (finishedCode === undefined || finishedCode !== code) {
      terminate("worker-exited-without-completion");
      return;
    }
    // Also remove any accidentally retained descendants on normal completion.
    signalGroup("SIGKILL");
    stop();
  });
  report();
  armDeadline();
  owned.heartbeat = setInterval(() => {
    report();
    persist(failure ? "inconclusive" : "running");
  }, limits.heartbeatMs);
  await completion;
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
  await writes;
  if (persistenceError) failure = "supervision-persistence-failed";
  if (cleanupErrors.length) failure ??= "process-cleanup-failed";
  // Raw bounded diagnostics are a separate local log, never embedded in formal calibration evidence.
  try {
    await persistence.writeDiagnostic(join(input.artifacts, `${id}.diagnostic.log`), diagnostics);
    diagnosticSaved = true;
  } catch {
    diagnosticSaved = false;
    finalizationErrors.push("final-diagnostic-write-failed");
    failure ??= "final-diagnostic-write-failed";
    reportFinalizationFailure("final diagnostic log write failed");
  }
  let terminalEvidenceSaved = false;
  try {
    await persistence.writeSnapshot(
      input.artifacts,
      `${id}.json`,
      snapshot(failure ? "inconclusive" : "completed"),
    );
    terminalEvidenceSaved = true;
  } catch {
    finalizationErrors.push("final-snapshot-write-failed");
    failure ??= "final-snapshot-write-failed";
    reportFinalizationFailure("final supervision snapshot write failed; attempting recovery once");
    try {
      await persistence.writeSnapshot(input.artifacts, `${id}.json`, snapshot("inconclusive"));
      terminalEvidenceSaved = true;
    } catch {
      finalizationErrors.push("terminal-snapshot-recovery-failed");
      reportFinalizationFailure(
        "terminal supervision snapshot recovery failed; no terminal artifact saved",
      );
    }
  }
  return {
    exitCode: failure ? 2 : (exit?.code ?? 2),
    status: failure ? ("inconclusive" as const) : ("completed" as const),
    failure,
    artifactPath: join(input.artifacts, `${id}.json`),
    terminalEvidenceSaved,
  };
}
