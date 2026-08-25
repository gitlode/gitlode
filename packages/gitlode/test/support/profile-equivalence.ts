import { readdir, readFile } from "node:fs/promises";

export interface BehavioralArtifacts<Result = unknown, Checkpoint = unknown> {
  readonly result: Result;
  readonly checkpoint: Checkpoint;
  readonly jsonl: readonly Uint8Array[];
}
export type ProfileModeRunner<Result, Checkpoint> = (
  profile: boolean,
) => Promise<BehavioralArtifacts<Result, Checkpoint>>;

function normalizeApplicationResult(value: unknown, repositoryPath?: string): unknown {
  if (!value || typeof value !== "object" || !("kind" in value)) return value;
  const result = value as Record<string, unknown>;
  if (result.kind !== "success" || !result.success || typeof result.success !== "object") {
    return value;
  }
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
  if (!repositoryPath || !value || typeof value !== "object" || !("repositoryPath" in value)) {
    return value;
  }
  return { ...(value as Record<string, unknown>), repositoryPath: "<repository>" };
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalJsonValue(item)]),
    );
  }
  return value;
}

function semanticJsonl(files: readonly Uint8Array[]): string[] {
  return files
    .flatMap((bytes) => new TextDecoder().decode(bytes).split("\n").filter(Boolean))
    .map((line) => JSON.stringify(canonicalJsonValue(JSON.parse(line))))
    .sort();
}

export async function readJsonlArtifacts(directory: string): Promise<readonly Uint8Array[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return await Promise.all(names.map(async (name) => await readFile(`${directory}/${name}`)));
}

export function frozenBehavioralBaseline(
  artifacts: BehavioralArtifacts,
  repositoryPath: string,
): unknown {
  return {
    result: normalizeApplicationResult(artifacts.result, repositoryPath),
    checkpoint: normalizeCheckpoint(artifacts.checkpoint, repositoryPath),
    jsonlFiles: artifacts.jsonl.map((bytes) => new TextDecoder().decode(bytes)),
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
    JSON.stringify(normalizeApplicationResult(left.result, repositoryPath)) !==
    JSON.stringify(normalizeApplicationResult(right.result, repositoryPath))
  )
    errors.push("application result differs");
  if (
    JSON.stringify(normalizeCheckpoint(left.checkpoint, repositoryPath)) !==
    JSON.stringify(normalizeCheckpoint(right.checkpoint, repositoryPath))
  )
    errors.push("checkpoint differs");
  if (mode === "same-adapter") {
    if (
      left.jsonl.length !== right.jsonl.length ||
      left.jsonl.some(
        (file, index) => !Buffer.from(file).equals(Buffer.from(right.jsonl[index] ?? [])),
      )
    )
      errors.push("JSONL file sequence or bytes differ");
  } else if (
    JSON.stringify(semanticJsonl(left.jsonl)) !== JSON.stringify(semanticJsonl(right.jsonl))
  )
    errors.push("JSONL semantic record sets differ");
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
