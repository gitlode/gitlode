import { describe, expect, it, vi } from "vitest";

import { EnrichingFactProjector } from "../../src/core/enriching-fact-projector.js";
import type {
  CommitFact,
  Fact,
  FileChangeFact,
  PluginEntry,
  PluginProjectionResult,
  ProgressReporter,
  ProjectionContext,
  ProjectorPlugin,
} from "../../src/core/types.js";
import type { ProjectedRecord } from "../../src/core/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommitFact(overrides: Partial<Omit<CommitFact, "type">> = {}): CommitFact {
  return {
    type: "commit",
    oid: "a".repeat(40),
    message: "fix: bug",
    author: { name: "Auth", email: "a@e.com", timestamp: 1_000_000, timezoneOffset: 0 },
    committer: { name: "Comm", email: "c@e.com", timestamp: 1_000_001, timezoneOffset: 0 },
    parents: [],
    repository: { name: "repo", url: null },
    ...overrides,
  };
}

function makeFileChangeFact(
  overrides: {
    commit?: Partial<Omit<CommitFact, "type">>;
    file?: Partial<FileChangeFact["file"]>;
  } = {},
): FileChangeFact {
  return {
    type: "file-change",
    commit: makeCommitFact(overrides.commit),
    file: {
      path: "src/index.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      ...overrides.file,
    },
  };
}

async function* toAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iter) results.push(item);
  return results;
}

const noopReporter: ProgressReporter = { emit: () => {} };

function makePlugin(
  projectFn: (ctx: ProjectionContext) => Promise<PluginProjectionResult>,
): ProjectorPlugin {
  return { project: projectFn };
}

function makeEntry(
  namespace: string,
  plugin: ProjectorPlugin,
  failurePolicy: "skip-fact" | "fatal" = "skip-fact",
): PluginEntry {
  return { namespace, plugin, failurePolicy };
}

