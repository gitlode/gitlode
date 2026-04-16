import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Extractor } from "../../src/core/extractor.js";
import type { ExtractorConfig, Reporter, StateFile, StateStore } from "../../src/core/index.js";
import { GitAdapterError } from "../../src/git/index.js";
import { IsomorphicGitAdapter } from "../../src/git/isomorphic-git-adapter.js";
import type { OutputCommit } from "../../src/output/index.js";

const AUTHOR = {
  name: "Tester",
  email: "test@example.com",
  timestamp: 1_000_000,
  timezoneOffset: 0,
};

/** Creates an in-memory Git repo with a helper to make commits. */
function makeRepo(remoteUrl?: string) {
  const vol = new Volume();
  const fs = createFsFromVolume(vol);

  async function init() {
    await git.init({ fs, dir: "/", defaultBranch: "main" });
    await git.setConfig({ fs, dir: "/", path: "user.name", value: "Tester" });
    await git.setConfig({
      fs,
      dir: "/",
      path: "user.email",
      value: "test@example.com",
    });
    if (remoteUrl) {
      await git.setConfig({
        fs,
        dir: "/",
        path: "remote.origin.url",
        value: remoteUrl,
      });
    }
  }

  async function addCommit(
    filename: string,
    content: string,
    message: string,
    timestamp = AUTHOR.timestamp,
  ): Promise<string> {
    fs.mkdirSync("/", { recursive: true });
    fs.writeFileSync(`/${filename}`, content);
    await git.add({ fs, dir: "/", filepath: filename });
    return git.commit({
      fs,
      dir: "/",
      message,
      author: { ...AUTHOR, timestamp },
    });
  }

  async function createBranch(name: string, fromHash: string) {
    await git.writeRef({
      fs,
      dir: "/",
      ref: `refs/heads/${name}`,
      value: fromHash,
    });
  }

  return { fs, init, addCommit, createBranch };
}

function makeConfig(
  overrides: Partial<ExtractorConfig> & { outputDir: string; adapter?: never },
): ExtractorConfig {
  return {
    repositoryPath: "/",
    branches: ["main"],
    outputPrefix: "repo",
    rotation: {},
    mode: "snapshot",
    ...overrides,
  };
}

/** Creates a silent Reporter that records all calls for inspection. */
function makeReporter(): Reporter & {
  warnings: string[];
  progressCalls: number[];
  doneCalls: number[];
} {
  const warnings: string[] = [];
  const progressCalls: number[] = [];
  const doneCalls: number[] = [];
  return {
    warnings,
    progressCalls,
    doneCalls,
    warn(message) {
      warnings.push(message);
    },
    progress(n) {
      progressCalls.push(n);
    },
    done(n) {
      doneCalls.push(n);
    },
  };
}

/** A StateStore backed by real files for integration-style tests. */
function makeFileStateStore(stateFilePath: string): StateStore {
  return {
    async read() {
      try {
        const raw = await readFile(stateFilePath, "utf8");
        return JSON.parse(raw) as StateFile;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async write(state) {
      const tmpPath = `${stateFilePath}.tmp`;
      await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
      await rename(tmpPath, stateFilePath);
    },
  };
}

/** Constructs an Extractor with default no-op stubs for injected dependencies. */
function makeExtractor(
  config: ExtractorConfig,
  adapter: IsomorphicGitAdapter,
  overrides: { reporter?: Reporter; stateStore?: StateStore } = {},
): Extractor {
  const stateStore =
    overrides.stateStore !== undefined
      ? overrides.stateStore
      : config.stateFilePath
        ? makeFileStateStore(config.stateFilePath)
        : undefined;
  return new Extractor(
    config,
    adapter,
    overrides.reporter ?? makeReporter(),
    () => new Date(),
    () => 0,
    stateStore,
  );
}

async function readJsonlFile(filePath: string): Promise<OutputCommit[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutputCommit);
}

/** Returns sorted absolute paths of all .jsonl files in a directory. */
async function findJsonlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries
    .filter((e) => e.endsWith(".jsonl"))
    .sort()
    .map((e) => join(dir, e));
}

/** Reads all commits from the first .jsonl file found in a directory. */
async function readFirstJsonlFile(dir: string): Promise<OutputCommit[]> {
  const files = await findJsonlFiles(dir);
  if (files.length === 0) throw new Error(`No .jsonl files found in ${dir}`);
  return readJsonlFile(files[0]!);
}

