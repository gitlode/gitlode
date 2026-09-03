import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runRepositoryProfileSidecar } from "../../scripts/telemetry-performance.js";
import {
  createPerformanceRepository,
  createPluginProjectionFixture,
} from "../support/performance-fixtures.js";

const cli = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
const workerEntryPath = fileURLToPath(
  new URL("../../dist/execution/worker-entry.js", import.meta.url),
);

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
      const result = await runRepositoryProfileSidecar({
        cli,
        workerEntryPath,
        runId: "test-isomorphic",
        repository: root,
        config,
        adapter: "isomorphic-git",
        fixture: "commit_heavy_repository",
        revision: "revision-isomorphic",
        recipeHash: "recipe-isomorphic",
        quantities: { commits: 5, files: 1, plugins: 0, rotations: 1, scale: 0 },
      });
      expect(result.provenance.workerBundleSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.provenance.configSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.status).toBe("available");
      expect(result.report).toMatchObject({
        schemaVersion: 1,
        diagnostics: [],
      });
      expect(result.provenance).toMatchObject({
        runId: "test-isomorphic",
        fixture: "commit_heavy_repository",
        adapter: "isomorphic-git",
        quantities: { commits: 5, files: 1, plugins: 0, rotations: 1, scale: 0 },
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
      const result = await runRepositoryProfileSidecar({
        cli,
        workerEntryPath,
        runId: "test-git-cli",
        repository: root,
        config,
        adapter: "git-cli",
        fixture: "file_heavy_repository",
        quantities: { commits: 5, files: 2, plugins: 0, rotations: 1, scale: 0 },
        revision: "revision-git-cli",
        recipeHash: "recipe-git-cli",
        rotationLines: 2,
      });
      expect(result.status).toBe("available");
      expect(result.report).toMatchObject({ schemaVersion: 1 });
      expect(result.provenance).toMatchObject({
        runId: "test-git-cli",
        fixture: "file_heavy_repository",
        adapter: "git-cli",
        quantities: { commits: 5, files: 2, plugins: 0, rotations: 1, scale: 0 },
        revision: "revision-git-cli",
        recipeHash: "recipe-git-cli",
      });
      expect(result.provenance.workerBundleSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.provenance.configSha256).toMatch(/^[0-9a-f]{64}$/);
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
      const result = await runRepositoryProfileSidecar({
        cli,
        workerEntryPath,
        runId: "test-plugin",
        repository: root,
        config: fixture.configPath,
        adapter: "isomorphic-git",
        fixture: "plugin_heavy_projection",
        quantities: { commits: 5, files: 1, plugins: 2, rotations: 1, scale: 0 },
        revision: "revision-plugin",
        recipeHash: "recipe-plugin",
      });
      expect(result.status).toBe("available");
      expect(result.report).toMatchObject({ schemaVersion: 1 });
      expect(result.provenance).toMatchObject({
        runId: "test-plugin",
        fixture: "plugin_heavy_projection",
        adapter: "isomorphic-git",
        quantities: { commits: 5, files: 1, plugins: 2, rotations: 1, scale: 0 },
        revision: "revision-plugin",
        recipeHash: "recipe-plugin",
      });
      expect(result.provenance.workerBundleSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.provenance.configSha256).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
