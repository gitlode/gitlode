import { readdir, readFile } from "node:fs/promises";

export interface BehavioralArtifacts<Result = unknown, Checkpoint = unknown> {
  readonly result: Result;
  readonly checkpoint: Checkpoint;
  readonly jsonl: readonly Uint8Array[];
}
export type ProfileModeRunner<Result, Checkpoint> = (
  profile: boolean,
) => Promise<BehavioralArtifacts<Result, Checkpoint>>;

const excludedResultKeys = new Set([
  "elapsedMs",
  "profile",
  "profileEntries",
  "profileReport",
  "outputDir",
  "outputPath",
  "temporaryPath",
  "telemetryDiagnostics",
  "diagnostics",
]);
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !excludedResultKeys.has(key))
        .map(([key, item]) => [key, normalized(item)]),
    );
  return value;
}
function semanticJsonl(files: readonly Uint8Array[]): string[] {
  return files
    .flatMap((bytes) => new TextDecoder().decode(bytes).split("\n").filter(Boolean))
    .map((line) => JSON.stringify(JSON.parse(line)))
    .sort();
}

export async function readJsonlArtifacts(directory: string): Promise<readonly Uint8Array[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return await Promise.all(names.map(async (name) => await readFile(`${directory}/${name}`)));
}

export function compareBehavioralArtifacts(
  left: BehavioralArtifacts,
  right: BehavioralArtifacts,
  mode: "same-adapter" | "cross-adapter" = "same-adapter",
): string[] {
  const errors: string[] = [];
  if (JSON.stringify(normalized(left.result)) !== JSON.stringify(normalized(right.result)))
    errors.push("application result differs");
  if (JSON.stringify(normalized(left.checkpoint)) !== JSON.stringify(normalized(right.checkpoint)))
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
): Promise<{
  disabled: BehavioralArtifacts<Result, Checkpoint>;
  enabled: BehavioralArtifacts<Result, Checkpoint>;
}> {
  const disabled = await runner(false);
  const enabled = await runner(true);
  const errors = compareBehavioralArtifacts(disabled, enabled);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return { disabled, enabled };
}
