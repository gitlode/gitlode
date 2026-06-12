import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigExtensionsSection } from "../../src/config/index.js";
import type { PluginEntry, PluginInitResult, PluginRuntimeContext } from "../../src/core/types.js";
import {
  checkPluginCompatibility,
  initializePlugins,
  resolvePluginEntries,
} from "../../src/plugins/plugins.js";
import type { AbsoluteDirectoryPath } from "../../src/support/index.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRuntimeContext(overrides: Partial<PluginRuntimeContext> = {}): PluginRuntimeContext {
  return {
    warn() {},
    error() {},
    ...overrides,
  };
}

function makeExtensions(entrypoint = "./plugin.mjs"): ConfigExtensionsSection {
  return {
    "test-plugin": {
      entrypoint,
      failurePolicy: "skip-fact",
    },
  };
}

describe("resolvePluginEntries", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-plugins-resolve-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("loads a relative entrypoint and returns PluginEntry values", async () => {
    await writeFile(
      join(tmpDir, "plugin.mjs"),
      `export default async function factory() {
        return { init: async () => ({ type: "ready" }), project: async () => ({ type: "success", data: {} }) };
      }`,
    );

    const result = await resolvePluginEntries(makeExtensions(), tmpDir as AbsoluteDirectoryPath);
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") {
      throw new Error("Expected resolved plugin entries");
    }

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.namespace).toBe("test-plugin");
    expect(typeof result.entries[0]!.plugin.project).toBe("function");
  });

  it("returns user-error termination when default export is missing", async () => {
    await writeFile(join(tmpDir, "plugin.mjs"), "export const noop = 1;");

    await expect(
      resolvePluginEntries(makeExtensions(), join(tmpDir, "gitlode.config.json")),
    ).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns user-error termination when factory does not return ProjectorPlugin", async () => {
    await writeFile(
      join(tmpDir, "plugin.mjs"),
      "export default async function factory() { return null; }",
    );

    await expect(
      resolvePluginEntries(makeExtensions(), join(tmpDir, "gitlode.config.json")),
    ).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });
});

describe("initializePlugins", () => {
  it("returns ready outcomes when all init() calls are ready", async () => {
    const entries: PluginEntry[] = [
      {
        namespace: "a",
        plugin: {
          init: async (): Promise<PluginInitResult> => ({ type: "ready" }),
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    await expect(initializePlugins(entries, () => makeRuntimeContext())).resolves.toEqual([
      {
        entry: entries[0],
        result: { type: "ready" },
      },
    ]);
  });

  it("passes runtime warn/error to plugin init", async () => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const entries: PluginEntry[] = [
      {
        namespace: "runtime-test",
        plugin: {
          init: async (runtime) => {
            runtime.warn("warn message");
            runtime.error("error message");
            return { type: "ready" };
          },
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    const results = await initializePlugins(entries, () =>
      makeRuntimeContext({
        warn(message) {
          warnings.push(message);
        },
        error(message) {
          errors.push(message);
        },
      }),
    );

    expect(results).toEqual([
      {
        entry: entries[0],
        result: { type: "ready" },
      },
    ]);
    expect(warnings).toEqual(["warn message"]);
    expect(errors).toEqual(["error message"]);
  });

  it("returns fatal outcome when init returns fatal", async () => {
    const entries: PluginEntry[] = [
      {
        namespace: "bad",
        plugin: {
          init: async (): Promise<PluginInitResult> => ({ type: "fatal", message: "init failed" }),
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    await expect(initializePlugins(entries, () => makeRuntimeContext())).resolves.toEqual([
      {
        entry: entries[0],
        result: { type: "fatal", message: "init failed" },
      },
    ]);
  });

  it("returns fatal outcome when init throws", async () => {
    const entries: PluginEntry[] = [
      {
        namespace: "thrower",
        plugin: {
          init: async () => {
            throw new Error("boom");
          },
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    await expect(initializePlugins(entries, () => makeRuntimeContext())).resolves.toEqual([
      {
        entry: entries[0],
        result: { type: "fatal", message: "boom" },
      },
    ]);
  });
});

describe("checkPluginCompatibility", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-compat-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeEntry(namespace: string): PluginEntry {
    return {
      namespace: namespace as PluginEntry["namespace"],
      plugin: {
        init: async () => ({ type: "ready" }),
        project: async () => ({ type: "success", data: {} }),
      },
      failurePolicy: "skip-fact",
    };
  }

  it("emits no warning when range is satisfied", async () => {
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-plugin", peerDependencies: { gitlode: ">=0.0.0" } }),
    );

    const warnings: string[] = [];
    await checkPluginCompatibility(
      [makeEntry("test-plugin")],
      makeExtensions(),
      join(tmpDir, "gitlode.config.json"),
      {
        warn(message) {
          warnings.push(message);
        },
      },
    );

    expect(warnings).toEqual([]);
  });

  it("emits mismatch warning when range is not satisfied", async () => {
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-plugin", peerDependencies: { gitlode: ">=999.0.0" } }),
    );

    const warnings: string[] = [];
    await checkPluginCompatibility(
      [makeEntry("test-plugin")],
      makeExtensions(),
      join(tmpDir, "gitlode.config.json"),
      {
        warn(message) {
          warnings.push(message);
        },
      },
    );

    expect(warnings.join("\n")).toMatch(/declares peer gitlode/);
  });

  it("emits compatibility unknown warning when peerDependencies.gitlode is absent", async () => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ name: "test-plugin" }));

    const warnings: string[] = [];
    await checkPluginCompatibility(
      [makeEntry("test-plugin")],
      makeExtensions(),
      join(tmpDir, "gitlode.config.json"),
      {
        warn(message) {
          warnings.push(message);
        },
      },
    );

    expect(warnings.join("\n")).toMatch(/does not declare peerDependencies\.gitlode/);
  });

  it("emits skipped warning when package metadata cannot be read", async () => {
    await writeFile(join(tmpDir, "package.json"), "NOT VALID JSON {{{");

    const warnings: string[] = [];
    await checkPluginCompatibility(
      [makeEntry("test-plugin")],
      makeExtensions(),
      join(tmpDir, "gitlode.config.json"),
      {
        warn(message) {
          warnings.push(message);
        },
      },
    );

    expect(warnings.join("\n")).toMatch(/compatibility check skipped/);
  });

  it("supports empty entries when config has no extensions", async () => {
    const warnings: string[] = [];
    await checkPluginCompatibility(
      [],
      {} as ConfigExtensionsSection,
      join(tmpDir, "gitlode.config.json"),
      {
        warn(message) {
          warnings.push(message);
        },
      },
    );
    expect(warnings).toEqual([]);
  });
});
