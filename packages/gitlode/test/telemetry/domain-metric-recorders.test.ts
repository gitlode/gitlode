import { createMonotonicTiming, TELEMETRY_METRICS } from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";
import { describe, expect, test } from "vitest";

import {
  createBuiltInFactProjectorMetricRecorder,
  NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER,
} from "../../src/extraction/built-in-fact-projector-metric-recorder.js";
import {
  createExtractionPipelineMetricRecorder,
  NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
} from "../../src/extraction/extraction-pipeline-metric-recorder.js";
import {
  createFileChangeFactExpanderMetricRecorder,
  NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
} from "../../src/extraction/file-change-fact-expander-metric-recorder.js";
import {
  createJsonlFileWriterMetricRecorder,
  NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
} from "../../src/output/jsonl-file-writer-metric-recorder.js";
import {
  createPluginProjectionMetricRecorder,
  NOOP_PLUGIN_PROJECTION_METRIC_RECORDER,
} from "../../src/plugin-runtime/plugin-projection-metric-recorder.js";

type Call = { name: string; value: number; attributes?: unknown };
class FakeMeter {
  creations: { kind: "counter" | "histogram"; name: string; options: unknown }[] = [];
  calls: Call[] = [];
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
const sequence = (...values: number[]) => {
  let i = 0;
  return createMonotonicTiming(() => values[i++]!);
};
const call = (name: string, value: number, attributes?: unknown): Call => ({
  name,
  value,
  attributes,
});
const names = {
  accepted: "gitlode.extraction.commit.accepted",
  writeRecord: "gitlode.output.write.record",
  writeDuration: "gitlode.output.write.duration",
  expansionDuration: "gitlode.file_change.expansion.duration",
  expanded: "gitlode.file_change.expanded",
  expansionSize: "gitlode.file_change.expansion.size",
  skipped: "gitlode.file_change.diff.skipped",
  projection: "gitlode.projection.duration",
  fileCreated: "gitlode.output.file.created",
  bytes: "gitlode.output.byte.written",
  pluginOperation: "gitlode.plugin.projection.operation",
  pluginDuration: "gitlode.plugin.projection.duration",
} as const;
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
] as const;
function constructAll(fake: FakeMeter) {
  return {
    extraction: createExtractionPipelineMetricRecorder(meter(fake), sequence(0, 1)),
    expansion: createFileChangeFactExpanderMetricRecorder(meter(fake), sequence(0, 1)),
    projection: createBuiltInFactProjectorMetricRecorder(meter(fake), sequence(0, 1)),
    writer: createJsonlFileWriterMetricRecorder(meter(fake)),
    plugin: createPluginProjectionMetricRecorder(meter(fake), sequence(0, 1)),
  };
}

describe("instrument metadata", () => {
  test("creates exactly the cataloged owner instrument set", () => {
    const fake = new FakeMeter();
    constructAll(fake);
    const expectedNames = targetIds.map(
      (id) => TELEMETRY_METRICS.find((metadata) => metadata.id === id)!.name,
    );
    expect(fake.creations).toHaveLength(targetIds.length);
    expect(fake.creations.map((creation) => creation.name).sort()).toEqual(
      [...expectedNames].sort(),
    );
  });
  test.each(targetIds)("creates %s exactly from catalog", (id) => {
    const fake = new FakeMeter();
    constructAll(fake);
    const metadata = TELEMETRY_METRICS.find((x) => x.id === id)!;
    const matches = fake.creations.filter((creation) => creation.name === metadata.name);
    expect(matches).toHaveLength(1);
    const creation = matches[0]!;
    expect(creation).toEqual({
      kind: metadata.instrument,
      name: metadata.name,
      options:
        metadata.instrument === "histogram"
          ? {
              description: metadata.description,
              unit: metadata.unit,
              advice: { explicitBucketBoundaries: [...metadata.explicitBucketBoundaries] },
            }
          : { description: metadata.description, unit: metadata.unit },
    });
    if (metadata.instrument === "histogram") {
      const boundaries = (creation.options as { advice: { explicitBucketBoundaries: number[] } })
        .advice.explicitBucketBoundaries;
      expect(boundaries).toEqual(metadata.explicitBucketBoundaries);
      expect(boundaries).not.toBe(metadata.explicitBucketBoundaries);
    }
  });
  test("never creates instruments on owner hot paths", () => {
    const fake = new FakeMeter(),
      r = constructAll(fake),
      count = fake.creations.length;
    r.extraction.recordCommitAccepted("commit");
    r.extraction.completeOutputWrite(r.extraction.startOutputWrite(), "commit", "success");
    r.expansion.recordExpanded("added");
    r.expansion.recordDiffSkipped("binary");
    r.expansion.completeExpansion(r.expansion.startExpansion(), { outcome: "success", size: 1 });
    r.projection.completeProjection(r.projection.startProjection(), "commit", "success");
    r.writer.recordFileCreated();
    r.writer.recordBytesWritten(1);
    r.plugin.completeProjection(r.plugin.startProjection(), "commit", "success");
    expect(fake.creations).toHaveLength(count);
  });
});

