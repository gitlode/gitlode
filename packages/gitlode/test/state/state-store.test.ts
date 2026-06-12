import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProgressReporter, ExtractionState, StateStore } from "../../src/core/index.js";
import {
  loadExtractionState,
  NodeStateStore,
  validateLoadedState,
  type PriorStateLoadOptions,
} from "../../src/state/index.js";
import type { AbsolutePath } from "../../src/support/index.js";

function makePriorStateLoadOptions(
  overrides: Partial<PriorStateLoadOptions> = {},
): PriorStateLoadOptions {
  return {
    incremental: true,
    missingState: "error",
    stateFilePath: "/tmp/state.json",
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
      repositoryPath: process.cwd() as AbsolutePath,
      refs: [],
    };

    await store.write(state);
    await expect(store.read()).resolves.toEqual(state);
  });
});

describe("validateLoadedState", () => {
  it("returns the loaded state when the repository path and OID profile are valid", () => {
    const state: ExtractionState = {
      version: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      repositoryPath: process.cwd() as AbsolutePath,
      refs: [
        {
          ref: "main",
          refType: "branch",
          tipOid: "1".padStart(40, "0"),
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    expect(validateLoadedState(state, process.cwd(), "sha1")).toBe(state);
  });

  it("rejects states from a different repository", () => {
    const state: ExtractionState = {
      version: 2,
      generatedAt: "",
      repositoryPath: "/different-repo" as AbsolutePath,
      refs: [],
    };

    expect(() => validateLoadedState(state, process.cwd(), "sha1")).toThrow(
      "State file was created for a different repository: /different-repo",
    );
  });

  it("validates repository object format specific commit OIDs", async () => {
    const state = {
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
    };

    expect(() => validateLoadedState(state, process.cwd(), "sha1")).toThrow(
      'Invalid commit OID in state file for ref "main": not-an-oid',
    );
  });
});

describe("loadExtractionState", () => {
  it("returns an empty state when state file is missing", async () => {
    const state = await loadExtractionState(makeStateStore(null));

    expect(state).toBeUndefined();
  });

  it("rejects incompatible state versions", async () => {
    const store = makeStateStore({
      version: 1,
      generatedAt: "",
      repositoryPath: process.cwd() as AbsolutePath,
      refs: [],
    });

    await expect(loadExtractionState(store)).rejects.toThrow(
      "Unsupported state file version: 1. Supported version: 2.",
    );
  });

  it("rejects invalid ref type", async () => {
    const store = makeStateStore({
      version: 2,
      generatedAt: "",
      repositoryPath: process.cwd() as AbsolutePath,
      refs: [
        {
          ref: "main",
          refType: "invalid-type",
          tipOid: "845f01ac537d34adaae8ee77e83e1cceb73fdce7",
          updatedAt: "2026-06-11T02:15:23.125Z",
        },
      ],
    });

    await expect(loadExtractionState(store)).rejects.toThrow(
      'Invalid ref type in state file for ref "main": invalid-type',
    );
  });
});
