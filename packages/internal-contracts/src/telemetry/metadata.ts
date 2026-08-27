import type { CORE_INSTRUMENTATION_SCOPES } from "./conventions.js";

export type CoreInstrumentationScope = (typeof CORE_INSTRUMENTATION_SCOPES)[number];
export type InstrumentationScopePolicy =
  | { readonly type: "core"; readonly name: CoreInstrumentationScope }
  | { readonly type: "resolved_plugin" };
export type AttributeValueType = "string" | "integer" | "boolean";
export type ProfileReducer = "single" | "distinct" | "min_max";
export interface ObservationAttributeMetadata {
  readonly id: string;
  readonly key: string;
  readonly valueType: AttributeValueType;
  readonly boundedValues?: readonly string[];
  readonly numericConstraint?: { readonly minimum: number; readonly unit?: string };
  readonly valuePolicy?: string;
  readonly profileReducer: ProfileReducer;
}
export interface SpanObservationMetadata {
  readonly id: string;
  readonly name: string;
  readonly scope: InstrumentationScopePolicy;
  readonly owner: string;
  readonly parent: {
    readonly type:
      | "root"
      | "span"
      | "explicit_span_context"
      | "active_caller"
      | "active_caller_at_first_consumption";
    readonly ref?: string;
    readonly expected_in_git_extraction?: string;
  };
  readonly attributes: Readonly<
    Partial<Record<"initial" | "resolved" | "terminal" | "error", readonly string[]>>
  >;
}
export interface MetricObservationMetadata {
  readonly id: string;
  readonly name: string;
  readonly scope: InstrumentationScopePolicy;
  readonly instrument: "counter" | "histogram";
  readonly description: string;
  readonly unit: string;
  readonly owner: string;
  readonly attributes: readonly { readonly id: string; readonly required?: boolean }[];
  readonly explicitBucketBoundaries?: readonly number[];
  readonly zeroPolicy: string;
}
export interface RemovedObservationMetadata {
  readonly id: string;
  readonly disposition: "removed_without_initial_otel_replacement";
}

