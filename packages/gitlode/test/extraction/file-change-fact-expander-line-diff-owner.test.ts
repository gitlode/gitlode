import type { CommitFact } from "@gitlode/internal-contracts/extraction";
import type { FileBlobChange, GitAdapter } from "@gitlode/internal-contracts/git";
import type { BlobOid, CommitOid } from "@gitlode/internal-contracts/model";
import { createMonotonicTiming } from "@gitlode/internal-contracts/telemetry";
import { createLineDiffMetricRecorder, JsLineDiffCalculator } from "@gitlode/line-diff-adapters";
import type { Meter } from "@opentelemetry/api";
import type { diffLines as DiffLines } from "diff";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER } from "../../src/extraction/file-change-fact-expander-metric-recorder.js";
import { FileChangeFactExpander } from "../../src/extraction/file-change-fact-expander.js";

const diffModule = vi.hoisted(() => ({
  defaultImplementation: undefined as unknown as typeof DiffLines,
  diffLines: vi.fn<typeof DiffLines>(),
}));

vi.mock("diff", async (importOriginal) => {
  const actual = await importOriginal<{ diffLines: typeof DiffLines }>();
  diffModule.defaultImplementation = actual.diffLines;
  diffModule.diffLines.mockImplementation(actual.diffLines);
  return { ...actual, diffLines: diffModule.diffLines };
});

class RecordingMeter {
  readonly creations: Array<{ readonly kind: string; readonly name: string }> = [];
  readonly calls: Array<{
    readonly name: string;
    readonly value: number;
    readonly attributes: Record<string, unknown>;
  }> = [];

  createCounter(name: string) {
    this.creations.push({ kind: "counter", name });
    return {
      add: (value: number, attributes: Record<string, unknown>) =>
        this.calls.push({ name, value, attributes }),
    };
  }

  createHistogram(name: string) {
    this.creations.push({ kind: "histogram", name });
    return {
      record: (value: number, attributes: Record<string, unknown>) =>
        this.calls.push({ name, value, attributes }),
    };
  }
}

const REPOSITORY_PATH = "/repo";
const encoder = new TextEncoder();

function commitFact(): CommitFact {
  return {
    type: "commit",
    oid: "a".repeat(40) as CommitOid,
    message: "message",
    author: { name: "A", email: "a@example.com", timestamp: 1, timezoneOffset: 0 },
    committer: { name: "C", email: "c@example.com", timestamp: 1, timezoneOffset: 0 },
    parents: [],
    repository: { name: "repo", url: null },
  };
}

function addedChange(content: Uint8Array): FileBlobChange {
  return {
    status: "added",
    before: null,
    after: {
      path: "file.txt",
      oid: "b".repeat(40) as BlobOid,
      mode: "100644",
      content,
    },
  };
}

async function* iterable<T>(values: readonly T[]): AsyncIterable<T> {
  yield* values;
}

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const value of values) collected.push(value);
  return collected;
}

function setup(content: Uint8Array, maxDiffSize?: number) {
  const meter = new RecordingMeter();
  let now = 0;
  const calculator = new JsLineDiffCalculator({
    metricRecorder: createLineDiffMetricRecorder(
      meter as unknown as Meter,
      createMonotonicTiming(() => (now += 100)),
    ),
  });
  const completeExpansion = vi.fn();
  const recordDiffSkipped = vi.fn();
  const recordExpanded = vi.fn();
  const expansionToken = {} as never;
  const expansionRecorder = {
    ...NOOP_FILE_CHANGE_FACT_EXPANDER_METRIC_RECORDER,
    startExpansion: vi.fn(() => expansionToken),
    completeExpansion,
    recordDiffSkipped,
    recordExpanded,
  };
  const source: Pick<GitAdapter, "getFileBlobChanges"> = {
    async *getFileBlobChanges() {
      yield addedChange(content);
    },
  };
  const expander = new FileChangeFactExpander(source, calculator, expansionRecorder, maxDiffSize);
  return {
    completeExpansion,
    expansionToken,
    expander,
    meter,
    recordDiffSkipped,
    recordExpanded,
  };
}

