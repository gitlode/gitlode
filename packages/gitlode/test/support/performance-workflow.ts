import type { CalibrationTarget, FixtureManifest } from "./performance-harness.js";

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