// ---------------------------------------------------------------------------
// Basic enrichment
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — basic enrichment", () => {
  it("emits extensions field with plugin data on success", async () => {
    const plugin = makePlugin(async () => ({
      type: "success",
      data: { score: 42 },
    }));
    const projector = new EnrichingFactProjector(
      [makeEntry("my-plugin", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions).toEqual({ "my-plugin": { score: 42 } });
  });

  it("preserves all base record fields alongside extensions", async () => {
    const plugin = makePlugin(async () => ({ type: "success", data: { x: 1 } }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const fact = makeCommitFact({ oid: "b".repeat(40), message: "msg" });
    const [record] = await collect(projector.project(toAsyncIter([fact])));
    expect(record!.oid).toBe("b".repeat(40));
    expect(record!.subject).toBe("msg");
    expect(record!.extensions).toEqual({ p: { x: 1 } });
  });

  it("projects multiple facts in order", async () => {
    const plugin = makePlugin(async (ctx) => ({
      type: "success",
      data: { id: (ctx.fact as CommitFact).oid.slice(0, 4) },
    }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const facts = [
      makeCommitFact({ oid: "a".repeat(40) }),
      makeCommitFact({ oid: "b".repeat(40) }),
    ];
    const records = await collect(projector.project(toAsyncIter(facts)));
    expect(records).toHaveLength(2);
    expect(records[0]!.extensions?.["p"]).toEqual({ id: "aaaa" });
    expect(records[1]!.extensions?.["p"]).toEqual({ id: "bbbb" });
  });
});

// ---------------------------------------------------------------------------
// Declaration order
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — declaration order", () => {
  it("runs plugins in declaration order and preserves key order", async () => {
    const order: string[] = [];
    const pluginA = makePlugin(async () => {
      order.push("a");
      return { type: "success", data: {} };
    });
    const pluginB = makePlugin(async () => {
      order.push("b");
      return { type: "success", data: {} };
    });
    const projector = new EnrichingFactProjector(
      [makeEntry("a", pluginA), makeEntry("b", pluginB)],
      noopReporter,
      "repo",
      null,
    );
    await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(order).toEqual(["a", "b"]);
  });

  it("key order in extensions matches declaration order", async () => {
    const pluginA = makePlugin(async () => ({ type: "success", data: { va: 1 } }));
    const pluginB = makePlugin(async () => ({ type: "success", data: { vb: 2 } }));
    const projector = new EnrichingFactProjector(
      [makeEntry("a", pluginA), makeEntry("b", pluginB)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(Object.keys(record!.extensions!)).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// skip result
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — skip result", () => {
  it("sets namespace to null and emits warning on skip", async () => {
    const warnedMessages: string[] = [];
    const reporter: ProgressReporter = {
      emit: (e) => {
        if (e.type === "warning") warnedMessages.push(e.message);
      },
    };
    const plugin = makePlugin(async () => ({ type: "skip", message: "no data" }));
    const projector = new EnrichingFactProjector([makeEntry("p", plugin)], reporter, "repo", null);
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBeNull();
    expect(warnedMessages).toHaveLength(1);
    expect(warnedMessages[0]).toContain("p");
    expect(warnedMessages[0]).toContain("no data");
  });

  it("continues to next plugin after skip", async () => {
    const p1 = makePlugin(async () => ({ type: "skip", message: "skip me" }));
    const p2 = makePlugin(async () => ({ type: "success", data: { ok: true } }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p1", p1), makeEntry("p2", p2)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p1"]).toBeNull();
    expect(record!.extensions?.["p2"]).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// fatal result with skip-fact policy
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — fatal + skip-fact policy", () => {
  it("sets namespace to null and emits warning when policy is skip-fact", async () => {
    const warnedMessages: string[] = [];
    const reporter: ProgressReporter = {
      emit: (e) => {
        if (e.type === "warning") warnedMessages.push(e.message);
      },
    };
    const plugin = makePlugin(async () => ({ type: "fatal", message: "something broke" }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin, "skip-fact")],
      reporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBeNull();
    expect(warnedMessages).toHaveLength(1);
    expect(warnedMessages[0]).toContain("something broke");
  });

  it("does not throw when plugin returns fatal with skip-fact policy", async () => {
    const plugin = makePlugin(async () => ({ type: "fatal", message: "err" }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin, "skip-fact")],
      noopReporter,
      "repo",
      null,
    );
    await expect(collect(projector.project(toAsyncIter([makeCommitFact()])))).resolves.toHaveLength(
      1,
    );
  });
});

// ---------------------------------------------------------------------------
// fatal result with fatal policy
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — fatal + fatal policy", () => {
  it("throws when policy is fatal and plugin returns fatal result", async () => {
    const plugin = makePlugin(async () => ({ type: "fatal", message: "hard fail" }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin, "fatal")],
      noopReporter,
      "repo",
      null,
    );
    await expect(collect(projector.project(toAsyncIter([makeCommitFact()])))).rejects.toThrow(
      "hard fail",
    );
  });
});

// ---------------------------------------------------------------------------
// throw handling
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — throw handling", () => {
  it("converts thrown error to fatal and applies skip-fact policy", async () => {
    const warnedMessages: string[] = [];
    const reporter: ProgressReporter = {
      emit: (e) => {
        if (e.type === "warning") warnedMessages.push(e.message);
      },
    };
    const plugin = makePlugin(async () => {
      throw new Error("explosion");
    });
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin, "skip-fact")],
      reporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBeNull();
    expect(warnedMessages[0]).toContain("explosion");
  });

  it("converts thrown error to fatal and throws when policy is fatal", async () => {
    const plugin = makePlugin(async () => {
      throw new Error("kaboom");
    });
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin, "fatal")],
      noopReporter,
      "repo",
      null,
    );
    await expect(collect(projector.project(toAsyncIter([makeCommitFact()])))).rejects.toThrow(
      "kaboom",
    );
  });
});