export const TELEMETRY_ATTRIBUTES = [
  {
    id: "extraction_granularity",
    key: "gitlode.extraction.granularity",
    valueType: "string",
    boundedValues: ["commit", "file"],
    profileReducer: "single",
  },
  {
    id: "extraction_range_kind",
    key: "gitlode.extraction.range.kind",
    valueType: "string",
    boundedValues: ["none", "ref", "date"],
    profileReducer: "single",
  },
  {
    id: "git_adapter",
    key: "gitlode.git.adapter",
    valueType: "string",
    boundedValues: ["isomorphic-git", "git-cli"],
    profileReducer: "single",
  },
  {
    id: "git_object_format",
    key: "gitlode.git.object_format",
    valueType: "string",
    boundedValues: ["sha1", "sha256"],
    profileReducer: "single",
  },
  {
    id: "git_cli_version",
    key: "gitlode.git.cli.version",
    valueType: "string",
    valuePolicy: "sanitized_version",
    profileReducer: "single",
  },
  {
    id: "git_ref_type",
    key: "gitlode.git.ref.type",
    valueType: "string",
    boundedValues: ["branch", "tag-annotated", "tag-lightweight", "commit-oid"],
    profileReducer: "distinct",
  },
  {
    id: "git_remote_url_result",
    key: "gitlode.git.remote_url.result",
    valueType: "string",
    boundedValues: ["found", "missing"],
    profileReducer: "distinct",
  },
  {
    id: "git_merge_base_input_count",
    key: "gitlode.git.merge_base.input.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{commit}",
    },
    profileReducer: "min_max",
  },
  {
    id: "git_merge_base_result",
    key: "gitlode.git.merge_base.result",
    valueType: "string",
    boundedValues: ["found", "missing"],
    profileReducer: "distinct",
  },
  {
    id: "git_commit_walk_strategy",
    key: "gitlode.git.commit.walk.strategy",
    valueType: "string",
    boundedValues: [
      "git-cli-rev-list-stream",
      "certified-lazy",
      "phase-certified-fifo",
      "phase-certified-timestamp",
    ],
    profileReducer: "distinct",
  },
  {
    id: "git_commit_walk_has_exclusion",
    key: "gitlode.git.commit.walk.has_exclusion",
    valueType: "boolean",
    profileReducer: "distinct",
  },
  {
    id: "git_cli_process_completion",
    key: "gitlode.git.cli.process.completion",
    valueType: "string",
    boundedValues: ["exited", "cancelled", "error"],
    profileReducer: "distinct",
  },
  {
    id: "git_diff_mode",
    key: "gitlode.git.diff.mode",
    valueType: "string",
    boundedValues: ["root", "parent"],
    profileReducer: "distinct",
  },
  {
    id: "git_object_read_count",
    key: "gitlode.git.object.read.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{object}",
    },
    profileReducer: "min_max",
  },
  {
    id: "git_blob_read_size",
    key: "gitlode.git.blob.read.size",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "By",
    },
    profileReducer: "min_max",
  },
  {
    id: "git_object_type",
    key: "gitlode.git.object.type",
    valueType: "string",
    boundedValues: ["commit", "blob"],
    profileReducer: "distinct",
  },
  {
    id: "git_object_purpose",
    key: "gitlode.git.object.purpose",
    valueType: "string",
    boundedValues: ["topology", "materialize", "file-change"],
    profileReducer: "distinct",
  },
  {
    id: "git_file_change_type",
    key: "gitlode.git.file_change.type",
    valueType: "string",
    boundedValues: ["added", "modified", "deleted"],
    profileReducer: "distinct",
  },
  {
    id: "file_change_expansion_outcome",
    key: "gitlode.file_change.expansion.outcome",
    valueType: "string",
    boundedValues: ["success", "error"],
    profileReducer: "distinct",
  },
  {
    id: "file_change_diff_skip_reason",
    key: "gitlode.file_change.diff.skip_reason",
    valueType: "string",
    boundedValues: ["size", "binary"],
    profileReducer: "distinct",
  },
  {
    id: "line_diff_compute_outcome",
    key: "gitlode.line_diff.compute.outcome",
    valueType: "string",
    boundedValues: ["success", "error"],
    profileReducer: "distinct",
  },
  {
    id: "git_blob_read_outcome",
    key: "gitlode.git.blob.read.outcome",
    valueType: "string",
    boundedValues: ["success", "error"],
    profileReducer: "distinct",
  },
  {
    id: "dag_strategy",
    key: "gitlode.dag.strategy",
    valueType: "string",
    boundedValues: ["eager-exclude", "certified-lazy", "phase-certified"],
    profileReducer: "distinct",
  },
  {
    id: "dag_operation",
    key: "gitlode.dag.operation",
    valueType: "string",
    boundedValues: ["difference", "reachable", "certified-closure"],
    profileReducer: "distinct",
  },
  {
    id: "dag_operation_completion",
    key: "gitlode.dag.operation.completion",
    valueType: "string",
    boundedValues: ["success", "cancelled", "handled-throw", "error"],
    profileReducer: "distinct",
  },
  {
    id: "dag_role",
    key: "gitlode.dag.role",
    valueType: "string",
    boundedValues: ["main", "exclude"],
    profileReducer: "distinct",
  },
  {
    id: "dag_has_exclusion",
    key: "gitlode.dag.has_exclusion",
    valueType: "boolean",
    profileReducer: "distinct",
  },
  {
    id: "dag_certification_result",
    key: "gitlode.dag.certification.result",
    valueType: "string",
    boundedValues: ["certified", "fallback"],
    profileReducer: "distinct",
  },
  {
    id: "dag_fallback_reason",
    key: "gitlode.dag.fallback.reason",
    valueType: "string",
    boundedValues: [
      "open-include-path",
      "exclude-path-split",
      "no-stop-points",
      "uncertified-stop-point",
    ],
    profileReducer: "distinct",
  },
  {
    id: "dag_termination_reason",
    key: "gitlode.dag.termination.reason",
    valueType: "string",
    boundedValues: ["frontier-exhausted", "include-resolved"],
    profileReducer: "distinct",
  },
  {
    id: "dag_start_count",
    key: "gitlode.dag.start.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{node}",
    },
    profileReducer: "min_max",
  },
  {
    id: "dag_certified_closure_result",
    key: "gitlode.dag.certified_closure.result",
    valueType: "string",
    boundedValues: ["closed-boundary", "exhausted"],
    profileReducer: "distinct",
  },
  {
    id: "run_result",
    key: "gitlode.run.result",
    valueType: "string",
    boundedValues: ["success", "user_error", "runtime_error"],
    profileReducer: "single",
  },
  {
    id: "unique_commit_count",
    key: "gitlode.commit.unique.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{commit}",
    },
    profileReducer: "min_max",
  },
  {
    id: "output_record_count",
    key: "gitlode.output.record.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{record}",
    },
    profileReducer: "min_max",
  },
  {
    id: "output_file_count",
    key: "gitlode.output.file.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{file}",
    },
    profileReducer: "min_max",
  },
  {
    id: "output_size",
    key: "gitlode.output.size",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "By",
    },
    profileReducer: "min_max",
  },
  {
    id: "output_write_outcome",
    key: "gitlode.output.write.outcome",
    valueType: "string",
    boundedValues: ["success", "error"],
    profileReducer: "distinct",
  },
  {
    id: "requested_ref_count",
    key: "gitlode.ref.requested.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{ref}",
    },
    profileReducer: "min_max",
  },
  {
    id: "skipped_diff_count",
    key: "gitlode.diff.skipped.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{change}",
    },
    profileReducer: "min_max",
  },
  {
    id: "extraction_mode",
    key: "gitlode.extraction.mode",
    valueType: "string",
    boundedValues: ["snapshot", "incremental"],
    profileReducer: "single",
  },
  {
    id: "prior_ref_count",
    key: "gitlode.ref.prior.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{ref}",
    },
    profileReducer: "min_max",
  },
  {
    id: "traversal_plan_count",
    key: "gitlode.traversal.plan.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{plan}",
    },
    profileReducer: "min_max",
  },
  {
    id: "skipped_ref_count",
    key: "gitlode.ref.skipped.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{ref}",
    },
    profileReducer: "min_max",
  },
  {
    id: "stream_completion",
    key: "gitlode.stream.completion",
    valueType: "string",
    boundedValues: ["exhausted", "cancelled", "handled_throw", "error"],
    profileReducer: "distinct",
  },
  {
    id: "projection_mode",
    key: "gitlode.projection.mode",
    valueType: "string",
    boundedValues: ["built_in", "plugin_enriched"],
    profileReducer: "single",
  },
  {
    id: "projection_fact_type",
    key: "gitlode.projection.fact.type",
    valueType: "string",
    boundedValues: ["commit", "file-change"],
    profileReducer: "distinct",
  },
  {
    id: "projection_outcome",
    key: "gitlode.projection.outcome",
    valueType: "string",
    boundedValues: ["success", "error"],
    profileReducer: "distinct",
  },
  {
    id: "repository_name_source",
    key: "gitlode.repository.name.source",
    valueType: "string",
    boundedValues: ["explicit", "remote_url", "path"],
    profileReducer: "single",
  },
  {
    id: "repository_url_source",
    key: "gitlode.repository.url.source",
    valueType: "string",
    boundedValues: ["explicit", "remote", "missing"],
    profileReducer: "single",
  },
  {
    id: "plugin_configured_count",
    key: "gitlode.plugin.configured.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{plugin}",
    },
    profileReducer: "min_max",
  },
  {
    id: "plugin_resolved_count",
    key: "gitlode.plugin.resolved.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{plugin}",
    },
    profileReducer: "min_max",
  },
  {
    id: "plugin_ready_count",
    key: "gitlode.plugin.ready.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{plugin}",
    },
    profileReducer: "min_max",
  },
  {
    id: "plugin_failed_count",
    key: "gitlode.plugin.failed.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{plugin}",
    },
    profileReducer: "min_max",
  },
  {
    id: "plugin_compatibility_warning_count",
    key: "gitlode.plugin.compatibility.warning.count",
    valueType: "integer",
    numericConstraint: {
      minimum: 0,
      unit: "{warning}",
    },
    profileReducer: "min_max",
  },
  {
    id: "plugin_init_result",
    key: "gitlode.plugin.init.result",
    valueType: "string",
    boundedValues: ["ready", "fatal"],
    profileReducer: "distinct",
  },
  {
    id: "plugin_init_failure_source",
    key: "gitlode.plugin.init.failure.source",
    valueType: "string",
    boundedValues: ["returned", "thrown"],
    profileReducer: "distinct",
  },
  {
    id: "plugin_projection_outcome",
    key: "gitlode.plugin.projection.outcome",
    valueType: "string",
    boundedValues: ["success", "skip", "failure_continued", "failure_aborted"],
    profileReducer: "distinct",
  },
] as const satisfies readonly ObservationAttributeMetadata[];
export const TELEMETRY_SPANS = [
  {
    id: "run",
    name: "gitlode.run",
    scope: {
      type: "core",
      name: "gitlode.execution",
    },
    owner: "WorkerTelemetrySession",
    parent: {
      type: "root",
    },
    attributes: {
      initial: ["extraction_granularity", "extraction_range_kind", "git_adapter"],
      resolved: ["git_object_format", "git_cli_version"],
      terminal: [
        "run_result",
        "unique_commit_count",
        "output_record_count",
        "output_file_count",
        "output_size",
      ],
    },
  },
  {
    id: "extract",
    name: "gitlode.extract",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    owner: "ExtractionPipeline.run",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      initial: ["extraction_granularity", "extraction_range_kind", "requested_ref_count"],
      terminal: ["unique_commit_count", "output_record_count", "skipped_diff_count"],
    },
  },
  {
    id: "planning",
    name: "gitlode.planning",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    owner: "RepositoryTraversalPlanner.plan",
    parent: {
      type: "span",
      ref: "extract",
    },
    attributes: {
      initial: [
        "extraction_mode",
        "extraction_range_kind",
        "requested_ref_count",
        "prior_ref_count",
      ],
      terminal: ["traversal_plan_count", "skipped_ref_count"],
    },
  },
  {
    id: "traversal",
    name: "gitlode.traversal",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    owner: "CommitFactExtractor.extract",
    parent: {
      type: "explicit_span_context",
      ref: "extract",
    },
    attributes: {
      initial: ["traversal_plan_count", "extraction_range_kind"],
      terminal: ["stream_completion"],
    },
  },
  {
    id: "projection",
    name: "gitlode.projection",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    owner: "outer active FactProjector",
    parent: {
      type: "explicit_span_context",
      ref: "extract",
    },
    attributes: {
      initial: ["projection_mode"],
      terminal: ["stream_completion"],
    },
  },
  {
    id: "output_close",
    name: "gitlode.output.close",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    owner: "ExtractionPipeline",
    parent: {
      type: "span",
      ref: "extract",
    },
    attributes: {},
  },
  {
    id: "repository_access_validate",
    name: "gitlode.repository.access.validate",
    scope: {
      type: "core",
      name: "gitlode.execution",
    },
    owner: "worker execution preflight",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {},
  },
  {
    id: "repository_object_format_resolve",
    name: "gitlode.repository.object_format.resolve",
    scope: {
      type: "core",
      name: "gitlode.execution",
    },
    owner: "worker repository setup",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      terminal: ["git_object_format"],
    },
  },
  {
    id: "state_validate",
    name: "gitlode.state.validate",
    scope: {
      type: "core",
      name: "gitlode.execution",
    },
    owner: "worker state setup",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      initial: ["prior_ref_count"],
    },
  },
  {
    id: "repository_metadata_resolve",
    name: "gitlode.repository.metadata.resolve",
    scope: {
      type: "core",
      name: "gitlode.execution",
    },
    owner: "worker repository setup",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      terminal: ["repository_name_source", "repository_url_source"],
    },
  },
  {
    id: "extraction_range_resolve",
    name: "gitlode.extraction.range.resolve",
    scope: {
      type: "core",
      name: "gitlode.execution",
    },
    owner: "worker extraction setup",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      initial: ["extraction_range_kind"],
    },
  },
  {
    id: "plugin_bootstrap",
    name: "gitlode.plugin.bootstrap",
    scope: {
      type: "core",
      name: "gitlode.plugin_runtime",
    },
    owner: "host buildPluginProjector",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      initial: ["plugin_configured_count"],
      terminal: ["plugin_resolved_count", "plugin_ready_count", "plugin_failed_count"],
    },
  },
  {
    id: "plugin_resolve",
    name: "gitlode.plugin.resolve",
    scope: {
      type: "core",
      name: "gitlode.plugin_runtime",
    },
    owner: "plugin host resolver",
    parent: {
      type: "span",
      ref: "plugin_bootstrap",
    },
    attributes: {
      initial: ["plugin_configured_count"],
      terminal: ["plugin_resolved_count"],
    },
  },
  {
    id: "plugin_compatibility_check",
    name: "gitlode.plugin.compatibility.check",
    scope: {
      type: "core",
      name: "gitlode.plugin_runtime",
    },
    owner: "plugin compatibility checker",
    parent: {
      type: "span",
      ref: "plugin_bootstrap",
    },
    attributes: {
      initial: ["plugin_resolved_count"],
      terminal: ["plugin_compatibility_warning_count"],
    },
  },
  {
    id: "git_resolve_ref",
    name: "gitlode.git.resolve_ref",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitAdapter.resolveRef",
    parent: {
      type: "active_caller",
    },
    attributes: {
      initial: ["git_adapter"],
    },
  },
  {
    id: "git_classify_ref",
    name: "gitlode.git.classify_ref",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitAdapter.classifyRefType",
    parent: {
      type: "active_caller",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_ref_type"],
    },
  },
  {
    id: "git_repository_object_format",
    name: "gitlode.git.repository_object_format",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitAdapter.getRepositoryObjectFormat",
    parent: {
      type: "active_caller",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_object_format"],
    },
  },
  {
    id: "git_remote_url_resolve",
    name: "gitlode.git.remote_url.resolve",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitAdapter.getRemoteUrl",
    parent: {
      type: "active_caller",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_remote_url_result"],
    },
  },
  {
    id: "git_merge_base",
    name: "gitlode.git.merge_base",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitAdapter.findMergeBase",
    parent: {
      type: "active_caller",
    },
    attributes: {
      initial: ["git_adapter", "git_merge_base_input_count"],
      terminal: ["git_merge_base_result"],
    },
  },
  {
    id: "git_commit_walk",
    name: "gitlode.git.commit.walk",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitAdapter.walkCommits",
    parent: {
      type: "explicit_span_context",
      ref: "traversal",
    },
    attributes: {
      initial: ["git_adapter", "git_commit_walk_strategy", "git_commit_walk_has_exclusion"],
      terminal: ["stream_completion"],
    },
  },
  {
    id: "git_cli_version_check",
    name: "gitlode.git.cli.version.check",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "Git CLI adapter validation",
    parent: {
      type: "span",
      ref: "run",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_cli_version"],
    },
  },
  {
    id: "git_cli_rev_list",
    name: "gitlode.git.cli.rev_list",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitCliAdapter.walkCommits rev-list process",
    parent: {
      type: "span",
      ref: "git_commit_walk",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_cli_process_completion"],
    },
  },
  {
    id: "git_cli_commit_batch",
    name: "gitlode.git.cli.commit_batch",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitCliAdapter.walkCommits commit batch process",
    parent: {
      type: "span",
      ref: "git_commit_walk",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_cli_process_completion"],
    },
  },
  {
    id: "git_cli_diff_tree",
    name: "gitlode.git.cli.diff_tree",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "GitCliAdapter file-change discovery",
    parent: {
      type: "explicit_span_context",
      ref: "extract",
    },
    attributes: {
      initial: ["git_adapter", "git_diff_mode"],
      terminal: ["git_cli_process_completion"],
    },
  },
  {
    id: "git_cli_file_blob_batch",
    name: "gitlode.git.cli.file_blob_batch",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    owner: "repository-scoped Git CLI file blob batch session",
    parent: {
      type: "explicit_span_context",
      ref: "run",
    },
    attributes: {
      initial: ["git_adapter"],
      terminal: ["git_cli_process_completion", "git_object_read_count", "git_blob_read_size"],
    },
  },
  {
    id: "dag_traversal",
    name: "gitlode.dag.traversal",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    owner:
      "generic DAG difference facade through the injected Git implementation telemetry binding",
    parent: {
      type: "active_caller_at_first_consumption",
      expected_in_git_extraction: "git_commit_walk",
    },
    attributes: {
      initial: ["dag_strategy", "dag_has_exclusion"],
      terminal: [
        "stream_completion",
        "dag_certification_result",
        "dag_fallback_reason",
        "dag_termination_reason",
      ],
    },
  },
  {
    id: "dag_reachable",
    name: "gitlode.dag.reachable",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    owner:
      "standalone reachable-set facade through the injected Git implementation telemetry binding",
    parent: {
      type: "active_caller_at_first_consumption",
    },
    attributes: {
      initial: ["dag_start_count"],
      terminal: ["stream_completion"],
    },
  },
  {
    id: "dag_certified_closure",
    name: "gitlode.dag.certified_closure",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    owner:
      "standalone certified-closure facade through the injected Git implementation telemetry binding",
    parent: {
      type: "active_caller",
    },
    attributes: {
      terminal: ["dag_certified_closure_result"],
    },
  },
  {
    id: "plugin_init",
    name: "gitlode.plugin.init",
    scope: {
      type: "resolved_plugin",
    },
    owner: "plugin host initializer around ProjectorPlugin.init",
    parent: {
      type: "explicit_span_context",
      ref: "plugin_bootstrap",
    },
    attributes: {
      terminal: ["plugin_init_result", "plugin_init_failure_source"],
    },
  },
] as const satisfies readonly SpanObservationMetadata[];
export const TELEMETRY_METRICS = [
  {
    id: "extraction_commit_accepted",
    name: "gitlode.extraction.commit.accepted",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "counter",
    description: "Number of commit facts accepted after pipeline-level cross-ref deduplication.",
    unit: "{commit}",
    owner: "ExtractionPipeline",
    attributes: [
      {
        id: "extraction_granularity",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_commit_is_accepted",
  },
  {
    id: "output_write_record",
    name: "gitlode.output.write.record",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "counter",
    description: "Number of output records whose OutputSink write completed successfully.",
    unit: "{record}",
    owner: "ExtractionPipeline",
    attributes: [
      {
        id: "extraction_granularity",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_write_succeeds",
  },
  {
    id: "git_commit_yielded",
    name: "gitlode.git.commit.yielded",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "counter",
    description: "Number of valid RawCommit values yielded by a Git adapter commit walk.",
    unit: "{commit}",
    owner: "GitAdapter walk implementation",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
      {
        id: "git_commit_walk_strategy",
        required: true,
      },
      {
        id: "git_commit_walk_has_exclusion",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_commit_is_yielded",
  },
  {
    id: "git_object_read",
    name: "gitlode.git.object.read",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "counter",
    description:
      "Number of complete Git object responses successfully obtained and validated from a backend.",
    unit: "{object}",
    owner: "Git adapter object-read primitive",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
      {
        id: "git_object_type",
        required: true,
      },
      {
        id: "git_object_purpose",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_backend_object_read_succeeds",
  },
  {
    id: "git_object_cache_lookup",
    name: "gitlode.git.object.cache.lookup",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "counter",
    description:
      "Number of Git object cache lookups performed before deciding whether a backend read is needed.",
    unit: "{object}",
    owner: "Git adapter object cache",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
      {
        id: "git_object_type",
        required: true,
      },
      {
        id: "git_object_purpose",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_cache_lookup_occurs",
  },
  {
    id: "git_object_cache_hit",
    name: "gitlode.git.object.cache.hit",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "counter",
    description: "Number of Git object cache lookups satisfied by an existing cached object.",
    unit: "{object}",
    owner: "Git adapter object cache",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
      {
        id: "git_object_type",
        required: true,
      },
      {
        id: "git_object_purpose",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_cache_hit_occurs",
  },
  {
    id: "git_file_change_yielded",
    name: "gitlode.git.file_change.yielded",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "counter",
    description: "Number of fully materialized file-backed blob changes yielded by a Git adapter.",
    unit: "{change}",
    owner: "GitAdapter.getFileBlobChanges implementation",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
      {
        id: "git_file_change_type",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_file_change_is_yielded",
  },
  {
    id: "git_blob_read_duration",
    name: "gitlode.git.blob.read.duration",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "histogram",
    description:
      "End-to-end duration of one semantic blob read, including Git CLI batch queue wait.",
    unit: "s",
    owner: "Git adapter blob-read primitive",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
      {
        id: "git_blob_read_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
      5,
    ],
    zeroPolicy: "record_zero_duration_if_reported_by_monotonic_clock",
  },
  {
    id: "git_blob_read_size",
    name: "gitlode.git.blob.read.size",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "histogram",
    description: "Distribution of content sizes returned by successful semantic blob reads.",
    unit: "By",
    owner: "Git adapter blob-read primitive",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216,
    ],
    zeroPolicy: "record_empty_blob_as_size_zero",
  },
  {
    id: "git_blob_read_byte",
    name: "gitlode.git.blob.read.byte",
    scope: {
      type: "core",
      name: "gitlode.git",
    },
    instrument: "counter",
    description: "Total bytes returned by successful semantic blob reads.",
    unit: "By",
    owner: "Git adapter blob-read primitive",
    attributes: [
      {
        id: "git_adapter",
        required: true,
      },
    ],
    zeroPolicy: "omit_add_for_empty_blob",
  },
  {
    id: "dag_operation_completion",
    name: "gitlode.dag.operation.completion",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description:
      "Number of public DAG facade operations reaching each normalized terminal completion.",
    unit: "{operation}",
    owner:
      "Git implementation telemetry binding receiving terminal evidence from the generic DAG facade",
    attributes: [
      {
        id: "dag_operation",
        required: true,
      },
      {
        id: "dag_operation_completion",
        required: true,
      },
      {
        id: "dag_strategy",
      },
      {
        id: "dag_has_exclusion",
      },
    ],
    zeroPolicy: "record_exactly_one_completion_for_each_started_operation",
  },
  {
    id: "dag_step_processed",
    name: "gitlode.dag.step.processed",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description:
      "Number of work items actually processed by a public DAG operation and its reusable cores.",
    unit: "{step}",
    owner:
      "Git implementation telemetry binding receiving an operation-local neutral DAG measurement",
    attributes: [
      {
        id: "dag_operation",
        required: true,
      },
      {
        id: "dag_strategy",
      },
      {
        id: "dag_has_exclusion",
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_step_is_processed",
  },
  {
    id: "dag_step_stale",
    name: "gitlode.dag.step.stale",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description: "Number of processed DAG work items discarded as stale or duplicate.",
    unit: "{step}",
    owner:
      "Git implementation telemetry binding receiving an operation-local neutral DAG measurement",
    attributes: [
      {
        id: "dag_operation",
        required: true,
      },
      {
        id: "dag_strategy",
      },
      {
        id: "dag_has_exclusion",
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_stale_step_is_processed",
  },
  {
    id: "dag_successor_expansion",
    name: "gitlode.dag.successor.expansion",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description: "Number of calls made to DagTopologyPort.getSuccessors by role.",
    unit: "{expansion}",
    owner:
      "Git implementation telemetry binding receiving an operation-local neutral DAG measurement",
    attributes: [
      {
        id: "dag_operation",
        required: true,
      },
      {
        id: "dag_role",
        required: true,
      },
      {
        id: "dag_strategy",
      },
      {
        id: "dag_has_exclusion",
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_successor_expansion_occurs",
  },
  {
    id: "dag_node_yielded",
    name: "gitlode.dag.node.yielded",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description: "Number of result node IDs yielded by a public difference or reachable facade.",
    unit: "{node}",
    owner:
      "Git implementation telemetry binding receiving an operation-local neutral DAG measurement",
    attributes: [
      {
        id: "dag_operation",
        required: true,
      },
      {
        id: "dag_strategy",
      },
      {
        id: "dag_has_exclusion",
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_result_node_is_yielded",
  },
  {
    id: "dag_node_excluded",
    name: "gitlode.dag.node.excluded",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description:
      "Number of unique nodes discovered while materializing a complete excluded reachable set.",
    unit: "{node}",
    owner:
      "Git implementation telemetry binding receiving a difference-operation neutral DAG measurement",
    attributes: [
      {
        id: "dag_operation",
        required: true,
      },
      {
        id: "dag_strategy",
        required: true,
      },
      {
        id: "dag_has_exclusion",
        required: true,
      },
    ],
    zeroPolicy: "omit_when_no_full_exclude_collection_work_occurs",
  },
  {
    id: "dag_fallback",
    name: "gitlode.dag.fallback",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description:
      "Number of certified-lazy traversals that selected conservative fallback by reason.",
    unit: "{fallback}",
    owner:
      "Git implementation telemetry binding receiving a difference-operation neutral DAG measurement",
    attributes: [
      {
        id: "dag_strategy",
        required: true,
      },
      {
        id: "dag_fallback_reason",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_fallback_is_not_selected",
  },
  {
    id: "dag_fallback_node_removed",
    name: "gitlode.dag.fallback.node.removed",
    scope: {
      type: "core",
      name: "gitlode.dag",
    },
    instrument: "counter",
    description:
      "Number of buffered result candidates removed after conservative fallback collection.",
    unit: "{node}",
    owner:
      "Git implementation telemetry binding receiving a difference-operation neutral DAG measurement",
    attributes: [
      {
        id: "dag_strategy",
        required: true,
      },
      {
        id: "dag_fallback_reason",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_fallback_removes_no_candidate",
  },
  {
    id: "file_change_expansion_duration",
    name: "gitlode.file_change.expansion.duration",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "histogram",
    description: "End-to-end duration of expanding one commit's file changes into facts.",
    unit: "s",
    owner: "FileChangeFactExpander",
    attributes: [
      {
        id: "file_change_expansion_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
      5,
    ],
    zeroPolicy: "record_zero_duration_if_reported_by_monotonic_clock",
  },
  {
    id: "file_change_expanded",
    name: "gitlode.file_change.expanded",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "counter",
    description: "Number of file-change facts successfully built by the expander.",
    unit: "{change}",
    owner: "FileChangeFactExpander",
    attributes: [
      {
        id: "git_file_change_type",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_file_change_fact_is_built",
  },
  {
    id: "file_change_expansion_size",
    name: "gitlode.file_change.expansion.size",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "histogram",
    description: "Distribution of successfully completed file-change batch sizes per commit.",
    unit: "{change}",
    owner: "FileChangeFactExpander",
    attributes: [],
    explicitBucketBoundaries: [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 4096],
    zeroPolicy: "record_zero_for_a_successful_commit_with_no_file_changes",
  },
  {
    id: "file_change_diff_skipped",
    name: "gitlode.file_change.diff.skipped",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "counter",
    description: "Number of file changes whose line diff was intentionally skipped.",
    unit: "{change}",
    owner: "FileChangeFactExpander",
    attributes: [
      {
        id: "file_change_diff_skip_reason",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_diff_is_skipped",
  },
  {
    id: "line_diff_compute_operation",
    name: "gitlode.line_diff.compute.operation",
    scope: {
      type: "core",
      name: "gitlode.line_diff",
    },
    instrument: "counter",
    description: "Number of concrete line-diff computation attempts by terminal outcome.",
    unit: "{operation}",
    owner: "concrete LineDiffCalculator implementation",
    attributes: [
      {
        id: "line_diff_compute_outcome",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_concrete_computation_is_attempted",
  },
  {
    id: "line_diff_compute_duration",
    name: "gitlode.line_diff.compute.duration",
    scope: {
      type: "core",
      name: "gitlode.line_diff",
    },
    instrument: "histogram",
    description: "Duration of one concrete line-diff computation attempt.",
    unit: "s",
    owner: "concrete LineDiffCalculator implementation",
    attributes: [
      {
        id: "line_diff_compute_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
      5,
    ],
    zeroPolicy: "record_zero_duration_if_reported_by_monotonic_clock",
  },
  {
    id: "line_diff_compute_input_size",
    name: "gitlode.line_diff.compute.input.size",
    scope: {
      type: "core",
      name: "gitlode.line_diff",
    },
    instrument: "histogram",
    description:
      "Distribution of total byte sizes supplied to concrete line-diff computation attempts.",
    unit: "By",
    owner: "concrete LineDiffCalculator implementation",
    attributes: [
      {
        id: "line_diff_compute_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216,
    ],
    zeroPolicy: "record_zero_when_both_inputs_are_empty",
  },
  {
    id: "output_write_duration",
    name: "gitlode.output.write.duration",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "histogram",
    description: "End-to-end duration of one OutputSink write call.",
    unit: "s",
    owner: "ExtractionPipeline",
    attributes: [
      {
        id: "extraction_granularity",
        required: true,
      },
      {
        id: "output_write_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
      5,
    ],
    zeroPolicy: "record_zero_duration_if_reported_by_monotonic_clock",
  },
  {
    id: "output_file_created",
    name: "gitlode.output.file.created",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "counter",
    description: "Number of output file segments successfully opened by the concrete writer.",
    unit: "{file}",
    owner: "JsonlFileWriter",
    attributes: [],
    zeroPolicy: "omit_datapoint_when_no_output_segment_is_opened",
  },
  {
    id: "output_byte_written",
    name: "gitlode.output.byte.written",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "counter",
    description: "Number of UTF-8 JSONL bytes whose underlying file write completed successfully.",
    unit: "By",
    owner: "JsonlFileWriter",
    attributes: [],
    zeroPolicy: "omit_datapoint_when_no_bytes_are_written",
  },
  {
    id: "projection_duration",
    name: "gitlode.projection.duration",
    scope: {
      type: "core",
      name: "gitlode.extraction",
    },
    instrument: "histogram",
    description: "Duration of one built-in fact-to-record mapping operation.",
    unit: "s",
    owner: "BuiltInFactProjector",
    attributes: [
      {
        id: "projection_fact_type",
        required: true,
      },
      {
        id: "projection_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 0.000005, 0.00001, 0.000025, 0.00005, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01,
      0.025, 0.05, 0.1,
    ],
    zeroPolicy: "record_zero_duration_if_reported_by_monotonic_clock",
  },
  {
    id: "plugin_projection_operation",
    name: "gitlode.plugin.projection.operation",
    scope: {
      type: "resolved_plugin",
    },
    instrument: "counter",
    description: "Number of plugin projection callback attempts by host-normalized outcome.",
    unit: "{operation}",
    owner: "EnrichingFactProjector around ProjectorPlugin.project",
    attributes: [
      {
        id: "projection_fact_type",
        required: true,
      },
      {
        id: "plugin_projection_outcome",
        required: true,
      },
    ],
    zeroPolicy: "omit_datapoint_when_no_plugin_projection_is_attempted",
  },
  {
    id: "plugin_projection_duration",
    name: "gitlode.plugin.projection.duration",
    scope: {
      type: "resolved_plugin",
    },
    instrument: "histogram",
    description: "Duration of one host-invoked plugin projection callback attempt.",
    unit: "s",
    owner: "EnrichingFactProjector around ProjectorPlugin.project",
    attributes: [
      {
        id: "projection_fact_type",
        required: true,
      },
      {
        id: "plugin_projection_outcome",
        required: true,
      },
    ],
    explicitBucketBoundaries: [
      0, 0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
      5, 10, 30, 60,
    ],
    zeroPolicy: "record_zero_duration_if_reported_by_monotonic_clock",
  },
] as const satisfies readonly MetricObservationMetadata[];
export const REMOVED_TELEMETRY_OBSERVATIONS = [
  {
    id: "closure_phases",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "closed_boundary_phases",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "exhausted_phases",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "certified_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "terminal_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "certified_hits",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "classification_runs",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "classification_newer_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "classification_older_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "classification_excluded_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "certification_yielded_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
  {
    id: "drain_yielded_nodes",
    disposition: "removed_without_initial_otel_replacement",
  },
] as const satisfies readonly RemovedObservationMetadata[];
