import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ExtractionCheckpoint } from "@gitlode/internal-contracts/extraction";
import type { AbsolutePath } from "@gitlode/internal-foundation/support";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadStateFile,
  NodeStateStore,
  saveStateFile,
  type StateDocumentV2,
  type StateStore,
} from "../../src/state/index.js";

function makeStateStore(value: unknown | null): StateStore {
  return {
    async read() {
      return value;
    },
    async write() {},
  };
}
const path = process.cwd() as AbsolutePath;
const document: StateDocumentV2 = {
  version: 2,
  generatedAt: "2026-01-01T00:00:00.000Z",
  repositoryPath: path,
  refs: [{ ref: "main", refType: "branch", tipOid: "abc", updatedAt: "now" }],
};

describe("NodeStateStore", () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-state-store-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads a v2 document with the existing JSON shape and property order", async () => {
    const stateFilePath = join(tmpDir, "state.json");
    const store = new NodeStateStore(stateFilePath);
    await store.write(document);
    await expect(store.read()).resolves.toEqual(document);
    expect(await readFile(stateFilePath, "utf8")).toBe(JSON.stringify(document, null, 2));
  });
});

describe("state file adaptation", () => {
  it("returns undefined when the state file is missing", async () => {
    await expect(loadStateFile(makeStateStore(null))).resolves.toBeUndefined();
  });

  it("loads v2 into fresh version-independent checkpoint objects and accepts unknown fields", async () => {
    const input = { ...document, unknown: true, refs: [{ ...document.refs[0], unknown: true }] };
    const checkpoint = await loadStateFile(makeStateStore(input));
    expect(checkpoint).toEqual({
      generatedAt: document.generatedAt,
      repositoryPath: path,
      refs: document.refs,
    });
    expect(checkpoint).not.toBe(input);
    expect(checkpoint?.refs).not.toBe(input.refs);
    expect(checkpoint?.refs[0]).not.toBe(input.refs[0]);
    expect(checkpoint).not.toHaveProperty("version");
  });

  it("saves a fresh v2 document and fresh ref entries", async () => {
    const write = vi.fn();
    const checkpoint: ExtractionCheckpoint = {
      generatedAt: document.generatedAt,
      repositoryPath: path,
      refs: [{ ref: "main", refType: "branch", tipOid: "abc", updatedAt: "now" }],
    };
    await saveStateFile(
      {
        async read() {
          return null;
        },
        write,
      },
      checkpoint,
    );
    const saved = write.mock.calls[0]?.[0];
    expect(saved).toEqual(document);
    expect(saved).not.toBe(checkpoint);
    expect(saved.refs[0]).not.toBe(checkpoint.refs[0]);
  });

  it("preserves the unsupported version diagnostic including missing versions", async () => {
    await expect(loadStateFile(makeStateStore({ version: 1 }))).rejects.toThrow(
      "Unsupported state file version: 1. Supported version: 2. Reinitialize the state file (for example, run without --incremental once with --state).",
    );
    await expect(loadStateFile(makeStateStore({}))).rejects.toThrow(
      "Unsupported state file version: undefined.",
    );
  });

  it("preserves the invalid ref type diagnostic", async () => {
    await expect(
      loadStateFile(
        makeStateStore({ ...document, refs: [{ ...document.refs[0], refType: "invalid-type" }] }),
      ),
    ).rejects.toThrow('Invalid ref type in state file for ref "main": invalid-type');
  });

  it.each([
    "bad",
    1,
    [],
    { version: 2 },
    { ...document, refs: [null] },
    { ...document, refs: [{}] },
  ])("rejects malformed document %#", async (value) => {
    await expect(loadStateFile(makeStateStore(value))).rejects.toThrow(
      "Invalid state file contents.",
    );
  });
});
