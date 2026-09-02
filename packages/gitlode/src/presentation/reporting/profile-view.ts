type ProfileViewKind = "span" | "metric";

interface ProfileViewEntry {
  readonly ref: string;
  readonly name: string;
  readonly scope: string | "resolved_plugin_scope";
  readonly label: string;
  readonly group: string;
  readonly order: number;
}

const core = (
  ref: string,
  name: string,
  scope: string,
  label: string,
  group: string,
  order: number,
): ProfileViewEntry => ({ ref, name, scope, label, group, order });
const plugin = (ref: string, name: string, label: string, order: number): ProfileViewEntry =>
  core(ref, name, "resolved_plugin_scope", label, "Plugins", order);

export const PROFILE_SPAN_VIEW: readonly ProfileViewEntry[] = [
  core("run", "gitlode.run", "gitlode.execution", "Run", "Overview", 0),
  core(
    "repository_access_validate",
    "gitlode.repository.access.validate",
    "gitlode.execution",
    "Repository access",
    "Setup",
    10,
  ),
  core(
    "repository_object_format_resolve",
    "gitlode.repository.object_format.resolve",
    "gitlode.execution",
    "Object format",
    "Setup",
    11,
  ),
  core(
    "state_validate",
    "gitlode.state.validate",
    "gitlode.execution",
    "State validation",
    "Setup",
    12,
  ),
  core(
    "repository_metadata_resolve",
    "gitlode.repository.metadata.resolve",
    "gitlode.execution",
    "Repository metadata",
    "Setup",
    13,
  ),
  core(
    "extraction_range_resolve",
    "gitlode.extraction.range.resolve",
    "gitlode.execution",
    "Extraction range",
    "Setup",
    14,
  ),
  core(
    "plugin_bootstrap",
    "gitlode.plugin.bootstrap",
    "gitlode.plugin_runtime",
    "Plugin bootstrap",
    "Setup",
    15,
  ),
  core(
    "plugin_resolve",
    "gitlode.plugin.resolve",
    "gitlode.plugin_runtime",
    "Plugin resolution",
    "Setup",
    16,
  ),
  core(
    "plugin_compatibility_check",
    "gitlode.plugin.compatibility.check",
    "gitlode.plugin_runtime",
    "Plugin compatibility",
    "Setup",
    17,
  ),
  core("extract", "gitlode.extract", "gitlode.extraction", "Extraction", "Pipeline", 20),
  core("planning", "gitlode.planning", "gitlode.extraction", "Planning", "Pipeline", 21),
  core("traversal", "gitlode.traversal", "gitlode.extraction", "Traversal", "Pipeline", 22),
  core("projection", "gitlode.projection", "gitlode.extraction", "Projection", "Pipeline", 23),
  core(
    "output_close",
    "gitlode.output.close",
    "gitlode.extraction",
    "Output close",
    "Pipeline",
    24,
  ),
  core(
    "git_cli_version_check",
    "gitlode.git.cli.version.check",
    "gitlode.git",
    "CLI version check",
    "Git operations",
    30,
  ),
  core(
    "git_resolve_ref",
    "gitlode.git.resolve_ref",
    "gitlode.git",
    "Resolve ref",
    "Git operations",
    31,
  ),
  core(
    "git_classify_ref",
    "gitlode.git.classify_ref",
    "gitlode.git",
    "Classify ref",
    "Git operations",
    32,
  ),
  core(
    "git_repository_object_format",
    "gitlode.git.repository_object_format",
    "gitlode.git",
    "Repository object format",
    "Git operations",
    33,
  ),
  core(
    "git_remote_url_resolve",
    "gitlode.git.remote_url.resolve",
    "gitlode.git",
    "Resolve remote URL",
    "Git operations",
    34,
  ),
  core(
    "git_merge_base",
    "gitlode.git.merge_base",
    "gitlode.git",
    "Merge base",
    "Git operations",
    35,
  ),
  core(
    "git_commit_walk",
    "gitlode.git.commit.walk",
    "gitlode.git",
    "Commit walk",
    "Git traversal",
    40,
  ),
  core(
    "git_cli_rev_list",
    "gitlode.git.cli.rev_list",
    "gitlode.git",
    "CLI rev-list",
    "Git traversal",
    41,
  ),
  core(
    "git_cli_commit_batch",
    "gitlode.git.cli.commit_batch",
    "gitlode.git",
    "CLI commit batch",
    "Git traversal",
    42,
  ),
  core(
    "git_cli_diff_tree",
    "gitlode.git.cli.diff_tree",
    "gitlode.git",
    "CLI diff-tree",
    "Git file access",
    50,
  ),
  core(
    "git_cli_file_blob_batch",
    "gitlode.git.cli.file_blob_batch",
    "gitlode.git",
    "CLI file blob batch",
    "Git file access",
    51,
  ),
  core("dag_traversal", "gitlode.dag.traversal", "gitlode.dag", "DAG traversal", "DAG", 60),
  core("dag_reachable", "gitlode.dag.reachable", "gitlode.dag", "Reachable traversal", "DAG", 61),
  core(
    "dag_certified_closure",
    "gitlode.dag.certified_closure",
    "gitlode.dag",
    "Certified closure",
    "DAG",
    62,
  ),
  plugin("plugin_init", "gitlode.plugin.init", "Initialization", 70),
];

