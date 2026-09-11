export const requiredTelemetryPerformanceTargets = [
  "commit_heavy_repository/isomorphic-git",
  "commit_heavy_repository/git-cli",
  "file_heavy_repository/isomorphic-git",
  "file_heavy_repository/git-cli",
  "plugin_heavy_projection/isomorphic-git",
] as const;

export const requiredTelemetryPerformanceComparisons = [
  "disabled_overhead",
  "profile_overhead",
] as const;
