import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { OutputCommit, OutputFileRecord } from "../../src/output/types.js";
import { OutputWriter } from "../../src/output/writer.js";

function makeCommit(oid: string): OutputCommit {
  return {
    oid,
    subject: `commit ${oid.slice(0, 7)}`,
    body: "",
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

function oid(n: number): string {
  return String(n).padStart(40, "0");
}

describe("OutputWriter", () => {
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
    const writer = new OutputWriter(tmpDir, filenameFor, {});
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
    const writer = new OutputWriter(tmpDir, filenameFor, { maxLines: 2 });
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
    const writer = new OutputWriter(tmpDir, filenameFor, { maxBytes: lineSize });
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
    const writer = new OutputWriter(tmpDir, filenameFor, { maxLines: 2, maxBytes: 999_999 });
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
    const writer = new OutputWriter(tmpDir, filenameFor, {});
    await writer.write(commit);
    await writer.close();

    const content = await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as OutputCommit;
    expect(parsed.oid).toBe("a".repeat(40));
    expect(parsed.subject).toBe(commit.subject);
    expect(parsed.repository.url).toBeNull();
  });

  it("uses LF line endings only (no CRLF)", async () => {
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new OutputWriter(tmpDir, filenameFor, {});
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

  it("accepts OutputFileRecord (with file field) without error", async () => {
    const base = makeCommit(oid(1));
    const fileRecord: OutputFileRecord = {
      ...base,
      file: {
        path: "src/index.ts",
        status: "modified",
        additions: 5,
        deletions: 2,
      },
    };
    const filenameFor = (seq: number) => `repo-${String(seq).padStart(6, "0")}.jsonl`;
    const writer = new OutputWriter(tmpDir, filenameFor, {});
    await writer.write(fileRecord);
    await writer.close();

    const content = await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8");
    const parsed = JSON.parse(content.trim()) as OutputFileRecord;
    expect(parsed.oid).toBe(base.oid);
    expect(parsed.file.path).toBe("src/index.ts");
    expect(parsed.file.status).toBe("modified");
    expect(parsed.file.additions).toBe(5);
    expect(parsed.file.deletions).toBe(2);
  });
});
