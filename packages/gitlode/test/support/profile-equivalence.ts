import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface JsonlArtifact {
  readonly name: string;
  readonly bytes: Uint8Array;
}
export interface BehavioralArtifacts<Result = unknown, Checkpoint = unknown> {
  readonly result: Result;
  readonly checkpoint: Checkpoint;
  readonly jsonl: readonly JsonlArtifact[];
}
export type ProfileModeRunner<Result, Checkpoint> = (
  profile: boolean,
) => Promise<BehavioralArtifacts<Result, Checkpoint>>;

function normalizeApplicationResult(value: unknown, repositoryPath?: string): unknown {
  if (!value || typeof value !== "object" || !("kind" in value)) return value;
  const result = value as Record<string, unknown>;
  if (result.kind !== "success" || !result.success || typeof result.success !== "object")
    return value;
  const {
    elapsedMs: _elapsedMs,
    profileEntries: _profileEntries,
    ...success
  } = result.success as Record<string, unknown>;
  return {
    ...result,
    success,
    ...(result.checkpoint === undefined
      ? {}
      : { checkpoint: normalizeCheckpoint(result.checkpoint, repositoryPath) }),
  };
}

function normalizeCheckpoint(value: unknown, repositoryPath?: string): unknown {
  if (!repositoryPath || !value || typeof value !== "object" || !("repositoryPath" in value))
    return value;
  const checkpoint = value as Record<string, unknown>;
  return checkpoint.repositoryPath === repositoryPath
    ? { ...checkpoint, repositoryPath: "<repository>" }
    : checkpoint;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}
function semanticJsonl(files: readonly JsonlArtifact[]): string[] {
  return files
    .flatMap(({ bytes }) => new TextDecoder().decode(bytes).split("\n").filter(Boolean))
    .map((line) => JSON.stringify(canonicalValue(JSON.parse(line))))
    .sort();
}

export async function readJsonlArtifacts(directory: string): Promise<readonly JsonlArtifact[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return await Promise.all(
    names.map(async (name) => ({ name, bytes: await readFile(join(directory, name)) })),
  );
}

export function frozenBehavioralBaseline(
  artifacts: BehavioralArtifacts,
  repositoryPath: string,
): unknown {
  return {
    checkpoint: canonicalValue(normalizeCheckpoint(artifacts.checkpoint, repositoryPath)),
    jsonlFiles: artifacts.jsonl.map(({ name, bytes }) => ({
      name,
      content: new TextDecoder().decode(bytes),
    })),
    result: canonicalValue(normalizeApplicationResult(artifacts.result, repositoryPath)),
  };
}

export function compareBehavioralArtifacts(
  left: BehavioralArtifacts,
  right: BehavioralArtifacts,
  mode: "same-adapter" | "cross-adapter" = "same-adapter",
  repositoryPath?: string,
): string[] {
  const errors: string[] = [];
  if (
    JSON.stringify(canonicalValue(normalizeApplicationResult(left.result, repositoryPath))) !==
    JSON.stringify(canonicalValue(normalizeApplicationResult(right.result, repositoryPath)))
  )
    errors.push("application result differs");
  if (
    JSON.stringify(canonicalValue(normalizeCheckpoint(left.checkpoint, repositoryPath))) !==
    JSON.stringify(canonicalValue(normalizeCheckpoint(right.checkpoint, repositoryPath)))
  )
    errors.push("checkpoint differs");
  if (mode === "same-adapter") {
    if (
      left.jsonl.length !== right.jsonl.length ||
      left.jsonl.some((file, index) => {
        const other = right.jsonl[index];
        return (
          file.name !== other?.name ||
          !Buffer.from(file.bytes).equals(Buffer.from(other?.bytes ?? []))
        );
      })
    )
      errors.push("JSONL filename, file sequence, or bytes differ");
  } else if (
    JSON.stringify(semanticJsonl(left.jsonl)) !== JSON.stringify(semanticJsonl(right.jsonl))
  ) {
    errors.push("JSONL semantic record sets differ");
  }
  return errors;
}

export async function verifyProfileEquivalence<Result, Checkpoint>(
  runner: ProfileModeRunner<Result, Checkpoint>,
  repositoryPath?: string,
): Promise<{
  disabled: BehavioralArtifacts<Result, Checkpoint>;
  enabled: BehavioralArtifacts<Result, Checkpoint>;
}> {
  const disabled = await runner(false);
  const enabled = await runner(true);
  const errors = compareBehavioralArtifacts(disabled, enabled, "same-adapter", repositoryPath);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return { disabled, enabled };
}