const metricRows: readonly [string, string, string, string, number][] = [
  [
    "extraction_commit_accepted",
    "gitlode.extraction.commit.accepted",
    "gitlode.extraction",
    "Accepted commits",
    0,
  ],
  ["git_commit_yielded", "gitlode.git.commit.yielded", "gitlode.git", "Yielded commits", 10],
  ["git_object_read", "gitlode.git.object.read", "gitlode.git", "Object reads", 20],
  [
    "git_object_cache_lookup",
    "gitlode.git.object.cache.lookup",
    "gitlode.git",
    "Cache lookups",
    21,
  ],
  ["git_object_cache_hit", "gitlode.git.object.cache.hit", "gitlode.git", "Cache hits", 22],
  [
    "git_blob_read_duration",
    "gitlode.git.blob.read.duration",
    "gitlode.git",
    "Blob-read duration",
    23,
  ],
  ["git_blob_read_size", "gitlode.git.blob.read.size", "gitlode.git", "Blob-read size", 24],
  ["git_blob_read_byte", "gitlode.git.blob.read.byte", "gitlode.git", "Blob bytes", 25],
  ["git_file_change_yielded", "gitlode.git.file_change.yielded", "gitlode.git", "File changes", 30],
  [
    "dag_operation_completion",
    "gitlode.dag.operation.completion",
    "gitlode.dag",
    "Operation completion",
    40,
  ],
  ["dag_step_processed", "gitlode.dag.step.processed", "gitlode.dag", "Processed steps", 41],
  ["dag_step_stale", "gitlode.dag.step.stale", "gitlode.dag", "Stale steps", 42],
  [
    "dag_successor_expansion",
    "gitlode.dag.successor.expansion",
    "gitlode.dag",
    "Successor expansions",
    43,
  ],
  ["dag_node_yielded", "gitlode.dag.node.yielded", "gitlode.dag", "Yielded nodes", 44],
  ["dag_node_excluded", "gitlode.dag.node.excluded", "gitlode.dag", "Excluded nodes", 45],
  ["dag_fallback", "gitlode.dag.fallback", "gitlode.dag", "Fallbacks", 46],
  [
    "dag_fallback_node_removed",
    "gitlode.dag.fallback.node.removed",
    "gitlode.dag",
    "Fallback-removed nodes",
    47,
  ],
  [
    "file_change_expansion_duration",
    "gitlode.file_change.expansion.duration",
    "gitlode.extraction",
    "Expansion duration",
    50,
  ],
  [
    "file_change_expanded",
    "gitlode.file_change.expanded",
    "gitlode.extraction",
    "Expanded changes",
    51,
  ],
  [
    "file_change_expansion_size",
    "gitlode.file_change.expansion.size",
    "gitlode.extraction",
    "Changes per commit",
    52,
  ],
  [
    "file_change_diff_skipped",
    "gitlode.file_change.diff.skipped",
    "gitlode.extraction",
    "Skipped diffs",
    53,
  ],
  [
    "line_diff_compute_operation",
    "gitlode.line_diff.compute.operation",
    "gitlode.line_diff",
    "Diff operations",
    60,
  ],
  [
    "line_diff_compute_duration",
    "gitlode.line_diff.compute.duration",
    "gitlode.line_diff",
    "Diff duration",
    61,
  ],
  [
    "line_diff_compute_input_size",
    "gitlode.line_diff.compute.input.size",
    "gitlode.line_diff",
    "Diff input size",
    62,
  ],
  [
    "projection_duration",
    "gitlode.projection.duration",
    "gitlode.extraction",
    "Built-in projection",
    70,
  ],
  [
    "output_write_record",
    "gitlode.output.write.record",
    "gitlode.extraction",
    "Records written",
    80,
  ],
  [
    "output_write_duration",
    "gitlode.output.write.duration",
    "gitlode.extraction",
    "Write duration",
    81,
  ],
  ["output_file_created", "gitlode.output.file.created", "gitlode.extraction", "Files created", 82],
  ["output_byte_written", "gitlode.output.byte.written", "gitlode.extraction", "Bytes written", 83],
];
export const PROFILE_METRIC_VIEW: readonly ProfileViewEntry[] = [
  ...metricRows.map(([ref, name, scope, label, order]) =>
    core(ref, name, scope, label, metricGroup(ref), order),
  ),
  plugin(
    "plugin_projection_operation",
    "gitlode.plugin.projection.operation",
    "Projection operations",
    90,
  ),
  plugin(
    "plugin_projection_duration",
    "gitlode.plugin.projection.duration",
    "Projection duration",
    91,
  ),
];