describe("Extractor", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("full extraction: writes all commits to output JSONL with correct fields", async () => {
    const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
    await init();
    const sha1 = await addCommit("a.txt", "v1", "first commit", 1000);
    const sha2 = await addCommit("a.txt", "v2", "second commit", 2000);
    const sha3 = await addCommit("a.txt", "v3", "third commit", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({ outputDir: tmpDir });
    const extractor = makeExtractor(config, adapter);
    await extractor.run();

    const commits = await readFirstJsonlFile(tmpDir);
    expect(commits).toHaveLength(3);

    const oids = commits.map((c) => c.oid);
    expect(oids).toContain(sha1);
    expect(oids).toContain(sha2);
    expect(oids).toContain(sha3);

    // All commits should have correct repository fields
    for (const commit of commits) {
      expect(commit.repository.name).toBe("my-repo");
      expect(commit.repository.url).toBe("https://github.com/org/my-repo.git");
    }

    // Verify each line is valid JSON (readJsonlFile already does this via JSON.parse)
    const [firstFile] = await findJsonlFiles(tmpDir);
    const raw = await readFile(firstFile!, "utf8");
    expect(raw).not.toContain("\r\n");
    const lines = raw.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
  });

  it("cross-branch deduplication: shared commits appear exactly once", async () => {
    const { fs, init, addCommit, createBranch } = makeRepo();
    await init();

    // Common history
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);

    // Branch 'develop' at sha2, then main gets sha3
    await createBranch("develop", sha2);
    const sha3 = await addCommit("a.txt", "v3", "commit 3 (main only)", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({
      outputDir: tmpDir,
      branches: ["main", "develop"],
    });
    const extractor = makeExtractor(config, adapter);
    await extractor.run();

    const commits = await readFirstJsonlFile(tmpDir);

    // sha1 and sha2 are shared; sha3 is main-only
    const oids = commits.map((c) => c.oid);
    expect(oids.filter((o) => o === sha1)).toHaveLength(1); // appears exactly once
    expect(oids.filter((o) => o === sha2)).toHaveLength(1); // appears exactly once
    expect(oids).toContain(sha3);
    expect(commits).toHaveLength(3); // sha1, sha2, sha3 — no duplicates
  });

  it("--since-date: includes commits after the date, skips commits at or before", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();

    await addCommit("a.txt", "v1", "old commit", 1000); // Jan 1970
    await addCommit("a.txt", "v2", "cutoff commit", 5000); // at cutoff
    const sha3 = await addCommit("a.txt", "v3", "new commit", 10000); // after cutoff

    // since = Unix timestamp 5000s = 5000 * 1000 ms
    const since = new Date(5000 * 1000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({
      outputDir: tmpDir,
      range: { type: "date", since },
    });
    const extractor = makeExtractor(config, adapter);
    await extractor.run();

    const commits = await readFirstJsonlFile(tmpDir);
    const oids = commits.map((c) => c.oid);
    expect(oids).toContain(sha3); // strictly after cutoff
    expect(oids).toHaveLength(1); // only sha3 passes the filter
  });

  it("--since-ref: only commits newer than the given ref hash are written", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();

    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({
      outputDir: tmpDir,
      range: { type: "ref", ref: sha1 },
    });
    const extractor = makeExtractor(config, adapter);
    await extractor.run();

    const commits = await readFirstJsonlFile(tmpDir);
    const oids = commits.map((c) => c.oid);
    expect(oids).not.toContain(sha1); // excluded
    expect(oids).toContain(sha2);
    expect(oids).toContain(sha3);
    expect(commits).toHaveLength(2);
  });

  it("state file round-trip: second run with same state file produces no output", async () => {
    const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
    await init();

    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    // First run — snapshot mode writes state file
    const config1 = makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" });
    await makeExtractor(config1, adapter).run();

    const firstCommits = await readFirstJsonlFile(tmpDir);
    expect(firstCommits).toHaveLength(2);

    // Verify state file was written with absolute repositoryPath
    const stateRaw = await readFile(stateFilePath, "utf8");
    const stateFile = JSON.parse(stateRaw) as StateFile;
    expect(stateFile.version).toBe(1);
    expect(stateFile.repositoryPath).toBe(resolve("/"));
    expect(stateFile.branches).toHaveLength(1);
    expect(stateFile.branches[0]!.name).toBe("main");

    // Second run in incremental mode with same state — no new commits → output file should have 0 commits
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      const config2 = makeConfig({ outputDir: tmpDir2, stateFilePath, mode: "incremental" });
      await makeExtractor(config2, adapter).run();

      // No commits to write — no output file created (writer.seq stays 0)
      const jsonlFiles = await findJsonlFiles(tmpDir2);
      expect(jsonlFiles).toHaveLength(0);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("state file — different repository: throws expected error", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);

    // Write a state file that references a different repository path
    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const fakeState: StateFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      repositoryPath: "/some/other/repo",
      branches: [{ name: "main", lastCommitHash: "a".repeat(40) }],
    };
    await writeFile(stateFilePath, JSON.stringify(fakeState), "utf8");

    const adapter = new IsomorphicGitAdapter(fs);
    // Config uses repositoryPath "/" (resolves to root), state says "/some/other/repo"
    const config = makeConfig({ outputDir: tmpDir, stateFilePath, mode: "incremental" });
    const extractor = makeExtractor(config, adapter);

    await expect(extractor.run()).rejects.toThrow(
      "State file was created for a different repository: /some/other/repo",
    );
  });

  it("returns ExtractionResult with correct metrics after a successful run", async () => {
    const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);
    await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({ outputDir: tmpDir });
    const extractor = makeExtractor(config, adapter);
    const result = await extractor.run();

    expect(result.commitsWritten).toBe(3);
    expect(result.filesCreated).toBe(1);
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.branches).toEqual(["main"]);
  });

  it("returns ExtractionResult with filesCreated=2 when rotation splits output", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);
    await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({ outputDir: tmpDir, rotation: { maxLines: 2 } });
    const extractor = makeExtractor(config, adapter);
    const result = await extractor.run();

    expect(result.commitsWritten).toBe(3);
    expect(result.filesCreated).toBe(2);
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(result.branches).toEqual(["main"]);
  });

  it("returns ExtractionResult with commitsWritten=0 when no new commits exist", async () => {
    const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" }),
      adapter,
    ).run();

    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      const result = await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, mode: "incremental" }),
        adapter,
      ).run();
      expect(result.commitsWritten).toBe(0);
      expect(result.filesCreated).toBe(0);
      expect(result.bytesWritten).toBe(0);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("file rotation integration: maxLines: 2 creates multiple output files", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();

    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);
    await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({
      outputDir: tmpDir,
      rotation: { maxLines: 2 },
    });
    const extractor = makeExtractor(config, adapter);
    await extractor.run();

    const [file1path, file2path] = await findJsonlFiles(tmpDir);
    const file1 = await readJsonlFile(file1path!);
    const file2 = await readJsonlFile(file2path!);

    expect(file1).toHaveLength(2);
    expect(file2).toHaveLength(1);

    // Combined, all 3 commits are present
    const allOids = [...file1, ...file2].map((c) => c.oid);
    expect(allOids).toHaveLength(3);
    expect(new Set(allOids).size).toBe(3); // no duplicates
  });

  it("snapshot mode ignores state file content and performs full extraction", async () => {
    const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
    await init();

    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    // First run (snapshot) — records state
    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" }),
      adapter,
    ).run();

    // Second run in snapshot mode — state content is ignored, all commits extracted again
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, mode: "snapshot" }),
        adapter,
      ).run();

      const commits = await readFirstJsonlFile(tmpDir2);
      const oids = commits.map((c) => c.oid);
      // Snapshot mode should return all commits regardless of state
      expect(oids).toContain(sha1);
      expect(oids).toContain(sha2);
      expect(commits).toHaveLength(2);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("incremental mode reads state and performs differential extraction", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();

    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    // First run (snapshot) — records state
    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" }),
      adapter,
    ).run();

    // Add a new commit after the state was recorded
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    // Second run in incremental mode — should only get the new commit
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, mode: "incremental" }),
        adapter,
      ).run();

      const commits = await readFirstJsonlFile(tmpDir2);
      const oids = commits.map((c) => c.oid);
      expect(oids).toContain(sha3);
      expect(commits).toHaveLength(1);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("--on-missing-state snapshot: emits warning and performs full traversal when state file absent", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();

    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);

    const missingStatePath = join(tmpDir, "nonexistent-state.json");
    const adapter = new IsomorphicGitAdapter(fs);
    const reporter = makeReporter();

    const result = await makeExtractor(
      makeConfig({
        outputDir: tmpDir,
        stateFilePath: missingStatePath,
        mode: "incremental",
        onMissingState: "snapshot",
      }),
      adapter,
      { reporter },
    ).run();

    // All commits extracted (full traversal)
    expect(result.commitsWritten).toBe(2);
    const commits = await readFirstJsonlFile(tmpDir);
    const oids = commits.map((c) => c.oid);
    expect(oids).toContain(sha1);
    expect(oids).toContain(sha2);

    // Warning was emitted via reporter.warn
    const warningMsg = reporter.warnings.find((w) => w.includes("State file not found"));
    expect(warningMsg).toBeDefined();
  });

  it("reporter.warn: called when a branch does not exist in the repository", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);

    const adapter = new IsomorphicGitAdapter(fs);
    const reporter = makeReporter();

    const result = await makeExtractor(
      makeConfig({ outputDir: tmpDir, branches: ["main", "nonexistent-branch"] }),
      adapter,
      { reporter },
    ).run();

    // Only commits from main are extracted; the missing branch is skipped
    expect(result.commitsWritten).toBe(1);
    const warning = reporter.warnings.find((w) => w.includes("nonexistent-branch"));
    expect(warning).toBeDefined();
    expect(warning).toContain("no longer exists in the repository");
  });

  it("reporter.warn: called on COMMIT_NOT_FOUND fallback", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);

    // Build an adapter that throws COMMIT_NOT_FOUND when excludeHash is provided
    const realAdapter = new IsomorphicGitAdapter(fs);
    const mockAdapter = {
      resolveRef: realAdapter.resolveRef.bind(realAdapter),
      getRemoteUrl: realAdapter.getRemoteUrl.bind(realAdapter),
      async *walkCommits(repoPath: string, head: string, excludeHash?: string) {
        if (excludeHash !== undefined) {
          throw new GitAdapterError(`Commit not found: ${excludeHash}`, "COMMIT_NOT_FOUND");
        }
        yield* realAdapter.walkCommits(repoPath, head, undefined);
      },
    };

    const reporter = makeReporter();

    // Use a stale state entry so excludeHash is provided, triggering COMMIT_NOT_FOUND
    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const fakeState: StateFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      repositoryPath: "/",
      branches: [{ name: "main", lastCommitHash: sha1 }],
    };
    await writeFile(stateFilePath, JSON.stringify(fakeState), "utf8");

    const result = await new Extractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "incremental" }),
      mockAdapter as unknown as IsomorphicGitAdapter,
      reporter,
      () => new Date(),
      () => 0,
      makeFileStateStore(stateFilePath),
    ).run();

    // Full fallback extraction ran — all commits written
    expect(result.commitsWritten).toBe(2);
    const warning = reporter.warnings.find((w) => w.includes("no longer exists"));
    expect(warning).toBeDefined();
    expect(warning).toContain("Falling back to full extraction");
  });

  it("reporter.done: always called in finally block after successful run", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);

    const adapter = new IsomorphicGitAdapter(fs);
    const reporter = makeReporter();

    await makeExtractor(makeConfig({ outputDir: tmpDir }), adapter, { reporter }).run();

    expect(reporter.doneCalls).toHaveLength(1);
    expect(reporter.doneCalls[0]).toBe(2);
  });

  it("isCommitHash guard: rejects invalid lastCommitHash in state file with a clear error", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    // Write a state file with a deliberately invalid hash to exercise the runtime guard
    await writeFile(
      stateFilePath,
      JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        repositoryPath: resolve("/"),
        branches: [{ name: "main", lastCommitHash: "not-a-hash" }],
      }),
      "utf8",
    );

    const adapter = new IsomorphicGitAdapter(fs);
    const config = makeConfig({ outputDir: tmpDir, stateFilePath, mode: "incremental" });
    const extractor = makeExtractor(config, adapter);

    await expect(extractor.run()).rejects.toThrow(
      'Invalid commit hash in state file for branch "main"',
    );
  });
});
