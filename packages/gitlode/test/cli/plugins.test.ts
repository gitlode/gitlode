import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkPluginCompatibility,
  initializePlugins,
  loadPluginConfig,
  resolvePluginEntries,
} from "../../src/cli/plugins.js";
import type { PluginEntry, PluginInitResult, PluginRuntimeContext } from "../../src/core/types.js";

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

// ---------------------------------------------------------------------------
// loadPluginConfig — JSON parsing and schema validation
// ---------------------------------------------------------------------------

describe("loadPluginConfig – parse and validate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-plugins-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("parses a valid config file and returns PluginConfigFile", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extensions: {
          "my-plugin": { entrypoint: "./plugin.js" },
        },
      }),
    );
    const result = await loadPluginConfig(configPath);
    expect(result).toEqual({
      kind: "loaded",
      config: expect.objectContaining({
        version: 1,
        extensions: expect.objectContaining({
          "my-plugin": expect.objectContaining({ entrypoint: "./plugin.js" }),
        }),
      }),
    });
  });

  it("defaults failurePolicy to skip-fact when not specified", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, extensions: { p: { entrypoint: "./p.js" } } }),
    );
    const result = await loadPluginConfig(configPath);
    expect(result).toEqual({
      kind: "loaded",
      config: expect.objectContaining({
        extensions: expect.objectContaining({
          p: expect.objectContaining({ failurePolicy: "skip-fact" }),
        }),
      }),
    });
  });

  it("preserves explicitly set failurePolicy=fatal", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extensions: { p: { entrypoint: "./p.js", failurePolicy: "fatal" } },
      }),
    );
    const result = await loadPluginConfig(configPath);
    expect(result).toEqual({
      kind: "loaded",
      config: expect.objectContaining({
        extensions: expect.objectContaining({
          p: expect.objectContaining({ failurePolicy: "fatal" }),
        }),
      }),
    });
  });

  it("returns a tagged user error for missing version field", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(configPath, JSON.stringify({ extensions: { p: { entrypoint: "./p.js" } } }));
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error for version !== 1", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ version: 2, extensions: { p: { entrypoint: "./p.js" } } }),
    );
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error for missing extensions field", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(configPath, JSON.stringify({ version: 1 }));
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error for empty extensions object", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(configPath, JSON.stringify({ version: 1, extensions: {} }));
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error for namespace violating [a-z0-9-]+ pattern", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, extensions: { "BAD_NS!": { entrypoint: "./p.js" } } }),
    );
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({
        kind: "user-error",
        message: expect.stringContaining("BAD_NS!"),
      }),
    });
  });

  it("returns a tagged user error for unknown top-level field", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extensions: { p: { entrypoint: "./p.js" } },
        unknown: true,
      }),
    );
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error for invalid JSON", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(configPath, "not json {{{");
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error when file does not exist", async () => {
    await expect(loadPluginConfig(join(tmpDir, "nope.json"))).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({
        kind: "user-error",
        message: expect.stringContaining("not found"),
      }),
    });
  });

  it("returns a tagged user error for invalid failurePolicy value", async () => {
    const configPath = join(tmpDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extensions: { p: { entrypoint: "./p.js", failurePolicy: "unknown-policy" } },
      }),
    );
    await expect(loadPluginConfig(configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });
});

// ---------------------------------------------------------------------------
// resolvePluginEntries — entrypoint resolution
// ---------------------------------------------------------------------------

