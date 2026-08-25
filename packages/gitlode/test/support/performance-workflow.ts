import {
  validateCalibrationMatrix,
  type CalibrationTarget,
  type FixtureManifest,
} from "./performance-harness.js";

export const repositoryFixtures = [
  "commit_heavy_repository",
  "file_heavy_repository",
  "plugin_heavy_projection",
] as const;
export type RepositoryFixture = (typeof repositoryFixtures)[number];
export function parseFixture(value: string): RepositoryFixture | "aggregation_scale" {
  if ([...repositoryFixtures, "aggregation_scale"].includes(value as never))
    return value as RepositoryFixture | "aggregation_scale";
  throw new Error(`invalid fixture: ${value}`);
}
export function parseAdapter(value: string): "isomorphic-git" | "git-cli" {
  if (value === "isomorphic-git" || value === "git-cli") return value;
  throw new Error(`invalid adapter: ${value}`);
}
export function parseState(value: string): "target_off" | "target_on" {
  if (value === "target_off" || value === "target_on") return value;
  throw new Error(`invalid candidate state: ${value}`);
}
export function parseComparison(value: string): "disabled_overhead" | "profile_overhead" {
  if (value === "disabled_overhead" || value === "profile_overhead") return value;
  throw new Error(`invalid comparison: ${value}`);
}
export function calibrationKey(fixture: RepositoryFixture, adapter: "isomorphic-git" | "git-cli") {
  return `${fixture}/${adapter}`;
}
export function requireTarget(
  manifest: FixtureManifest,
  fixture: RepositoryFixture,
  adapter: "isomorphic-git" | "git-cli",
  complete = false,
): CalibrationTarget {
  if (fixture === "plugin_heavy_projection" && adapter !== "isomorphic-git")
    throw new Error("plugin_heavy_projection requires isomorphic-git");
  const target = manifest.calibrationTargets[calibrationKey(fixture, adapter)];
  if (!target) throw new Error("calibration target is absent from manifest");
  if (complete && target.status !== "complete")
    throw new Error(
      `formal measurement requires completed calibration: ${calibrationKey(fixture, adapter)}`,
    );
  return target;
}

export function validateFixtureManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["manifest must be an object"];
  const manifest = value as Partial<FixtureManifest>;
  if (manifest.schemaVersion !== 2) errors.push("manifest schemaVersion must be 2");
  if (typeof manifest.recipeRevision !== "string" || !manifest.recipeRevision)
    errors.push("manifest recipeRevision is required");
  if (!manifest.calibrationTargets || typeof manifest.calibrationTargets !== "object")
    errors.push("manifest calibrationTargets are required");
  else {
    errors.push(...validateCalibrationMatrix(manifest as FixtureManifest));
    for (const [key, target] of Object.entries(manifest.calibrationTargets)) {
      if (!target || (target.status !== "complete" && target.status !== "incomplete")) {
        errors.push(`${key} has invalid status`);
        continue;
      }
      const quantities = target.quantities;
      for (const name of ["commits", "files", "plugins", "rotations", "scale"] as const)
        if (!Number.isSafeInteger(quantities?.[name]) || (quantities?.[name] ?? -1) < 0)
          errors.push(`${key} has invalid ${name} quantity`);
      if (target.status === "complete" && (!target.environmentRef || !target.artifactRef))
        errors.push(`${key} complete target requires environmentRef and artifactRef`);
      if (target.status === "incomplete" && !target.reason)
        errors.push(`${key} incomplete target requires reason`);
      const [fixture, adapter] = key.split("/");
      if ((quantities?.commits ?? 0) < 5)
        errors.push(`${key} commits must be a final total of at least 5`);
      if (fixture === "commit_heavy_repository") {
        if (quantities?.files !== 1 || quantities.rotations !== 1)
          errors.push(`${key} commit-heavy files and rotations must be 1`);
        if (quantities?.plugins !== 0 || quantities.scale !== 0)
          errors.push(`${key} commit-heavy plugins and scale must be 0`);
      } else if (fixture === "file_heavy_repository") {
        if ((quantities?.files ?? 0) <= 0 || (quantities?.rotations ?? 0) <= 0)
          errors.push(`${key} file-heavy files and rotations must be positive`);
        const scalableRecords =
          10 + Math.max(0, ((quantities?.commits ?? 5) - 5) * (quantities?.files ?? 0));
        if ((quantities?.rotations ?? 0) > scalableRecords)
          errors.push(`${key} file-heavy rotations exceed the deterministic recipe volume`);
        if (quantities?.plugins !== 0 || quantities.scale !== 0)
          errors.push(`${key} file-heavy plugins and scale must be 0`);
      } else if (fixture === "plugin_heavy_projection") {
        if (adapter !== "isomorphic-git")
          errors.push(`${key} plugin-heavy adapter must be isomorphic-git`);
        if ((quantities?.files ?? 0) <= 0 || (quantities?.plugins ?? 0) < 2)
          errors.push(`${key} plugin-heavy requires files and at least two plugins`);
        if (quantities?.scale !== 0) errors.push(`${key} plugin-heavy scale must be 0`);
      }
    }
  }
  const aggregation = manifest.aggregationScale;
  if (
    aggregation?.status !== "fixed-recipe" ||
    aggregation.integration !== "pending-target-collector" ||
    Object.keys(aggregation?.quantities ?? {}).some((key) => key !== "scale") ||
    !Number.isSafeInteger(aggregation.quantities?.scale) ||
    (aggregation.quantities?.scale ?? 0) <= 0
  )
    errors.push("aggregationScale recipe is invalid");
  return errors;
}
export function rotationLinesFor(records: number, rotations: number): number {
  if (
    !Number.isSafeInteger(records) ||
    !Number.isSafeInteger(rotations) ||
    records < 1 ||
    rotations < 1
  )
    throw new Error("rotation recipe requires positive integer records and rotations");
  for (let lines = 1; lines <= records; lines++)
    if (Math.ceil(records / lines) === rotations) return lines;
  throw new Error(`cannot produce exactly ${rotations} rotations from ${records} records`);
}
