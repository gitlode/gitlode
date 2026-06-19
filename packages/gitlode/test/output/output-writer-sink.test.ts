import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProjectedRecord } from "../../src/core/types.js";
import { OutputWriterSink } from "../../src/output/output-writer-sink.js";
import { OutputWriter } from "../../src/output/writer.js";

function makeRecord(oid: string): ProjectedRecord {
  return {
    oid,
    message: `commit ${oid.slice(0, 7)}`,
    author: { name: "Test", email: "t@t.com", timestamp: "2024-01-01T00:00:00+00:00" },
    committer: { name: "Test", email: "t@t.com", timestamp: "2024-01-01T00:00:00+00:00" },
    parents: [],
    repository: { name: "repo", url: null },
  };
}

describe("OutputWriterSink", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gitlode-sink-test-${randomUUID()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeSinkAndWriter() {
    const writer = new OutputWriter(
      tmpDir,
      (seq) => `out-${String(seq).padStart(6, "0")}.jsonl`,
      {},
    );
    const sink = new OutputWriterSink(writer);
    return { writer, sink };
  }

  it("delegates write() to the underlying OutputWriter", async () => {
    const { sink } = makeSinkAndWriter();
    await sink.write(makeRecord("1".padStart(40, "0")));
    await sink.write(makeRecord("2".padStart(40, "0")));
    await sink.close();

    expect(sink.filesCreated).toBe(1);
    expect(sink.bytesWritten).toBeGreaterThan(0);
  });

  it("exposes the writer's filesCreated count", async () => {
    const { writer, sink } = makeSinkAndWriter();
    expect(sink.filesCreated).toBe(0);
    await writer.write(makeRecord("1".padStart(40, "0")));
    await writer.close();
    expect(sink.filesCreated).toBe(1);
  });

  it("exposes the writer's bytesWritten count", async () => {
    const { writer, sink } = makeSinkAndWriter();
    expect(sink.bytesWritten).toBe(0);
    await writer.write(makeRecord("1".padStart(40, "0")));
    await writer.close();
    expect(sink.bytesWritten).toBeGreaterThan(0);
  });

  it("delegates close() to the underlying OutputWriter (no error on empty)", async () => {
    const { sink } = makeSinkAndWriter();
    // close without any writes — should be a no-op (no file opened)
    await expect(sink.close()).resolves.toBeUndefined();
    expect(sink.filesCreated).toBe(0);
  });

  it("filesCreated and bytesWritten stay in sync with underlying writer after multiple writes", async () => {
    const { writer, sink } = makeSinkAndWriter();
    await writer.write(makeRecord("1".padStart(40, "0")));
    await writer.write(makeRecord("2".padStart(40, "0")));
    await writer.close();
    expect(sink.filesCreated).toBe(writer.filesCreated);
    expect(sink.bytesWritten).toBe(writer.bytesWritten);
  });
});