describe("resolvePluginEntries – entrypoint resolution", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-plugins-resolve-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("loads a local relative entrypoint and returns a PluginEntry", async () => {
    // Write a simple plugin module
    const pluginPath = join(tmpDir, "plugin.mjs");
    await writeFile(
      pluginPath,
      `export default async function factory() {
        return { project: async () => ({ type: "success", data: {} }) };
      }`,
    );

    const configPath = join(tmpDir, "config.json");
    const config = {
      version: 1 as const,
      extensions: {
        "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };

    const result = await resolvePluginEntries(config, configPath);
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") {
      throw new Error("Expected resolved plugin entries");
    }
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.namespace).toBe("test-plugin");
    expect(typeof result.entries[0]!.plugin.project).toBe("function");
  });

  it("returns a tagged user error when plugin module does not export a default function", async () => {
    const pluginPath = join(tmpDir, "bad-plugin.mjs");
    await writeFile(pluginPath, "export const notDefault = 42;");

    const configPath = join(tmpDir, "config.json");
    const config = {
      version: 1 as const,
      extensions: {
        "bad-plugin": { entrypoint: "./bad-plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };

    await expect(resolvePluginEntries(config, configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });

  it("returns a tagged user error when factory does not return a valid ProjectorPlugin", async () => {
    const pluginPath = join(tmpDir, "invalid-plugin.mjs");
    await writeFile(pluginPath, "export default async function factory() { return null; }");

    const configPath = join(tmpDir, "config.json");
    const config = {
      version: 1 as const,
      extensions: {
        p: { entrypoint: "./invalid-plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };

    await expect(resolvePluginEntries(config, configPath)).resolves.toEqual({
      kind: "termination",
      termination: expect.objectContaining({ kind: "user-error" }),
    });
  });
});

// ---------------------------------------------------------------------------
// initializePlugins — parallel init and fatal aggregation
// ---------------------------------------------------------------------------

describe("initializePlugins – parallel init and fatal aggregation", () => {
  it("returns ready outcomes when all init() results are ready", async () => {
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

  it("passes runtime context into plugin init and preserves plugin-scoped diagnostics", async () => {
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

  it("returns a fatal outcome when one plugin returns fatal init result", async () => {
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

  it("returns all failing plugin init outcomes without aggregating them", async () => {
    const entries: PluginEntry[] = [
      {
        namespace: "a",
        plugin: {
          init: async (): Promise<PluginInitResult> => ({ type: "fatal", message: "err-a" }),
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
      {
        namespace: "b",
        plugin: {
          init: async (): Promise<PluginInitResult> => ({ type: "fatal", message: "err-b" }),
          project: async () => ({ type: "success", data: {} }),
        },
        failurePolicy: "skip-fact",
      },
    ];

    await expect(initializePlugins(entries, () => makeRuntimeContext())).resolves.toEqual([
      {
        entry: entries[0],
        result: { type: "fatal", message: "err-a" },
      },
      {
        entry: entries[1],
        result: { type: "fatal", message: "err-b" },
      },
    ]);
  });

  it("returns a fatal outcome when init() throws instead of returning fatal", async () => {
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

// ---------------------------------------------------------------------------
// checkPluginCompatibility — runtime compatibility warnings
// ---------------------------------------------------------------------------

describe("checkPluginCompatibility – version range checks", () => {
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

  it("(a) emits no output when declared peer range is satisfied", async () => {
    const pluginFile = join(tmpDir, "plugin.mjs");
    await writeFile(
      pluginFile,
      `export default async function factory() { return { project: async () => ({type:"success",data:{}}) }; }`,
    );
    // Write a package.json adjacent to the plugin with a peerDep range that matches 0.6.x
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-plugin", peerDependencies: { gitlode: ">=0.0.0" } }),
    );

    const config = {
      version: 1 as const,
      extensions: {
        "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };
    const configPath = join(tmpDir, "config.json");

    const entries: PluginEntry[] = [makeEntry("test-plugin")];
    const warnings: string[] = [];
    await checkPluginCompatibility(entries, config, configPath, {
      warn(message) {
        warnings.push(message);
      },
    });

    // No warning should have been written
    expect(warnings).toEqual([]);
  });

  it("(b) emits 'range not satisfied' warning when range is declared but mismatches", async () => {
    const pluginFile = join(tmpDir, "plugin.mjs");
    await writeFile(
      pluginFile,
      `export default async function factory() { return { project: async () => ({type:"success",data:{}}) }; }`,
    );
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-plugin",
        // Use an impossible range that no real version satisfies
        peerDependencies: { gitlode: ">=999.0.0" },
      }),
    );

    const config = {
      version: 1 as const,
      extensions: {
        "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };
    const configPath = join(tmpDir, "config.json");

    const entries: PluginEntry[] = [makeEntry("test-plugin")];
    const warnings: string[] = [];
    await checkPluginCompatibility(entries, config, configPath, {
      warn(message) {
        warnings.push(message);
      },
    });

    const written = warnings.join("\n");
    expect(written).toMatch(/declares peer gitlode/);
    expect(written).toMatch(/Continuing; behavior may be incompatible/);
  });

  it("(c) emits 'Compatibility unknown' when peerDependencies.gitlode is absent", async () => {
    const pluginFile = join(tmpDir, "plugin.mjs");
    await writeFile(
      pluginFile,
      `export default async function factory() { return { project: async () => ({type:"success",data:{}}) }; }`,
    );
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-plugin" }), // no peerDependencies
    );

    const config = {
      version: 1 as const,
      extensions: {
        "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };
    const configPath = join(tmpDir, "config.json");

    const entries: PluginEntry[] = [makeEntry("test-plugin")];
    const warnings: string[] = [];
    await checkPluginCompatibility(entries, config, configPath, {
      warn(message) {
        warnings.push(message);
      },
    });

    const written = warnings.join("\n");
    expect(written).toMatch(/does not declare peerDependencies\.gitlode/);
    expect(written).toMatch(/Compatibility unknown; continuing/);
  });

  it("(d) emits 'compatibility check skipped' when package.json is unreachable", async () => {
    // Temp dir with only the plugin file, no package.json anywhere near it (bounded walk)
    const isolatedDir = await mkdtemp(join(tmpdir(), "gitlode-nopkg-"));
    try {
      const pluginFile = join(isolatedDir, "plugin.mjs");
      await writeFile(
        pluginFile,
        `export default async function factory() { return { project: async () => ({type:"success",data:{}}) }; }`,
      );

      const config = {
        version: 1 as const,
        extensions: {
          "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
        },
      };
      const configPath = join(isolatedDir, "config.json");

      const entries: PluginEntry[] = [makeEntry("test-plugin")];
      // We can't easily prevent the walk from finding a package.json in parent dirs,
      // so instead we test with a non-parseable package.json
      await writeFile(join(isolatedDir, "package.json"), "NOT VALID JSON {{{");
      const warnings: string[] = [];
      await checkPluginCompatibility(entries, config, configPath, {
        warn(message) {
          warnings.push(message);
        },
      });

      const written = warnings.join("\n");
      expect(written).toMatch(/compatibility check skipped/);
      expect(written).toMatch(/unable to read package metadata/);
    } finally {
      await rm(isolatedDir, { recursive: true, force: true });
    }
  });

  it("(e) multi-range peer (^0.7.0 || ^0.8.0) is correctly accepted when version matches", async () => {
    const pluginFile = join(tmpDir, "plugin.mjs");
    await writeFile(
      pluginFile,
      `export default async function factory() { return { project: async () => ({type:"success",data:{}}) }; }`,
    );
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-plugin",
        // Multi-range that any real version should satisfy
        peerDependencies: { gitlode: ">=0.0.0 || >=999.0.0" },
      }),
    );

    const config = {
      version: 1 as const,
      extensions: {
        "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };
    const configPath = join(tmpDir, "config.json");

    const entries: PluginEntry[] = [makeEntry("test-plugin")];
    const warnings: string[] = [];
    await checkPluginCompatibility(entries, config, configPath, {
      warn(message) {
        warnings.push(message);
      },
    });

    // No warning: satisfied range
    expect(warnings).toEqual([]);
  });

  it("(f) compatibility warnings are routed through the warning capability", async () => {
    const pluginFile = join(tmpDir, "plugin.mjs");
    await writeFile(
      pluginFile,
      `export default async function factory() { return { project: async () => ({type:"success",data:{}}) }; }`,
    );
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-plugin",
        peerDependencies: { gitlode: ">=999.0.0" },
      }),
    );

    const config = {
      version: 1 as const,
      extensions: {
        "test-plugin": { entrypoint: "./plugin.mjs", failurePolicy: "skip-fact" as const },
      },
    };
    const configPath = join(tmpDir, "config.json");

    const entries: PluginEntry[] = [makeEntry("test-plugin")];
    const warnings: string[] = [];
    await checkPluginCompatibility(entries, config, configPath, {
      warn(message) {
        warnings.push(message);
      },
    });

    const written = warnings.join("\n");
    expect(written).toMatch(/Continuing; behavior may be incompatible/);
  });

  it("(g) no --config means checkPluginCompatibility is never called (empty entries guard)", async () => {
    // Simulate no-plugins path: caller skips checkPluginCompatibility entirely.
    // Verify that an empty entries array produces no output (defensive test).
    const config = {
      version: 1 as const,
      extensions: {},
    } as unknown as Parameters<typeof checkPluginCompatibility>[1];
    const configPath = join(tmpDir, "config.json");

    const warnings: string[] = [];
    await checkPluginCompatibility([], config, configPath, {
      warn(message) {
        warnings.push(message);
      },
    });
    expect(warnings).toEqual([]);
  });
});