function metricGroup(ref: string): string {
  if (ref.startsWith("git_commit")) return "Git traversal";
  if (ref.startsWith("git_object") || ref.startsWith("git_blob")) return "Git object access";
  if (ref.startsWith("git_file")) return "Git file access";
  if (ref.startsWith("dag_")) return "DAG";
  if (ref.startsWith("file_change_")) return "File expansion";
  if (ref.startsWith("line_diff_")) return "Line diff";
  if (ref.startsWith("projection_")) return "Projection";
  if (ref.startsWith("output_")) return "Output";
  return "Pipeline";
}

export const PROFILE_VIEW_DIAGNOSTIC_LABELS: Readonly<Record<string, string>> = {
  span_group_overflow: "Span groups truncated",
  span_attribute_value_overflow: "Span attribute values truncated",
  metric_point_overflow: "Metric datapoints truncated",
  attribute_reducer_conflict: "Span attribute invariant violated",
  invalid_aggregation: "Invalid aggregation discarded",
  lifecycle_failure: "Telemetry lifecycle stage failed",
  diagnostic_overflow: "Additional diagnostics omitted",
};

export const PROFILE_PRESENTATION_POLICY = {
  signalSections: ["spans", "counters", "histograms", "diagnostics"],
  sectionPolicy: {
    completeEmpty: "omit",
    partial: { showSection: true, statusLabel: "partial" },
    unavailable: { showSection: true, statusLabel: "unavailable", rows: "none" },
  },
  plugin: {
    outerGroup: "Plugins",
    subgroupOrder: ["scope"],
    versionPresent: "<scope-name>@<version>",
    versionAbsent: "<scope-name>",
    remainder: "name",
  },
  fallback: {
    includeUnknown: true,
    identityVersionPresent: "<scope-name>@<version> / <observation-name>",
    identityVersionAbsent: "<scope-name> / <observation-name>",
    spans: { group: "Other spans", sort: ["scope", "name"] },
    counters: { group: "Other counters", sort: ["scope", "name", "attributes"] },
    histograms: { group: "Other histograms", sort: ["scope", "name", "attributes"] },
    knownNameUnexpectedScope: "treat_as_unknown",
    pluginUnknownSpans: "include_in_plugins_remainder",
  },
  units: {
    seconds: ["ns", "µs", "ms", "s"],
    bytes: ["B", "KiB", "MiB", "GiB"],
    annotatedEntity: "human-readable plural label",
    unknown: "canonical unit",
  },
  diagnosticLabels: PROFILE_VIEW_DIAGNOSTIC_LABELS,
} as const;

const CORE_PROFILE_SCOPES = new Set([
  "gitlode.execution",
  "gitlode.extraction",
  "gitlode.git",
  "gitlode.dag",
  "gitlode.plugin_runtime",
  "gitlode.line_diff",
]);

export function findProfileViewEntry(
  kind: ProfileViewKind,
  name: string,
  scope: string,
): ProfileViewEntry | undefined {
  const entries = kind === "span" ? PROFILE_SPAN_VIEW : PROFILE_METRIC_VIEW;
  return entries.find(
    (entry) =>
      entry.name === name &&
      (entry.scope === scope ||
        (entry.scope === "resolved_plugin_scope" && !CORE_PROFILE_SCOPES.has(scope))),
  );
}

export function isResolvedPluginScope(scope: string): boolean {
  return !CORE_PROFILE_SCOPES.has(scope);
}