describe("recording semantics", () => {
  test("extraction pipeline records commit, success, error, and terminal ownership", () => {
    const fake = new FakeMeter(),
      r = createExtractionPipelineMetricRecorder(meter(fake), sequence(0, 1000, 2000, 3000));
    r.recordCommitAccepted("file");
    const success = r.startOutputWrite();
    r.completeOutputWrite(success, "file", "success");
    r.completeOutputWrite(success, "file", "error");
    const error = r.startOutputWrite();
    r.completeOutputWrite(error, "commit", "error");
    expect(fake.calls).toEqual([
      call(names.accepted, 1, { "gitlode.extraction.granularity": "file" }),
      call(names.writeDuration, 1, {
        "gitlode.extraction.granularity": "file",
        "gitlode.output.write.outcome": "success",
      }),
      call(names.writeRecord, 1, { "gitlode.extraction.granularity": "file" }),
      call(names.writeDuration, 1, {
        "gitlode.extraction.granularity": "commit",
        "gitlode.output.write.outcome": "error",
      }),
    ]);
  });
  test("file expansion records success zero, error, counters, and no duplicates", () => {
    const fake = new FakeMeter(),
      r = createFileChangeFactExpanderMetricRecorder(meter(fake), sequence(0, 1000, 2000, 3000));
    r.recordExpanded("renamed");
    r.recordDiffSkipped("size_limit");
    const success = r.startExpansion();
    r.completeExpansion(success, { outcome: "success", size: 0 });
    r.completeExpansion(success, { outcome: "success", size: 2 });
    const error = r.startExpansion();
    r.completeExpansion(error, { outcome: "error" });
    expect(fake.calls).toEqual([
      call(names.expanded, 1, { "gitlode.git.file_change.type": "renamed" }),
      call(names.skipped, 1, { "gitlode.file_change.diff.skip_reason": "size_limit" }),
      call(names.expansionDuration, 1, { "gitlode.file_change.expansion.outcome": "success" }),
      call(names.expansionSize, 0),
      call(names.expansionDuration, 1, { "gitlode.file_change.expansion.outcome": "error" }),
    ]);
  });
  test.each(["success", "error"] as const)(
    "built-in projection records %s and suppresses duplicate",
    (outcome) => {
      const fake = new FakeMeter(),
        r = createBuiltInFactProjectorMetricRecorder(meter(fake), sequence(0, 500)),
        token = r.startProjection();
      r.completeProjection(token, "file-change", outcome);
      r.completeProjection(token, "commit", outcome);
      expect(fake.calls).toEqual([
        call(names.projection, 0.5, {
          "gitlode.projection.fact.type": "file-change",
          "gitlode.projection.outcome": outcome,
        }),
      ]);
    },
  );
  test("built-in projection omits unavailable duration", () => {
    const fake = new FakeMeter(),
      r = createBuiltInFactProjectorMetricRecorder(
        meter(fake),
        createMonotonicTiming(() => {
          throw new Error("clock");
        }),
      ),
      token = r.startProjection();
    r.completeProjection(token, "commit", "success");
    r.completeProjection(token, "commit", "error");
    expect(fake.calls).toEqual([]);
  });
  test("JSONL writer applies both zero policies and numeric isolation", () => {
    const fake = new FakeMeter(),
      r = createJsonlFileWriterMetricRecorder(meter(fake));
    r.recordFileCreated();
    for (const value of [4, 0, -1, NaN, Infinity, -Infinity]) r.recordBytesWritten(value);
    expect(fake.calls).toEqual([call(names.fileCreated, 1), call(names.bytes, 4)]);
  });
  test("plugin projection records exact siblings once", () => {
    const fake = new FakeMeter(),
      r = createPluginProjectionMetricRecorder(meter(fake), sequence(0, 250)),
      token = r.startProjection();
    r.completeProjection(token, "commit", "failure_continued");
    r.completeProjection(token, "commit", "success");
    const attrs = {
      "gitlode.projection.fact.type": "commit",
      "gitlode.plugin.projection.outcome": "failure_continued",
    };
    expect(fake.calls).toEqual([
      call(names.pluginOperation, 1, attrs),
      call(names.pluginDuration, 0.25, attrs),
    ]);
  });
});

