import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadConfigFile } from "../../src/config/index.js";

describe("loadConfigFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "gitlode-config-loader-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("loads a valid version:1 config", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extraction: { refs: ["main"] },
        output: { directory: "./out", prefix: "custom" },
        runtime: { profile: true, gitAdapter: "isomorphic-git" },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      throw new Error("Expected success result");
    }

    expect(result.value.version).toBe(1);
    expect(result.value.output?.directory).toBe(resolve(tmpDir, "out"));
    expect(result.value.runtime?.gitAdapter).toBe("isomorphic-git");
  });

  it("accepts git-cli as a runtime gitAdapter value", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        runtime: { gitAdapter: "git-cli" },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      throw new Error("Expected success result");
    }

    expect(result.value.runtime?.gitAdapter).toBe("git-cli");
  });

  it("rejects unknown runtime gitAdapter values", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        runtime: { gitAdapter: "cli" },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result).toEqual(expect.objectContaining({ kind: "user-error" }));
  });

  it("rejects unknown top-level keys", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        unknown: true,
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result).toEqual(expect.objectContaining({ kind: "user-error" }));
  });

  it("rejects unknown nested keys", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        output: {
          directory: "./out",
          unknownNested: true,
        },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result).toEqual(expect.objectContaining({ kind: "user-error" }));
  });

  it("rejects extraction.range with both sinceRef and sinceDate", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extraction: {
          refs: ["main"],
          range: { sinceRef: "v1.0", sinceDate: "2024-01-01T00:00:00Z" },
        },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result).toEqual(expect.objectContaining({ kind: "user-error" }));
  });

  it("rebases relative output.directory and extensions entrypoint from config directory", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        output: { directory: "./out" },
        extensions: {
          "sample-plugin": {
            entrypoint: "./plugins/sample.mjs",
          },
        },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      throw new Error("Expected success result");
    }

    expect(result.value.output?.directory).toBe(resolve(tmpDir, "out"));
    expect(result.value.extensions?.["sample-plugin"]?.entrypoint).toBe(
      resolve(tmpDir, "plugins", "sample.mjs"),
    );
  });

  it("keeps bare-specifier plugin entrypoints unchanged", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extensions: {
          "sample-plugin": {
            entrypoint: "@gitlode/plugin-custom-field",
          },
        },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      throw new Error("Expected success result");
    }

    expect(result.value.extensions?.["sample-plugin"]?.entrypoint).toBe(
      "@gitlode/plugin-custom-field",
    );
  });

  it("allows config without extensions", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extraction: { refs: ["main"] },
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      throw new Error("Expected success result");
    }

    expect(result.value.extensions).toBeUndefined();
  });

  it("allows config with an empty extensions object", async () => {
    const configPath = join(tmpDir, "gitlode.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        extensions: {},
      }),
    );

    const result = await loadConfigFile(configPath);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      throw new Error("Expected success result");
    }

    expect(result.value.extensions).toEqual({});
  });
});
