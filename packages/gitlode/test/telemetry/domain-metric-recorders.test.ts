import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
import { describe, expect, test } from "vitest";

import { createBuiltInFactProjectorMetricRecorder } from "../../src/extraction/built-in-fact-projector-metric-recorder.js";
import {
  createExtractionPipelineMetricRecorder,
  NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
} from "../../src/extraction/extraction-pipeline-metric-recorder.js";
import { createFileChangeFactExpanderMetricRecorder } from "../../src/extraction/file-change-fact-expander-metric-recorder.js";
import { createJsonlFileWriterMetricRecorder } from "../../src/output/jsonl-file-writer-metric-recorder.js";
import { createPluginProjectionMetricRecorder } from "../../src/plugin-runtime/plugin-projection-metric-recorder.js";

class FakeMeter {
  creations: { kind: string; name: string; options: unknown }[] = [];
  calls: { name: string; value: number; attributes: unknown }[] = [];
  createCounter(name: string, options: unknown) {
    this.creations.push({ kind: "counter", name, options });
    return {
      add: (value: number, attributes?: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
  createHistogram(name: string, options: unknown) {
    this.creations.push({ kind: "histogram", name, options });
    return {
      record: (value: number, attributes?: unknown) => this.calls.push({ name, value, attributes }),
    };
  }
}
const meter = (fake: FakeMeter) => fake as unknown as Meter;
const clock = (...values: number[]) => {
  let reads = 0;
  return { timing: createMonotonicTiming(() => values[reads++]!), reads: () => reads };
};
const targetIds = [
  "extraction_commit_accepted",
  "output_write_record",
  "output_write_duration",
  "file_change_expansion_duration",
  "file_change_expanded",
  "file_change_expansion_size",
  "file_change_diff_skipped",
  "projection_duration",
  "output_file_created",
  "output_byte_written",
  "plugin_projection_operation",
  "plugin_projection_duration",
];
describe("domain metric recorders", () => {
  test("constructs the twelve owner instruments once with production metadata", () => {
    const fake = new FakeMeter();
    createExtractionPipelineMetricRecorder(meter(fake));
    createFileChangeFactExpanderMetricRecorder(meter(fake));
    createBuiltInFactProjectorMetricRecorder(meter(fake));
    createJsonlFileWriterMetricRecorder(meter(fake));
    createPluginProjectionMetricRecorder(meter(fake));
    expect(fake.creations.map((x) => x.name)).toEqual(
      targetIds.map((id) => TELEMETRY_METRICS.find((x) => x.id === id)!.name),
    );
    for (const creation of fake.creations) {
      const metadata = TELEMETRY_METRICS.find((x) => x.name === creation.name)!;
      expect(creation).toMatchObject({
        kind: metadata.instrument,
        options: { description: metadata.description, unit: metadata.unit },
      });
    }
    expect(fake.creations).toHaveLength(12);
  });
  test("records success, error, zero values and partial completed facts without recreating instruments", () => {
    const fake = new FakeMeter(),
      time = clock(10, 10, 20, 30, 40, 50, 60, 70);
    const extraction = createExtractionPipelineMetricRecorder(meter(fake), time.timing),
      token = extraction.startOutputWrite();
    extraction.recordCommitAccepted("file");
    extraction.completeOutputWrite(token, "file", "success");
    extraction.completeOutputWrite(token, "file", "error");
    const expansion = createFileChangeFactExpanderMetricRecorder(meter(fake), time.timing),
      expansionToken = expansion.startExpansion();
    expansion.recordExpanded("added");
    expansion.recordDiffSkipped("binary");
    expansion.completeExpansion(expansionToken, { outcome: "success", size: 0 });
    const projection = createBuiltInFactProjectorMetricRecorder(meter(fake), time.timing),
      projectionToken = projection.startProjection();
    projection.completeProjection(projectionToken, "commit", "error");
    const plugin = createPluginProjectionMetricRecorder(meter(fake), time.timing),
      pluginToken = plugin.startProjection();
    plugin.completeProjection(pluginToken, "file-change", "failure_continued");
    createJsonlFileWriterMetricRecorder(meter(fake)).recordBytesWritten(0);
    expect(fake.calls.filter((x) => x.name === "gitlode.output.write.duration")).toHaveLength(1);
    expect(fake.calls).toContainEqual({
      name: "gitlode.file_change.expansion.size",
      value: 0,
      attributes: undefined,
    });
    expect(fake.calls).toContainEqual({
      name: "gitlode.file_change.expanded",
      value: 1,
      attributes: { "gitlode.git.file_change.type": "added" },
    });
    expect(fake.calls.filter((x) => x.name === "gitlode.plugin.projection.operation")).toHaveLength(
      1,
    );
    expect(fake.creations).toHaveLength(12);
  });
  test("no-op start neither creates an instrument nor reads a clock", () => {
    const fake = new FakeMeter(),
      time = clock(1);
    const token = NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER.startOutputWrite();
    NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER.completeOutputWrite(token, "commit", "success");
    expect(fake.creations).toHaveLength(0);
    expect(time.reads()).toBe(0);
  });
});
