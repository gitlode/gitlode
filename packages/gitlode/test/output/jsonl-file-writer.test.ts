import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProjectedCommit, ProjectedFileChange } from "@gitlode/internal-contracts/extraction";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOOP_JSONL_FILE_WRITER_METRIC_RECORDER } from "../../src/output/jsonl-file-writer-metric-recorder.js";
import { JsonlFileWriter } from "../../src/output/jsonl-file-writer.js";

function makeCommit(oid: string): ProjectedCommit {
  return {
    oid,
    message: `commit ${oid.slice(0, 7)}`,
    author: {
      name: "Test User",
      email: "test@example.com",
      timestamp: "2024-01-01T00:00:00+00:00",
    },
    committer: {
      name: "Test User",
      email: "test@example.com",
      timestamp: "2024-01-01T00:00:00+00:00",
    },
    parents: [],
    repository: { name: "test-repo", url: null },
  };
}

function replaceHandle(writer: JsonlFileWriter, handle: object): void {
  Object.defineProperty(writer, "handle", { configurable: true, value: handle, writable: true });
}

function oid(n: number): string {
  return String(n).padStart(40, "0");
}

describe("JsonlFileWriter", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gitlode-test-${randomUUID()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes all commits to a single file when no rotation is configured", async () => {
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      {},
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    await writer.write(makeCommit(oid(1)));
    await writer.write(makeCommit(oid(2)));
    await writer.write(makeCommit(oid(3)));
    await writer.close();

    const content = await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
  });

  it("rotates to a new file after maxLines — triggering line stays in file 1", async () => {
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      { maxLines: 2 },
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    await writer.write(makeCommit(oid(1)));
    await writer.write(makeCommit(oid(2))); // triggers rotation; this line is in file 1
    await writer.write(makeCommit(oid(3))); // goes to file 2
    await writer.close();

    const lines1 = (await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    const lines2 = (await readFile(join(tmpDir, "repo-000002.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    expect(lines1).toHaveLength(2);
    expect(lines2).toHaveLength(1);
  });

  it("rotates to a new file after maxBytes — triggering line stays in file 1", async () => {
    const sampleCommit = makeCommit(oid(1));
    const lineSize = Buffer.byteLength(JSON.stringify(sampleCommit) + "\n", "utf8");

    // maxBytes = exactly one line: after first write byte count equals maxBytes → rotate
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      { maxBytes: lineSize },
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    await writer.write(makeCommit(oid(1))); // triggers rotation; stays in file 1
    await writer.write(makeCommit(oid(2))); // goes to file 2
    await writer.close();

    const lines1 = (await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    const lines2 = (await readFile(join(tmpDir, "repo-000002.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    expect(lines1).toHaveLength(1);
    expect(lines2).toHaveLength(1);
  });

  it("rotates when either threshold is reached first (lines wins)", async () => {
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      {
        maxLines: 2,
        maxBytes: 999_999,
      },
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    for (let i = 1; i <= 3; i++) {
      await writer.write(makeCommit(oid(i)));
    }
    await writer.close();

    const lines1 = (await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    const lines2 = (await readFile(join(tmpDir, "repo-000002.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    expect(lines1).toHaveLength(2);
    expect(lines2).toHaveLength(1);
  });

  it("output is valid JSONL: each line parses as JSON and matches the written commit", async () => {
    const commit = makeCommit("a".repeat(40));
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      {},
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    await writer.write(commit);
    await writer.close();

    const content = await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as ProjectedCommit;
    expect(parsed.oid).toBe("a".repeat(40));
    expect(parsed.message).toBe(commit.message);
    expect(parsed.repository.url).toBeNull();
  });

  it("uses LF line endings only (no CRLF)", async () => {
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      {},
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    await writer.write(makeCommit(oid(1)));
    await writer.write(makeCommit(oid(2)));
    await writer.close();

    const raw = await readFile(join(tmpDir, "repo-000001.jsonl"));
    const content = raw.toString("utf8");
    expect(content).not.toContain("\r\n");
    // Each line ends with exactly \n
    const lines = content.split("\n");
    // Last element after trailing \n is empty string; all others are non-empty JSON
    expect(lines[lines.length - 1]).toBe("");
    for (const line of lines.slice(0, -1)) {
      expect(line).not.toHaveLength(0);
    }
  });

  it("accepts ProjectedFileChange (with file field) without error", async () => {
    const base = makeCommit(oid(1));
    const fileRecord: ProjectedFileChange = {
      ...base,
      file: {
        path: "src/index.ts",
        status: "modified",
        additions: 5,
        deletions: 2,
      },
    };
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new JsonlFileWriter(
      tmpDir,
      filenameFor,
      {},
      NOOP_JSONL_FILE_WRITER_METRIC_RECORDER,
    );
    await writer.write(fileRecord);
    await writer.close();

    const content = await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8");
    const parsed = JSON.parse(content.trim()) as ProjectedFileChange;
    expect(parsed.oid).toBe(base.oid);
    expect(parsed.file.path).toBe("src/index.ts");
    expect(parsed.file.status).toBe("modified");
    expect(parsed.file.additions).toBe(5);
    expect(parsed.file.deletions).toBe(2);
  });

  it("records file and UTF-8 bytes only after successful writes", async () => {
    const recordFileCreated = vi.fn();
    const recordBytesWritten = vi.fn();
    const writer = new JsonlFileWriter(
      tmpDir,
      (seq) => `metrics-${seq}.jsonl`,
      {},
      { recordFileCreated, recordBytesWritten },
    );
    const record = makeCommit(oid(1));
    await writer.write(record);
    await writer.close();

    expect(recordFileCreated).toHaveBeenCalledTimes(1);
    expect(recordBytesWritten).toHaveBeenCalledWith(
      Buffer.byteLength(`${JSON.stringify(record)}\n`, "utf8"),
    );
  });

  it("records each successful rotated open and UTF-8 JSONL byte count exactly once", async () => {
    const recordFileCreated = vi.fn();
    const recordBytesWritten = vi.fn();
    const writer = new JsonlFileWriter(
      tmpDir,
      (seq) => `rotated-${seq}.jsonl`,
      { maxLines: 1 },
      { recordFileCreated, recordBytesWritten },
    );
    const records = [makeCommit(oid(1)), makeCommit(oid(2)), makeCommit(oid(3))];

    for (const record of records) await writer.write(record);
    await writer.close();

    const expectedBytes = records.map((record) => Buffer.byteLength(`${JSON.stringify(record)}\n`));
    expect(recordFileCreated).toHaveBeenCalledTimes(3);
    expect(recordBytesWritten).toHaveBeenCalledTimes(3);
    expect(recordBytesWritten.mock.calls.map(([bytes]) => bytes)).toEqual(expectedBytes);
    expect(writer.filesCreated).toBe(recordFileCreated.mock.calls.length);
    expect(writer.bytesWritten).toBe(expectedBytes.reduce((total, bytes) => total + bytes, 0));
  });

  it("keeps successful metrics and state when an underlying write fails", async () => {
    const recordFileCreated = vi.fn();
    const recordBytesWritten = vi.fn();
    const writer = new JsonlFileWriter(
      tmpDir,
      (seq) => `write-failure-${seq}.jsonl`,
      { maxLines: 1 },
      { recordFileCreated, recordBytesWritten },
    );
    const first = makeCommit(oid(1));
    await writer.write(first);
    const failure = new Error("write failed");
    const close = vi.fn(async () => undefined);
    replaceHandle(writer, {
      write: async () => {
        throw failure;
      },
      close,
    });

    await expect(writer.write(makeCommit(oid(2)))).rejects.toBe(failure);
    expect(recordFileCreated).toHaveBeenCalledTimes(1);
    expect(recordBytesWritten).toHaveBeenCalledTimes(1);
    expect(writer.filesCreated).toBe(1);
    expect(writer.bytesWritten).toBe(Buffer.byteLength(`${JSON.stringify(first)}\n`));
    expect(close).not.toHaveBeenCalled();
    await writer.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps successful metrics and state when rotation close fails", async () => {
    const recordFileCreated = vi.fn();
    const recordBytesWritten = vi.fn();
    const writer = new JsonlFileWriter(
      tmpDir,
      (seq) => `close-failure-${seq}.jsonl`,
      { maxLines: 1 },
      { recordFileCreated, recordBytesWritten },
    );
    const first = makeCommit(oid(1));
    await writer.write(first);
    const failure = new Error("rotation close failed");
    const close = vi.fn(async () => {
      throw failure;
    });
    const second = makeCommit(oid(2));
    replaceHandle(writer, {
      write: async () => undefined,
      close,
    });

    await expect(writer.write(second)).rejects.toBe(failure);
    expect(recordFileCreated).toHaveBeenCalledTimes(1);
    expect(recordBytesWritten.mock.calls.map(([bytes]) => bytes)).toEqual([
      Buffer.byteLength(`${JSON.stringify(first)}\n`),
      Buffer.byteLength(`${JSON.stringify(second)}\n`),
    ]);
    expect(writer.filesCreated).toBe(1);
    expect(writer.bytesWritten).toBe(
      Buffer.byteLength(`${JSON.stringify(first)}\n`) +
        Buffer.byteLength(`${JSON.stringify(second)}\n`),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not record or advance file state when opening fails", async () => {
    const recordFileCreated = vi.fn();
    const recordBytesWritten = vi.fn();
    const writer = new JsonlFileWriter(
      join(tmpDir, "missing-directory"),
      (seq) => `failed-${seq}.jsonl`,
      {},
      { recordFileCreated, recordBytesWritten },
    );

    await expect(writer.write(makeCommit(oid(1)))).rejects.toThrow();
    expect(recordFileCreated).not.toHaveBeenCalled();
    expect(recordBytesWritten).not.toHaveBeenCalled();
    expect(writer.filesCreated).toBe(0);
    expect(writer.bytesWritten).toBe(0);
  });
});
