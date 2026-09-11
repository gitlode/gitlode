import { getTelemetryMetricMetadata } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
export interface JsonlFileWriterMetricRecorder {
  recordFileCreated(): void;
  recordBytesWritten(byteCount: number): void;
}
export const NOOP_JSONL_FILE_WRITER_METRIC_RECORDER = Object.freeze<JsonlFileWriterMetricRecorder>({
  recordFileCreated() {},
  recordBytesWritten() {},
});
export function createJsonlFileWriterMetricRecorder(meter: Meter): JsonlFileWriterMetricRecorder {
  const fm = getTelemetryMetricMetadata("output_file_created"),
    bm = getTelemetryMetricMetadata("output_byte_written"),
    files = meter.createCounter(fm.name, { description: fm.description, unit: fm.unit }),
    bytes = meter.createCounter(bm.name, { description: bm.description, unit: bm.unit });
  return {
    recordFileCreated() {
      files.add(1);
    },
    recordBytesWritten(value) {
      if (Number.isFinite(value) && value > 0) bytes.add(value);
    },
  };
}
