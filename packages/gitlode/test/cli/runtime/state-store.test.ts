import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ParsedArgs } from "../../../src/cli/args.js";
import {
  assertSupportedRepositoryObjectFormat,
  NodeStateStore,
  loadPriorState,
} from "../../../src/cli/runtime/index.js";
import type { ProgressReporter, ExtractionState, StateStore } from "../../../src/core/index.js";

function makeParsedArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    repositoryPath: process.cwd(),
    refs: ["main"],
    outputDir: "/tmp/out",
    outputPrefix: "repo",
    rotation: {},
    incremental: true,
    missingState: "error",
    range: undefined,
    stateFilePath: "/tmp/state.json",
    perFile: false,
    quiet: false,
    profile: false,
    ...overrides,
  };
}

function makeReporter(): ProgressReporter & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    emit(event) {
      if (event.type === "warning") {
        warnings.push(event.message);
      }
    },
  };
}

function makeStateStore(state: ExtractionState | null): StateStore {
  return {
    async read() {
      return state;
    },
    async write() {},
  };
}

describe("assertSupportedRepositoryObjectFormat", () => {
  it("accepts supported repository object formats", () => {
    expect(() => assertSupportedRepositoryObjectFormat("sha1", ["sha1"])).not.toThrow();
  });

  it("rejects unsupported repository object formats", () => {
    expect(() => assertSupportedRepositoryObjectFormat("sha256", ["sha1"])).toThrow(
      "Unsupported repository object format: sha256. Supported formats: sha1.",
    );
  });
});

describe("NodeStateStore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-state-store-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads state via a temp file rename", async () => {
    const stateFilePath = join(tmpDir, "state.json");
    const store = new NodeStateStore(stateFilePath);
    const state: ExtractionState = {
      version: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      repositoryPath: process.cwd(),
      refs: [],
    };

    await store.write(state);
    await expect(store.read()).resolves.toEqual(state);
  });
});

describe("loadPriorState", () => {
  it("returns an empty state when incremental mode is disabled", async () => {
    const reporter = makeReporter();
    const state = await loadPriorState(
      makeStateStore(null),
      makeParsedArgs({ incremental: false }),
      process.cwd(),
      "sha1",
      reporter,
    );

    expect(state).toEqual({ version: 2, generatedAt: "", repositoryPath: process.cwd(), refs: [] });
    expect(reporter.warnings).toEqual([]);
  });

  it("warns and falls back to a full snapshot when the incremental state file is missing", async () => {
    const reporter = makeReporter();
    const state = await loadPriorState(
      makeStateStore(null),
      makeParsedArgs({
        stateFilePath: join(tmpdir(), "missing-state.json"),
        missingState: "snapshot",
      }),
      process.cwd(),
      "sha1",
      reporter,
    );

    expect(state.refs).toEqual([]);
    expect(reporter.warnings).toEqual([expect.stringContaining("State file not found:")]);
  });

  it("rejects incompatible state versions", async () => {
    const reporter = makeReporter();
    const store = makeStateStore({
      version: 1,
      generatedAt: "",
      repositoryPath: process.cwd(),
      refs: [],
    });

    await expect(
      loadPriorState(store, makeParsedArgs(), process.cwd(), "sha1", reporter),
    ).rejects.toThrow("Unsupported state file version: 1. Supported version: 2.");
  });

  it("validates repository object format specific commit OIDs", async () => {
    const reporter = makeReporter();
    const store = makeStateStore({
      version: 2,
      generatedAt: "",
      repositoryPath: process.cwd(),
      refs: [
        {
          ref: "main",
          refType: "branch",
          tipOid: "not-an-oid",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    await expect(
      loadPriorState(store, makeParsedArgs(), process.cwd(), "sha1", reporter),
    ).rejects.toThrow('Invalid commit OID in state file for ref "main": not-an-oid');
  });
});
