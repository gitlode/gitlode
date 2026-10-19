import { writeAtomicJson } from "./atomic-json.js";

export type PerformanceStage = "preparation" | "execution" | "processing";
export interface PerformanceProgress {
  readonly stage: PerformanceStage;
  readonly operation: string;
  readonly fixture?: string;
  readonly adapter?: string;
  readonly quantity?: number;
  readonly phase?: string;
  readonly iteration?: number;
  readonly state?: string;
  readonly pid?: number;
}

const enabled = () => process.env.GITLODE_PERFORMANCE_SUPERVISED === "1" && process.connected;

/** Development-only IPC. Stage events contain identifiers, never arguments or temporary paths. */
export function performanceStage(progress: PerformanceProgress): void {
  if (enabled()) process.send?.({ type: "performance-stage", progress });
}

export function performanceChild(pid: number | undefined): void {
  if (enabled() && pid !== undefined) process.send?.({ type: "performance-child", pid });
}

/** Bounded caller-provided diagnostics are stored separately from formal artifacts. */
export function performanceDiagnostic(chunk: string): void {
  if (enabled()) process.send?.({ type: "performance-diagnostic", chunk });
}

/** Preserve completed work before starting another possibly stalled child. */
export async function performanceEvidence(label: string, value: unknown): Promise<void> {
  if (!enabled()) return;
  const directory = process.env.GITLODE_PERFORMANCE_ARTIFACTS;
  const id = process.env.GITLODE_PERFORMANCE_SUPERVISION_ID;
  if (!directory || !id) throw new Error("missing supervision evidence destination");
  await writeAtomicJson(directory, `${id}-${label}.json`, value);
}

export async function performanceFinished(): Promise<void> {
  if (!enabled()) return;
  await new Promise<void>((resolve, reject) => {
    process.send?.(
      { type: "performance-finished", exitCode: process.exitCode ?? 0 },
      (error: Error | null) => (error ? reject(error) : resolve()),
    );
  });
  process.disconnect?.();
}
