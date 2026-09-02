/** Typed presentation projection of the accepted profile-view catalog. YAML is validation input only. */
interface ProfileViewEntry {
  readonly ref: string;
  readonly label: string;
  readonly group: string;
  readonly order: number;
}

type ProfileMetricViewEntry = ProfileViewEntry;

const PROFILE_VIEW_ENTRIES: readonly ProfileViewEntry[] = [
  { ref: "run", label: "Run", group: "Overview", order: 0 },
  { ref: "repository_access_validate", label: "Repository access", group: "Setup", order: 10 },
  { ref: "repository_object_format_resolve", label: "Object format", group: "Setup", order: 11 },
  { ref: "state_validate", label: "State validation", group: "Setup", order: 12 },
  { ref: "repository_metadata_resolve", label: "Repository metadata", group: "Setup", order: 13 },
  { ref: "extraction_range_resolve", label: "Extraction range", group: "Setup", order: 14 },
  { ref: "extract", label: "Extraction", group: "Pipeline", order: 20 },
  { ref: "planning", label: "Planning", group: "Pipeline", order: 21 },
  { ref: "traversal", label: "Traversal", group: "Pipeline", order: 22 },
  { ref: "projection", label: "Projection", group: "Pipeline", order: 23 },
  { ref: "output_close", label: "Output close", group: "Pipeline", order: 24 },
  { ref: "plugin_init", label: "Initialization", group: "Plugins", order: 50 },
];

const PROFILE_METRIC_VIEW_ENTRIES: readonly ProfileMetricViewEntry[] = (
  [
    ["extraction_commit_accepted", "Accepted commits", "Pipeline", 100],
    ["git_commit_yielded", "Commits yielded", "Pipeline", 101],
    ["git_object_read", "Objects read", "Pipeline", 110],
    ["git_object_cache_lookup", "Object cache lookups", "Pipeline", 111],
    ["git_object_cache_hit", "Object cache hits", "Pipeline", 112],
    ["git_blob_read_duration", "Blob read duration", "Pipeline", 113],
    ["git_blob_read_size", "Blob read size", "Pipeline", 114],
    ["git_blob_read_byte", "Blob read bytes", "Pipeline", 115],
    ["git_file_change_yielded", "File changes yielded", "Pipeline", 120],
    ["dag_operation_completion", "DAG operations", "Pipeline", 130],
    ["dag_step_processed", "DAG steps processed", "Pipeline", 131],
    ["dag_step_stale", "Stale DAG steps", "Pipeline", 132],
    ["dag_successor_expansion", "Successor expansions", "Pipeline", 133],
    ["dag_node_yielded", "DAG nodes yielded", "Pipeline", 134],
    ["dag_node_excluded", "DAG nodes excluded", "Pipeline", 135],
    ["dag_fallback", "DAG fallbacks", "Pipeline", 136],
    ["dag_fallback_node_removed", "Fallback nodes removed", "Pipeline", 137],
    ["file_change_expansion_duration", "File expansion duration", "Pipeline", 140],
    ["file_change_expanded", "File changes expanded", "Pipeline", 141],
    ["file_change_expansion_size", "File expansion size", "Pipeline", 142],
    ["file_change_diff_skipped", "Diffs skipped", "Pipeline", 143],
    ["line_diff_compute_operation", "Line diff operations", "Pipeline", 150],
    ["line_diff_compute_duration", "Line diff duration", "Pipeline", 151],
    ["line_diff_compute_input_size", "Line diff input size", "Pipeline", 152],
    ["projection_duration", "Projection duration", "Pipeline", 160],
    ["output_write_record", "Records written", "Pipeline", 170],
    ["output_write_duration", "Output write duration", "Pipeline", 171],
    ["output_file_created", "Files created", "Pipeline", 172],
    ["output_byte_written", "Bytes written", "Pipeline", 173],
    ["plugin_projection_operation", "Plugin projections", "Plugins", 200],
    ["plugin_projection_duration", "Plugin projection duration", "Plugins", 201],
  ] as Array<[string, string, string, number]>
).map(([ref, label, group, order]) => ({
  ref,
  label,
  group,
  order,
}));

export const PROFILE_VIEW_DIAGNOSTIC_LABELS: Readonly<Record<string, string>> = {
  span_group_overflow: "Span groups truncated",
  span_attribute_value_overflow: "Span attribute values truncated",
  metric_point_overflow: "Metric datapoints truncated",
  attribute_reducer_conflict: "Span attribute invariant violated",
  invalid_aggregation: "Invalid aggregation discarded",
  lifecycle_failure: "Telemetry lifecycle stage failed",
  diagnostic_overflow: "Additional diagnostics omitted",
};

export function profileViewEntry(ref: string): ProfileViewEntry | undefined {
  return PROFILE_VIEW_ENTRIES.find((entry) => entry.ref === ref);
}

export function profileMetricViewEntry(ref: string): ProfileMetricViewEntry | undefined {
  return PROFILE_METRIC_VIEW_ENTRIES.find((entry) => entry.ref === ref);
}
