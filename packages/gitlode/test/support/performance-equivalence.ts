import { createHash } from "node:crypto";

import type { JsonlArtifact } from "./profile-equivalence.js";

export interface DerivedOutput {
  readonly records: number;
  readonly commits: number;
  readonly skippedDiffs: number;
  readonly files: number;
  readonly bytes: number;
}
export interface PerformanceBehavior {
  readonly exit: { readonly code: number | null; readonly signal: NodeJS.Signals | null };
  readonly checkpoint: unknown;
  readonly jsonl: readonly JsonlArtifact[];
  readonly derived: DerivedOutput;
  readonly captureErrors: readonly string[];
}
const filename = /^(.*)-(\d{8}T\d{6}Z)-(\d{6})(\.jsonl)$/;
export function normalizePerformanceFilename(name: string): string {
  const match = filename.exec(name);
  if (!match) throw new Error(`invalid gitlode output filename: ${name}`);
  return `${match[1]}-<session>-${match[3]}${match[4]}`;
}
function normalizeCheckpoint(
  checkpoint: unknown,
  repositoryPath: string,
  generatedAt: string,
): unknown {
  if (!checkpoint || typeof checkpoint !== "object") return checkpoint;
  const value = checkpoint as Record<string, unknown>;
  return {
    ...value,
    ...(value.repositoryPath === repositoryPath ? { repositoryPath: "<repository>" } : {}),
    ...(value.generatedAt === generatedAt ? { generatedAt: "<session>" } : {}),
  };
}
export function comparePerformanceBehavior(
  baseline: PerformanceBehavior,
  candidate: PerformanceBehavior,
  input: { repositoryPath: string; baselineGeneratedAt: string; candidateGeneratedAt: string },
): string[] {
  const errors: string[] = [];
  errors.push(...baseline.captureErrors, ...candidate.captureErrors);
  const baselineCheckpoint = baseline.checkpoint as Record<string, unknown> | null;
  const candidateCheckpoint = candidate.checkpoint as Record<string, unknown> | null;
  if (!baselineCheckpoint) errors.push("baseline checkpoint is missing or malformed");
  if (!candidateCheckpoint) errors.push("candidate checkpoint is missing or malformed");
  if (baselineCheckpoint?.repositoryPath !== input.repositoryPath)
    errors.push("baseline checkpoint repositoryPath differs from harness repository");
  if (candidateCheckpoint?.repositoryPath !== input.repositoryPath)
    errors.push("candidate checkpoint repositoryPath differs from harness repository");
  if (JSON.stringify(baseline.exit) !== JSON.stringify(candidate.exit))
    errors.push("exit classification differs");
  if (JSON.stringify(baseline.derived) !== JSON.stringify(candidate.derived))
    errors.push("derived output measurements differ");
  if (
    JSON.stringify(
      normalizeCheckpoint(baseline.checkpoint, input.repositoryPath, input.baselineGeneratedAt),
    ) !==
    JSON.stringify(
      normalizeCheckpoint(candidate.checkpoint, input.repositoryPath, input.candidateGeneratedAt),
    )
  )
    errors.push("checkpoint differs");
  if (baseline.jsonl.length !== candidate.jsonl.length) errors.push("JSONL file count differs");
  else
    for (let index = 0; index < baseline.jsonl.length; index++) {
      const left = baseline.jsonl[index],
        right = candidate.jsonl[index];
      try {
        if (
          !left ||
          !right ||
          normalizePerformanceFilename(left.name) !== normalizePerformanceFilename(right.name)
        )
          errors.push("JSONL prefix, sequence, or extension differs");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "invalid output filename");
      }
      if (!left || !right || !Buffer.from(left.bytes).equals(Buffer.from(right.bytes)))
        errors.push("JSONL bytes or ordering differs");
    }
  return [...new Set(errors)];
}
export function performanceBehaviorEvidence(behavior: PerformanceBehavior, repositoryPath: string) {
  const generatedAt = (behavior.checkpoint as { generatedAt?: unknown } | null)?.generatedAt;
  const evidenceErrors = [...behavior.captureErrors];
  if (typeof generatedAt !== "string") evidenceErrors.push("checkpoint generatedAt unavailable");
  const checkpoint =
    typeof generatedAt === "string"
      ? normalizeCheckpoint(behavior.checkpoint, repositoryPath, generatedAt)
      : behavior.checkpoint;
  if (
    (behavior.checkpoint as { repositoryPath?: unknown } | null)?.repositoryPath !== repositoryPath
  )
    evidenceErrors.push("checkpoint repositoryPath differs from harness repository");
  const files = behavior.jsonl.map(({ name, bytes }) => {
    let normalizedName = name;
    try {
      normalizedName = normalizePerformanceFilename(name);
    } catch {
      evidenceErrors.push(`invalid gitlode output filename: ${name}`);
    }
    return {
      name: normalizedName,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.byteLength,
    };
  });
  return {
    exit: behavior.exit,
    checkpoint,
    derived: behavior.derived,
    files,
    captureErrors: [...new Set(evidenceErrors)],
  };
}
