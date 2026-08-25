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
