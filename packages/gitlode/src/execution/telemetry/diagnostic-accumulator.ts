import {
  compareCodeUnits,
  PROFILE_COLLECTION_LIMITS,
  PROFILE_DIAGNOSTIC_SEVERITY,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileDiagnostic,
  ProfileDiagnosticCode,
  ProfileDiagnosticSignal,
  ProfileDiagnosticStage,
} from "@gitlode/internal-contracts/telemetry";

export interface ProfileDiagnosticInput {
  readonly code: ProfileDiagnosticCode;
  readonly stage: ProfileDiagnosticStage;
  readonly signal: ProfileDiagnosticSignal;
  readonly message?: unknown;
}

const overflowIdentity = {
  code: "diagnostic_overflow",
  stage: "report_build",
  signal: "report",
  message: null,
} as const;

export function normalizeTelemetryFailureMessage(message: unknown): string | null {
  if (typeof message !== "string") return null;
  return message.slice(0, PROFILE_COLLECTION_LIMITS.diagnosticMessageUtf16CodeUnits);
}

function keyOf(input: {
  code: ProfileDiagnosticCode;
  stage: ProfileDiagnosticStage;
  signal: ProfileDiagnosticSignal;
  message: string | null;
}): string {
  return JSON.stringify([input.code, input.stage, input.signal, input.message]);
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : -1;
  if (right === null) return 1;
  return compareCodeUnits(left, right);
}

export class BoundedDiagnosticAccumulator {
  readonly #entries = new Map<string, ProfileDiagnostic>();
  #overflowCount = 0;

  add(input: ProfileDiagnosticInput): void {
    try {
      const normalized = {
        code: input.code,
        stage: input.stage,
        signal: input.signal,
        message: normalizeTelemetryFailureMessage(input.message),
      };
      if (normalized.code === overflowIdentity.code) {
        this.#overflowCount += 1;
        return;
      }
      const key = keyOf(normalized);
      const current = this.#entries.get(key);
      if (current) {
        this.#entries.set(key, { ...current, count: current.count + 1 } as ProfileDiagnostic);
        return;
      }
      const ordinaryCapacity =
        PROFILE_COLLECTION_LIMITS.diagnostics.maximum -
        PROFILE_COLLECTION_LIMITS.diagnostics.overflowReservedEntries;
      if (this.#entries.size >= ordinaryCapacity) {
        this.#overflowCount += 1;
        return;
      }
      this.#entries.set(key, {
        ...normalized,
        severity: PROFILE_DIAGNOSTIC_SEVERITY[normalized.code],
        count: 1,
      } as ProfileDiagnostic);
    } catch {
      this.#overflowCount += 1;
    }
  }

  hasExplanation(signal: ProfileDiagnosticSignal): boolean {
    try {
      if (this.#overflowCount > 0) return true;
      return [...this.#entries.values()].some(
        (entry) =>
          entry.signal === signal || entry.signal === "report" || entry.signal === "telemetry",
      );
    } catch {
      return true;
    }
  }

  snapshot(): ProfileDiagnostic[] {
    try {
      const entries = [...this.#entries.values()].map((entry) => ({ ...entry }));
      if (this.#overflowCount > 0) {
        entries.push({
          ...overflowIdentity,
          severity: PROFILE_DIAGNOSTIC_SEVERITY.diagnostic_overflow,
          count: this.#overflowCount,
        });
      }
      return entries.sort((left, right) => {
        const byCode = compareCodeUnits(left.code, right.code);
        if (byCode !== 0) return byCode;
        const byStage = compareCodeUnits(left.stage, right.stage);
        if (byStage !== 0) return byStage;
        const bySignal = compareCodeUnits(left.signal, right.signal);
        return bySignal !== 0 ? bySignal : compareNullable(left.message, right.message);
      });
    } catch {
      return [
        {
          ...overflowIdentity,
          severity: PROFILE_DIAGNOSTIC_SEVERITY.diagnostic_overflow,
          count: Math.max(1, this.#overflowCount),
        },
      ];
    }
  }
}