describe("clock and numeric isolation", () => {
  const failingTimings = [
    {
      label: "throwing start",
      timing: () =>
        createMonotonicTiming(() => {
          throw new Error("clock");
        }),
    },
    { label: "nonfinite completion", timing: () => sequence(0, Infinity) },
  ];
  test.each(failingTimings)("output write preserves counter for $label", ({ timing }) => {
    const fake = new FakeMeter(),
      r = createExtractionPipelineMetricRecorder(meter(fake), timing()),
      token = r.startOutputWrite();
    r.completeOutputWrite(token, "commit", "success");
    r.completeOutputWrite(token, "commit", "success");
    expect(fake.calls).toEqual([
      call(names.writeRecord, 1, { "gitlode.extraction.granularity": "commit" }),
    ]);
  });
  test.each(failingTimings)("file expansion preserves size for $label", ({ timing }) => {
    const fake = new FakeMeter(),
      r = createFileChangeFactExpanderMetricRecorder(meter(fake), timing()),
      token = r.startExpansion();
    r.completeExpansion(token, { outcome: "success", size: 3 });
    r.completeExpansion(token, { outcome: "success", size: 4 });
    expect(fake.calls).toEqual([call(names.expansionSize, 3)]);
  });
  test.each(failingTimings)("plugin projection preserves operation for $label", ({ timing }) => {
    const fake = new FakeMeter(),
      r = createPluginProjectionMetricRecorder(meter(fake), timing()),
      token = r.startProjection();
    r.completeProjection(token, "commit", "success");
    r.completeProjection(token, "commit", "success");
    expect(fake.calls).toEqual([
      call(names.pluginOperation, 1, {
        "gitlode.projection.fact.type": "commit",
        "gitlode.plugin.projection.outcome": "success",
      }),
    ]);
  });
  test.each([-1, NaN, Infinity, -Infinity])(
    "file expansion invalid size %s omits only size",
    (size) => {
      const fake = new FakeMeter(),
        r = createFileChangeFactExpanderMetricRecorder(meter(fake), sequence(0, 1000));
      r.completeExpansion(r.startExpansion(), { outcome: "success", size });
      expect(fake.calls).toEqual([
        call(names.expansionDuration, 1, { "gitlode.file_change.expansion.outcome": "success" }),
      ]);
    },
  );
});

describe("no-op recorder families", () => {
  test("extraction pipeline", () => {
    const r = NOOP_EXTRACTION_PIPELINE_METRIC_RECORDER,
      a = r.startOutputWrite(),
      b = r.startOutputWrite();
    expect(a).toBe(b);
    expect(() => {
      r.recordCommitAccepted("commit");
      r.completeOutputWrite(a, "commit", "success");
      r.completeOutputWrite(a, "commit", "error");
    }).not.toThrow();
  });
  test("file-change expander", () => {
    const r = NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
      a = r.startExpansion(),
      b = r.startExpansion();
    expect(a).toBe(b);
    expect(() => {
      r.recordExpanded("added");
      r.recordDiffSkipped("binary");
      r.completeExpansion(a, { outcome: "success", size: 0 });
      r.completeExpansion(a, { outcome: "error" });
    }).not.toThrow();
  });
  test("built-in projector", () => {
    const r = NOOP_BUILT_IN_FACT_PROJECTOR_METRIC_RECORDER,
      a = r.startProjection(),
      b = r.startProjection();
    expect(a).toBe(b);
    expect(() => {
      r.completeProjection(a, "commit", "success");
      r.completeProjection(a, "commit", "error");
    }).not.toThrow();
  });
  test("JSONL writer", () =>
    expect(() => {
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER.recordFileCreated();
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER.recordBytesWritten(1);
    }).not.toThrow());
  test("plugin projection", () => {
    const r = NOOP_PLUGIN_PROJECTION_METRIC_RECORDER,
      a = r.startProjection(),
      b = r.startProjection();
    expect(a).toBe(b);
    expect(() => {
      r.completeProjection(a, "commit", "success");
      r.completeProjection(a, "commit", "success");
    }).not.toThrow();
  });
});
