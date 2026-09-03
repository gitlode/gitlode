import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../support/performance-fixtures.js";
import { runRepositorySidecarForTest } from "../support/repository-sidecar-runner.js";

const cli = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

describe("repository profile sidecar", () => {
  it("collects an isomorphic-git commit fixture outside the timed CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-sidecar-test-"));
    try {
      await createPerformanceRepository(root, "commit_heavy_repository", {
        commits: 5,
        files: 1,
        plugins: 0,
        rotations: 1,
        scale: 0,
      });
      const config = join(root, "config.json");
      await writeFile(
        config,
        JSON.stringify({ version: 1, runtime: { gitAdapter: "isomorphic-git" } }),
      );
      const result = await runRepositorySidecarForTest({
        cli,
        repository: root,
        config,
        adapter: "isomorphic-git",
      });
      expect(result.result.kind).toBe("success");
      expect(result.result.success?.profileReport).toMatchObject({
        schemaVersion: 1,
        diagnostics: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("collects a git-cli file fixture with the same adapter contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-sidecar-test-"));
    try {
      await createPerformanceRepository(root, "file_heavy_repository", {
        commits: 5,
        files: 2,
        plugins: 0,
        rotations: 1,
        scale: 0,
      });
      const config = join(root, "config.json");
      await writeFile(config, JSON.stringify({ version: 1, runtime: { gitAdapter: "git-cli" } }));
      const result = await runRepositorySidecarForTest({
        cli,
        repository: root,
        config,
        adapter: "git-cli",
        fileFixture: true,
        rotationLines: 2,
      });
      expect(result.result.kind).toBe("success");
      expect(result.result.success?.profileReport).toMatchObject({ schemaVersion: 1 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("collects plugin-heavy fixture reports without changing application outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-sidecar-test-"));
    try {
      await createPerformanceRepository(root, "file_heavy_repository", {
        commits: 5,
        files: 1,
        plugins: 2,
        rotations: 1,
        scale: 0,
      });
      const fixture = await createPluginProjectionFixture(root, {
        commits: 5,
        files: 1,
        plugins: 2,
        rotations: 1,
        scale: 0,
      });
      const result = await runRepositorySidecarForTest({
        cli,
        repository: root,
        config: fixture.configPath,
        adapter: "isomorphic-git",
        fileFixture: true,
      });
      expect(result.result.kind).toBe("success");
      expect(result.result.success?.profileReport).toMatchObject({ schemaVersion: 1 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