function outcomes(meter: RecordingMeter) {
  return meter.calls.map(({ name, attributes }) => ({
    name,
    outcome: attributes["gitlode.line_diff.compute.outcome"],
  }));
}

afterEach(() => {
  diffModule.diffLines.mockReset();
  diffModule.diffLines.mockImplementation(diffModule.defaultImplementation);
});

describe("FileChangeFactExpander line-diff owner guard ordering", () => {
  it("runs the concrete calculator once for text within the size limit", async () => {
    const content = encoder.encode("text\n");
    const state = setup(content, content.byteLength);

    const [fact] = await collect(state.expander.expand(iterable([commitFact()]), REPOSITORY_PATH));

    expect(fact?.file).toMatchObject({ additions: 1, deletions: 0 });
    expect(state.meter.creations).toHaveLength(3);
    expect(outcomes(state.meter)).toEqual([
      { name: "gitlode.line_diff.compute.operation", outcome: "success" },
      { name: "gitlode.line_diff.compute.duration", outcome: "success" },
      { name: "gitlode.line_diff.compute.input.size", outcome: "success" },
    ]);
    expect(state.meter.calls.at(-1)?.value).toBe(content.byteLength);
    expect(state.recordExpanded).toHaveBeenCalledOnce();
  });

  it.each([
    ["binary", new Uint8Array([0x41, 0, 0x42]), undefined, "binary"],
    ["too large", encoder.encode("12345"), 4, "size"],
    ["too large and binary", new Uint8Array([0, 1, 2, 3, 4]), 4, "size"],
  ] as const)("skips $0 before concrete computation", async (_label, content, limit, reason) => {
    const state = setup(content, limit);

    const [fact] = await collect(state.expander.expand(iterable([commitFact()]), REPOSITORY_PATH));

    expect(fact?.file).toMatchObject({ additions: null, deletions: null });
    expect(state.meter.calls).toEqual([]);
    expect(state.recordDiffSkipped).toHaveBeenCalledOnce();
    expect(state.recordDiffSkipped).toHaveBeenCalledWith(reason);
  });

  it("records both implementation and expansion error without partial effects", async () => {
    const failure = { reason: "diff failure" };
    diffModule.diffLines.mockImplementationOnce(() => {
      throw failure;
    });
    const state = setup(encoder.encode("text\n"));

    await expect(
      collect(state.expander.expand(iterable([commitFact()]), REPOSITORY_PATH)),
    ).rejects.toBe(failure);

    expect(outcomes(state.meter)).toEqual([
      { name: "gitlode.line_diff.compute.operation", outcome: "error" },
      { name: "gitlode.line_diff.compute.duration", outcome: "error" },
      { name: "gitlode.line_diff.compute.input.size", outcome: "error" },
    ]);
    expect(state.completeExpansion).toHaveBeenCalledWith(state.expansionToken, {
      outcome: "error",
    });
    expect(state.recordExpanded).not.toHaveBeenCalled();
  });

  it("keeps implementation success when later result validation fails", async () => {
    diffModule.diffLines.mockImplementationOnce(() => [{ added: true, count: -1, value: "x" }]);
    const state = setup(encoder.encode("text\n"));

    await expect(
      collect(state.expander.expand(iterable([commitFact()]), REPOSITORY_PATH)),
    ).rejects.toThrow("LineDiffCalculator returned invalid values");

    expect(outcomes(state.meter)).toEqual([
      { name: "gitlode.line_diff.compute.operation", outcome: "success" },
      { name: "gitlode.line_diff.compute.duration", outcome: "success" },
      { name: "gitlode.line_diff.compute.input.size", outcome: "success" },
    ]);
    expect(state.completeExpansion).toHaveBeenCalledWith(state.expansionToken, {
      outcome: "error",
    });
    expect(state.recordExpanded).not.toHaveBeenCalled();
  });
});
