import type { Meter } from "@opentelemetry/api";

import { counter } from "../telemetry/metric-recorder-support.js";
export interface JsonlFileWriterMetricRecorder {
  recordFileCreated(): void;
  recordBytesWritten(byteCount: number): void;
}
export const NOOP_JSONL_FILE_WRITER_METRIC_RECORDER: JsonlFileWriterMetricRecorder = Object.freeze({
  recordFileCreated() {},
  recordBytesWritten() {},
});
export function createJsonlFileWriterMetricRecorder(meter: Meter): JsonlFileWriterMetricRecorder {
  const files = counter(meter, "output_file_created"),
    bytes = counter(meter, "output_byte_written");
  return {
    recordFileCreated() {
      files.add(1);
    },
    recordBytesWritten(value) {
      if (value > 0) bytes.add(value);
    },
  };
}
