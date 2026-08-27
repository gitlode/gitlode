export const CORE_INSTRUMENTATION_SCOPES = [
  "gitlode.execution",
  "gitlode.extraction",
  "gitlode.dag",
  "gitlode.git",
  "gitlode.line_diff",
  "gitlode.plugin_runtime",
] as const;

export const STREAM_COMPLETION_ATTRIBUTE = "gitlode.stream.completion";

export const STREAM_COMPLETION_VALUES = [
  "exhausted",
  "cancelled",
  "handled_throw",
  "error",
] as const;

export type StreamCompletion = (typeof STREAM_COMPLETION_VALUES)[number];
