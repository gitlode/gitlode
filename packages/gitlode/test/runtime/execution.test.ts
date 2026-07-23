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

    const result = await executeWorkerRunRequest(
      request,
      {
        reporter: { emit(_event: ProgressEvent) {} },
        renderDiagnostic() {},
      },
      { environment: {} },
    );

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;

    const walkEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.walk_commits",
    );
    expect(walkEntry?.totalMs).toBeGreaterThan(0);
    expect(walkEntry?.attributes).toEqual({ strategy: ["certified-lazy"] });
    expect(walkEntry?.counters).toEqual({
      commit_reads: 1,
      commits_yielded: 1,
      materialize_commit_reads: 1,
      topology_commit_cache_hits: 1,
    });

    const traversalEntry = result.success.profileEntries.find(
      (entry) => entry.name === "dag.traversal",
    );
    expect(traversalEntry?.attributes).toEqual({ strategy: ["certifiedLazy"] });
    expect(traversalEntry?.counters).toEqual({
      main_expansions: 1,
      successor_expansions: 1,
      traversal_steps: 1,
      yielded_nodes: 1,
    });

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
    const fileBlobBatchEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.cli.file_blob_batch",
    );
    expect(fileBlobBatchEntry?.calls).toBe(1);
    expect(fileBlobBatchEntry?.counters).toEqual({ blob_bytes: 6, objects_read: 1 });
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

describe("executeWorkerRunRequest commit traversal strategy environment", () => {
  async function createOneCommitRequest(
    gitAdapter: "isomorphic-git" | "git-cli" = "isomorphic-git",
  ) {
    const repoDir = await makeTempDir("gitlode-execution-strategy-repo-");
    const outputDir = await makeTempDir("gitlode-execution-strategy-output-");

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
      author: { name: "Tester", email: "test@example.com", timestamp: 1_000, timezoneOffset: 0 },
    });

    return {
      input: {
        repositoryPath: repoDir as AbsolutePath,
        refs: ["main"],
        outputDir: outputDir as AbsolutePath,
        rotation: {},
        granularity: "commit" as const,
        profile: true,
        gitAdapter,
      },
      priorState: {
        version: 2 as const,
        generatedAt: "2026-01-01T00:00:00.000Z",
        repositoryPath: repoDir as AbsolutePath,
        refs: [],
      },
    } satisfies WorkerRunRequest;
  }

  async function runWithEnvironment(
    environment: Readonly<Record<string, string | undefined>>,
    gitAdapter: "isomorphic-git" | "git-cli" = "isomorphic-git",
  ) {
    return await executeWorkerRunRequest(
      await createOneCommitRequest(gitAdapter),
      { reporter: { emit(_event: ProgressEvent) {} }, renderDiagnostic() {} },
      { environment },
    );
  }

  it.each([
    [undefined, "certified-lazy", "certifiedLazy"],
    ["phase-certified-fifo", "phase-certified-fifo", "phaseCertified"],
    ["phase-certified-timestamp", "phase-certified-timestamp", "phaseCertified"],
  ] as const)("selects %s through injected environment", async (value, outer, inner) => {
    const environment = value === undefined ? {} : { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: value };
    const result = await runWithEnvironment(environment);

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    const walkEntry = result.success.profileEntries.find(
      (entry) => entry.name === "git.walk_commits",
    );
    const traversalEntry = result.success.profileEntries.find(
      (entry) => entry.name === "dag.traversal",
    );
    expect(walkEntry?.attributes?.strategy).toEqual([outer]);
    expect(traversalEntry?.attributes?.strategy).toEqual([inner]);
  });

  it("returns a user error for invalid isomorphic-git strategy environment", async () => {
    const result = await runWithEnvironment({ GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: "bad" });
    expect(result).toMatchObject({ kind: "user-error" });
    expect(result.kind === "user-error" ? result.message : "").toContain(
      "GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL",
    );
    expect(result.kind === "user-error" ? result.message : "").toContain("bad");
    expect(result.kind === "user-error" ? result.message : "").toContain("certified-lazy");
    expect(result.kind === "user-error" ? result.message : "").toContain("phase-certified-fifo");
    expect(result.kind === "user-error" ? result.message : "").toContain(
      "phase-certified-timestamp",
    );
  });

  it("ignores invalid strategy environment on the actual git-cli runtime path", async () => {
    const result = await runWithEnvironment(
      { GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL: "bad" },
      "git-cli",
    );

    expect(result.kind).toBe("success");
    if (result.kind !== "success") {
      expect(result.message).not.toContain("GITLODE_EXPERIMENTAL_COMMIT_TRAVERSAL");
      return;
    }

    const runEntry = result.success.profileEntries.find((entry) => entry.name === "gitlode.run");
    expect(runEntry?.attributes?.["git.adapter"]).toEqual(["git-cli"]);
    expect(result.success.profileEntries.some((entry) => entry.name === "git.cli.rev_list")).toBe(
      true,
    );
  });
});
