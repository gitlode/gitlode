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

export const requiredTelemetryAggregationChecks = [
  "aggregation_span_groups",
  "aggregation_metric_datapoints",
  "aggregation_histogram_buckets",
  "aggregation_raw_observation_retention",
  "aggregation_profile_rss_growth",
] as const;

export const requiredTelemetryRepositoryChecks = [
  "repository_profile_report",
  "report_size",
  "prohibited_host_spans",
] as const;

export const requiredTelemetryRepositoryProfileReportSubchecks = [
  "sidecarAvailable",
  "reportPresent",
  "schemaValid",
  "spansComplete",
  "countersComplete",
  "histogramsComplete",
  "diagnosticsPresent",
  "diagnosticsEmpty",
] as const;

export const requiredTelemetryGitCommandParityTargets = [
  "commit_heavy_repository/git-cli",
  "file_heavy_repository/git-cli",
] as const;