// ---------------------------------------------------------------------------
// ProjectionContext
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — ProjectionContext", () => {
  it("provides fact and baseRecord in context", async () => {
    let capturedCtx: ProjectionContext | null = null;
    const plugin = makePlugin(async (ctx) => {
      capturedCtx = ctx;
      return { type: "success", data: {} };
    });
    const fact = makeCommitFact({ oid: "c".repeat(40) });
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    await collect(projector.project(toAsyncIter([fact])));
    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx!.fact).toBe(fact);
    expect(capturedCtx!.baseRecord.oid).toBe("c".repeat(40));
  });

  it("baseRecord is frozen (read-only at runtime)", async () => {
    let frozenBase: ProjectedRecord | null = null;
    const plugin = makePlugin(async (ctx) => {
      frozenBase = ctx.baseRecord;
      return { type: "success", data: {} };
    });
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(Object.isFrozen(frozenBase)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Warning format
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — warning format", () => {
  it('formats warning as Plugin "<ns>" skipped fact <oid>: <message> for commit', async () => {
    const warnings: string[] = [];
    const reporter: ProgressReporter = {
      emit: (e) => {
        if (e.type === "warning") warnings.push(e.message);
      },
    };
    const plugin = makePlugin(async () => ({ type: "skip", message: "no enrichment" }));
    const fact = makeCommitFact({ oid: "d".repeat(40) });
    const projector = new EnrichingFactProjector(
      [makeEntry("my-ns", plugin)],
      reporter,
      "repo",
      null,
    );
    await collect(projector.project(toAsyncIter([fact])));
    expect(warnings[0]).toBe(`Plugin "my-ns" skipped fact ${"d".repeat(40)}: no enrichment`);
  });

  it("formats warning with <oid>/<path> for file-change facts", async () => {
    const warnings: string[] = [];
    const reporter: ProgressReporter = {
      emit: (e) => {
        if (e.type === "warning") warnings.push(e.message);
      },
    };
    const plugin = makePlugin(async () => ({ type: "skip", message: "skipped" }));
    const fact = makeFileChangeFact({ commit: { oid: "e".repeat(40) }, file: { path: "a/b.ts" } });
    const projector = new EnrichingFactProjector([makeEntry("ns", plugin)], reporter, "repo", null);
    await collect(projector.project(toAsyncIter([fact as Fact])));
    expect(warnings[0]).toBe(`Plugin "ns" skipped fact ${"e".repeat(40)}/a/b.ts: skipped`);
  });
});

// ---------------------------------------------------------------------------
// Empty plugins bypass (tested at edge, but verify the projector is not
// normally constructed in that case — here we test no plugins = no extensions)
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — zero plugins", () => {
  it("emits records with empty extensions object when constructed with empty plugin list", async () => {
    const projector = new EnrichingFactProjector([], noopReporter, "repo", null);
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    // extensions key exists but is empty; the invariant of extensions:{} not appearing
    // in output is enforced by the config loader rejecting empty extensions sections
    expect(record!.extensions).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Scalar success payloads (Phase 1 widening)
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — scalar success payloads", () => {
  it("passes a string success value through unchanged", async () => {
    const plugin = makePlugin(async () => ({ type: "success", data: "hello" }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBe("hello");
  });

  it("passes a number success value through unchanged", async () => {
    const plugin = makePlugin(async () => ({ type: "success", data: 42 }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBe(42);
  });

  it("passes a boolean success value through unchanged", async () => {
    const plugin = makePlugin(async () => ({ type: "success", data: true }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBe(true);
  });

  it("object success payloads continue to be written unchanged (regression)", async () => {
    const plugin = makePlugin(async () => ({ type: "success", data: { score: 99, tag: "v1" } }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toEqual({ score: 99, tag: "v1" });
  });

  it("scalar and object plugins can coexist in the same record", async () => {
    const p1 = makePlugin(async () => ({ type: "success", data: "label" }));
    const p2 = makePlugin(async () => ({ type: "success", data: { count: 3 } }));
    const projector = new EnrichingFactProjector(
      [makeEntry("scalar-ns", p1), makeEntry("object-ns", p2)],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["scalar-ns"]).toBe("label");
    expect(record!.extensions?.["object-ns"]).toEqual({ count: 3 });
  });

  it("skip and fatal-with-skip-fact still produce null, not the scalar value", async () => {
    const skipPlugin = makePlugin(async () => ({ type: "skip", message: "no data" }));
    const projector = new EnrichingFactProjector(
      [makeEntry("p", skipPlugin, "skip-fact")],
      noopReporter,
      "repo",
      null,
    );
    const [record] = await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(record!.extensions?.["p"]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Plugin has init() — verify it is not called by the projector (caller's job)
// ---------------------------------------------------------------------------

describe("EnrichingFactProjector — init() not called by projector", () => {
  it("does not call plugin.init() during projection", async () => {
    const initSpy = vi.fn();
    const plugin: ProjectorPlugin = {
      init: async () => {
        initSpy();
        return { type: "ready" };
      },
      project: async () => ({ type: "success", data: {} }),
    };
    const projector = new EnrichingFactProjector(
      [makeEntry("p", plugin)],
      noopReporter,
      "repo",
      null,
    );
    await collect(projector.project(toAsyncIter([makeCommitFact()])));
    expect(initSpy).not.toHaveBeenCalled();
  });
});
