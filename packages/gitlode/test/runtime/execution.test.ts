import nodeFs from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as git from "isomorphic-git";
import { afterEach, describe, expect, it } from "vitest";

import type { ProgressEvent } from "../../src/core/index.js";
import { executeWorkerRunRequest } from "../../src/runtime/execution.js";
import type { WorkerRunRequest } from "../../src/runtime/types.js";
import type { AbsolutePath } from "../../src/support/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("executeWorkerRunRequest profiling", () => {
  it("includes git adapter walkCommits instrumentation in profile entries", async () => {
    const repoDir = await makeTempDir("gitlode-execution-repo-");
    const outputDir = await makeTempDir("gitlode-execution-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: {
        name: "Tester",
        email: "test@example.com",
        timestamp: 1_000,
        timezoneOffset: 0,
      },
    });

    const request: WorkerRunRequest = {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "commit",
        profile: true,
        gitAdapter: "isomorphic-git",
      },
      priorState: {
        version: 2,
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    };

    const result = await executeWorkerRunRequest(request, {
      reporter: { emit(_event: ProgressEvent) {} },
      renderDiagnostic() {},
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;

    const walkEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.walk_commits",
    );
    expect(walkEntry?.attributes?.strategy).toEqual(["eagerExclude"]);
    expect(walkEntry?.counters?.include_reads).toBeGreaterThan(0);

    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["isomorphic-git"]);
  });

  it("writes file-level records with the git-cli adapter selected", async () => {
    const repoDir = await makeTempDir("gitlode-execution-repo-");
    const outputDir = await makeTempDir("gitlode-execution-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: {
        name: "Tester",
        email: "test@example.com",
        timestamp: 1_000,
        timezoneOffset: 0,
      },
    });

    const request: WorkerRunRequest = {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "file",
        profile: true,
        gitAdapter: "git-cli",
      },
      priorState: {
        version: 2,
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    };

    const result = await executeWorkerRunRequest(request, {
      reporter: { emit(_event: ProgressEvent) {} },
      renderDiagnostic() {},
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.success.recordsWritten).toBe(1);
    expect(result.success.skippedDiffs).toBe(0);

    const [outputFile] = await readdir(outputDir);
    const output = await readFile(join(outputDir, outputFile!), "utf8");
    const record = JSON.parse(output.trim()) as {
      readonly file: {
        readonly path: string;
        readonly status: string;
        readonly additions: number;
        readonly deletions: number;
      };
    };
    expect(record.file).toEqual({
      path: "file.txt",
      status: "added",
      additions: 1,
      deletions: 0,
    });

    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["git-cli"]);
  });

  it("runs successfully with the git-cli adapter selected", async () => {
    const repoDir = await makeTempDir("gitlode-execution-repo-");
    const outputDir = await makeTempDir("gitlode-execution-output-");

    await git.init({ fs: nodeFs, dir: repoDir, defaultBranch: "main" });
    await git.setConfig({ fs: nodeFs, dir: repoDir, path: "user.name", value: "Tester" });
    await git.setConfig({
      fs: nodeFs,
      dir: repoDir,
      path: "user.email",
      value: "test@example.com",
    });
    await writeFile(join(repoDir, "file.txt"), "hello\n");
    await git.add({ fs: nodeFs, dir: repoDir, filepath: "file.txt" });
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: "initial",
      author: {
        name: "Tester",
        email: "test@example.com",
        timestamp: 1_000,
        timezoneOffset: 0,
      },
    });

    const request: WorkerRunRequest = {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "commit",
        profile: true,
        gitAdapter: "git-cli",
      },
      priorState: {
        version: 2,
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    };

    const result = await executeWorkerRunRequest(request, {
      reporter: { emit(_event: ProgressEvent) {} },
      renderDiagnostic() {},
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.success.commitsTraversed).toBe(1);

    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["git-cli"]);
    expect(runEntry?.attributes?.["git.cli.version"]?.[0]).toMatch(/^git version /);
  });
});
