import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Extractor } from "../../src/core/extractor.js";
import type {
  BranchCheckpoint,
  CheckpointStore,
  CommitFact,
  CommitHash,
  ExtractionCheckpoint,
  ExtractorConfig,
  FileChangeFact,
  Reporter,
  StateFile,
  StateStore,
  StateBranchEntry,
} from "../../src/core/index.js";
import { GitAdapterError } from "../../src/git/index.js";
import type { FileChange, GitAdapter, RawCommit } from "../../src/git/index.js";
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
    incremental: false,
    perFile: false,
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
    const config1 = makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false });
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
      const config2 = makeConfig({ outputDir: tmpDir2, stateFilePath, incremental: true });
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
    const config = makeConfig({ outputDir: tmpDir, stateFilePath, incremental: true });
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

    expect(result.recordsWritten).toBe(3);
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

    expect(result.recordsWritten).toBe(3);
    expect(result.filesCreated).toBe(2);
    expect(result.bytesWritten).toBeGreaterThan(0);
    expect(result.branches).toEqual(["main"]);
  });

  it("returns ExtractionResult with recordsWritten=0 when no new commits exist", async () => {
    const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
    await init();
    await addCommit("a.txt", "v1", "commit 1", 1000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
      adapter,
    ).run();

    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      const result = await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, incremental: true }),
        adapter,
      ).run();
      expect(result.recordsWritten).toBe(0);
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
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
      adapter,
    ).run();

    // Second run in snapshot mode — state content is ignored, all commits extracted again
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, incremental: false }),
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
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
      adapter,
    ).run();

    // Add a new commit after the state was recorded
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    // Second run in incremental mode — should only get the new commit
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, incremental: true }),
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
        incremental: true,
        missingState: "snapshot",
      }),
      adapter,
      { reporter },
    ).run();

    // All commits extracted (full traversal)
    expect(result.recordsWritten).toBe(2);
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
    expect(result.recordsWritten).toBe(1);
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
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: true }),
      mockAdapter as unknown as IsomorphicGitAdapter,
      reporter,
      () => new Date(),
      () => 0,
      makeFileStateStore(stateFilePath),
    ).run();

    // Full fallback extraction ran — all commits written
    expect(result.recordsWritten).toBe(2);
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
    const config = makeConfig({ outputDir: tmpDir, stateFilePath, incremental: true });
    const extractor = makeExtractor(config, adapter);

    await expect(extractor.run()).rejects.toThrow(
      'Invalid commit hash in state file for branch "main"',
    );
  });

  it("cross-run deduplication: new branch in incremental mode uses merge base as excludeHash", async () => {
    // sha1 → sha2 (main, recorded in state)
    //    ↓
    //   shaA → shaB  (feature branch, forked from sha1)
    const { fs, init, addCommit } = makeRepo();
    await init();

    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);

    // Feature branch: two commits forked from sha1
    const featureTree = (await git.readCommit({ fs, dir: "/", oid: sha1 })).commit.tree;
    const shaA = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: featureTree,
        parent: [sha1],
        message: "feature A\n",
        author: { ...AUTHOR, timestamp: 3000 },
        committer: { ...AUTHOR, timestamp: 3000 },
      },
    });
    const shaB = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: featureTree,
        parent: [shaA],
        message: "feature B\n",
        author: { ...AUTHOR, timestamp: 4000 },
        committer: { ...AUTHOR, timestamp: 4000 },
      },
    });
    await git.writeRef({ fs, dir: "/", ref: "refs/heads/feature", value: shaB });

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    // Run 1: snapshot — records state with main only
    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
      adapter,
    ).run();

    // Run 2: incremental with main + feature (feature is new)
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({
          outputDir: tmpDir2,
          stateFilePath,
          incremental: true,
          branches: ["main", "feature"],
        }),
        adapter,
      ).run();

      const files = await findJsonlFiles(tmpDir2);
      const allCommits = (await Promise.all(files.map(readJsonlFile))).flat();
      const oids = allCommits.map((c) => c.oid);

      // Feature-only commits above merge base should be present
      expect(oids).toContain(shaA);
      expect(oids).toContain(shaB);

      // sha1 and sha2 were already extracted in run 1 and must NOT appear again
      expect(oids).not.toContain(sha1);
      expect(oids).not.toContain(sha2);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("cross-run deduplication: new branch with no common ancestor falls back to full traversal", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("a.txt", "v1", "main commit", 1000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    // Run 1: snapshot — records state for main
    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
      adapter,
    ).run();

    // Create an orphan commit (no parent) — a fully detached history
    const mainHead = await adapter.resolveRef("/", "main");
    const mainTree = (await git.readCommit({ fs, dir: "/", oid: mainHead })).commit.tree;
    const orphanSha = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: mainTree,
        parent: [],
        message: "orphan commit\n",
        author: { ...AUTHOR, timestamp: 2000 },
        committer: { ...AUTHOR, timestamp: 2000 },
      },
    });
    await git.writeRef({ fs, dir: "/", ref: "refs/heads/orphan", value: orphanSha });

    // Run 2: incremental with main + orphan — no common ancestor, orphan gets full traversal
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({
          outputDir: tmpDir2,
          stateFilePath,
          incremental: true,
          branches: ["main", "orphan"],
        }),
        adapter,
      ).run();

      const files = await findJsonlFiles(tmpDir2);
      const allCommits = (await Promise.all(files.map(readJsonlFile))).flat();
      const oids = allCommits.map((c) => c.oid);

      // Orphan commit should appear (full traversal for orphan branch)
      expect(oids).toContain(orphanSha);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  it("cross-run deduplication: existing branches in incremental mode are unaffected by merge base logic", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();

    await addCommit("a.txt", "v1", "commit 1", 1000);
    await addCommit("a.txt", "v2", "commit 2", 2000);

    const stateFilePath = join(tmpDir, "gitrail-state.json");
    const adapter = new IsomorphicGitAdapter(fs);

    // Run 1: snapshot — records state
    await makeExtractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
      adapter,
    ).run();

    // Add a new commit to main
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    // Run 2: incremental with main only (no new branches added)
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await makeExtractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, incremental: true }),
        adapter,
      ).run();

      const commits = await readFirstJsonlFile(tmpDir2);
      const oids = commits.map((c) => c.oid);

      // Only the new commit should appear — merge base logic doesn't affect existing branches
      expect(oids).toContain(sha3);
      expect(commits).toHaveLength(1);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // --output-mode file
  // ---------------------------------------------------------------------------

  /**
   * Creates a minimal fake GitAdapter for file mode tests.
   * `fileChangeMap` maps commitOid → FileChange[]; commits are traversed in reverse order.
   */
  function makeFakeGitAdapter(
    commits: RawCommit[],
    fileChangeMap: Map<string, readonly FileChange[]>,
    remoteUrl: string | null = null,
  ): GitAdapter {
    const headOid = commits[commits.length - 1]!.oid;
    return {
      async resolveRef() {
        return headOid;
      },
      async *walkCommits(_repoPath, _head, excludeHash) {
        for (const commit of [...commits].reverse()) {
          if (commit.oid === excludeHash) break;
          yield commit;
        }
      },
      async getRemoteUrl() {
        return remoteUrl;
      },
      async findMergeBase() {
        return null;
      },
      async getFileChanges(_repoPath, commitOid) {
        return fileChangeMap.get(commitOid) ?? [];
      },
    };
  }

  function makeRawCommit(
    oid: string,
    message: string,
    parents: string[] = [],
    timestamp = 1000,
  ): RawCommit {
    return {
      oid: oid as CommitHash,
      message: `${message}\n`,
      author: { name: "Tester", email: "test@example.com", timestamp, timezoneOffset: 0 },
      committer: { name: "Tester", email: "test@example.com", timestamp, timezoneOffset: 0 },
      parents,
    };
  }

  describe("--output-mode file", () => {
    it("produces one record per changed file per commit", async () => {
      const sha1 = "a".repeat(40);
      const sha2 = "b".repeat(40);
      const commits = [
        makeRawCommit(sha1, "first commit", [], 1000),
        makeRawCommit(sha2, "second commit", [sha1], 2000),
      ];
      const fileChanges = new Map<string, readonly FileChange[]>([
        [sha1, [{ path: "a.txt", status: "added", additions: 5, deletions: 0 }]],
        [
          sha2,
          [
            { path: "a.txt", status: "modified", additions: 2, deletions: 1 },
            { path: "b.txt", status: "added", additions: 3, deletions: 0 },
          ],
        ],
      ]);
      const adapter = makeFakeGitAdapter(commits, fileChanges);
      const config = makeConfig({ outputDir: tmpDir, perFile: true });
      const result = await new Extractor(
        config,
        adapter,
        makeReporter(),
        () => new Date(),
        () => 0,
      ).run();

      // sha1 has 1 file change, sha2 has 2 → 3 total
      expect(result.recordsWritten).toBe(3);

      const rawContent = await readFile((await findJsonlFiles(tmpDir))[0]!, "utf8");
      const records = rawContent
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as OutputCommit & { file?: unknown });
      expect(records).toHaveLength(3);
      // Every record has a 'file' property
      for (const record of records) {
        expect(record.file).toBeDefined();
      }
      // Records from sha2 include both changed files
      const sha2Records = records.filter((r) => r.oid === sha2);
      expect(sha2Records).toHaveLength(2);
      const paths = sha2Records.map((r) => (r.file as { path: string }).path);
      expect(paths).toContain("a.txt");
      expect(paths).toContain("b.txt");
    });

    it("file record carries denormalized commit metadata", async () => {
      const sha1 = "a".repeat(40);
      const commits = [makeRawCommit(sha1, "first commit", [], 1000)];
      const fileChanges = new Map<string, readonly FileChange[]>([
        [sha1, [{ path: "readme.md", status: "added", additions: 10, deletions: 0 }]],
      ]);
      const adapter = makeFakeGitAdapter(commits, fileChanges, "https://github.com/org/repo.git");
      const config = makeConfig({ outputDir: tmpDir, perFile: true });
      await new Extractor(
        config,
        adapter,
        makeReporter(),
        () => new Date(),
        () => 0,
      ).run();

      const rawContent = await readFile((await findJsonlFiles(tmpDir))[0]!, "utf8");
      const record = JSON.parse(rawContent.trim()) as OutputCommit & {
        file: { path: string; status: string; additions: number; deletions: number };
      };
      // Commit fields are present
      expect(record.oid).toBe(sha1);
      expect(record.subject).toBe("first commit");
      expect(record.parents).toEqual([]);
      expect(record.repository.name).toBe("repo");
      expect(record.repository.url).toBe("https://github.com/org/repo.git");
      // File fields are present
      expect(record.file.path).toBe("readme.md");
      expect(record.file.status).toBe("added");
      expect(record.file.additions).toBe(10);
      expect(record.file.deletions).toBe(0);
    });

    it("empty commit (no file changes) produces no output records", async () => {
      const sha1 = "a".repeat(40);
      const sha2 = "b".repeat(40);
      const commits = [
        makeRawCommit(sha1, "first commit", [], 1000),
        makeRawCommit(sha2, "empty commit", [sha1], 2000),
      ];
      // sha2 has no file changes
      const fileChanges = new Map<string, readonly FileChange[]>([
        [sha1, [{ path: "a.txt", status: "added", additions: 1, deletions: 0 }]],
        [sha2, []],
      ]);
      const adapter = makeFakeGitAdapter(commits, fileChanges);
      const config = makeConfig({ outputDir: tmpDir, perFile: true });
      const result = await new Extractor(
        config,
        adapter,
        makeReporter(),
        () => new Date(),
        () => 0,
      ).run();

      // sha1 has 1 record, sha2 has 0 records
      expect(result.recordsWritten).toBe(1);
      const rawContent = await readFile((await findJsonlFiles(tmpDir))[0]!, "utf8");
      const records = rawContent.split("\n").filter(Boolean);
      expect(records).toHaveLength(1);
    });

    it("merge commit uses parents[0] as parentOid for getFileChanges", async () => {
      const sha1 = "a".repeat(40);
      const sha2 = "b".repeat(40);
      const sha3 = "c".repeat(40); // merge commit with parents [sha1, sha2]
      const capturedParentOids: (string | undefined)[] = [];

      const commits = [
        makeRawCommit(sha1, "base", [], 1000),
        makeRawCommit(sha2, "branch", [sha1], 2000),
        makeRawCommit(sha3, "merge", [sha1, sha2], 3000),
      ];
      const adapter: GitAdapter = {
        async resolveRef() {
          return sha3 as CommitHash;
        },
        async *walkCommits() {
          for (const c of [...commits].reverse()) yield c;
        },
        async getRemoteUrl() {
          return null;
        },
        async findMergeBase() {
          return null;
        },
        async getFileChanges(_repoPath, _commitOid, parentOid) {
          capturedParentOids.push(parentOid);
          return [];
        },
      };
      const config = makeConfig({ outputDir: tmpDir, perFile: true });
      await new Extractor(
        config,
        adapter,
        makeReporter(),
        () => new Date(),
        () => 0,
      ).run();

      // For sha3 (merge commit with parents [sha1, sha2]), parentOid must be sha1 (parents[0])
      const mergeCallIdx = 2; // third commit traversed (reverse order: sha3, sha2, sha1)
      expect(capturedParentOids[0]).toBe(sha1); // sha3's parents[0]
      // For sha1 (root), parentOid must be undefined
      expect(capturedParentOids[2]).toBeUndefined();
    });

    it("recordsWritten counts file records, not commits", async () => {
      const sha1 = "a".repeat(40);
      const commits = [makeRawCommit(sha1, "big commit", [], 1000)];
      // One commit that changes 4 files
      const fileChanges = new Map<string, readonly FileChange[]>([
        [
          sha1,
          [
            { path: "a.txt", status: "added", additions: 1, deletions: 0 },
            { path: "b.txt", status: "added", additions: 2, deletions: 0 },
            { path: "c.txt", status: "added", additions: 3, deletions: 0 },
            { path: "d.txt", status: "added", additions: 4, deletions: 0 },
          ],
        ],
      ]);
      const reporter = makeReporter();
      const adapter = makeFakeGitAdapter(commits, fileChanges);
      const config = makeConfig({ outputDir: tmpDir, perFile: true });
      const result = await new Extractor(
        config,
        adapter,
        reporter,
        () => new Date(),
        () => 0,
      ).run();

      // 1 commit × 4 file changes = 4 records
      expect(result.recordsWritten).toBe(4);
      // reporter.progress was called 4 times (once per file record)
      expect(reporter.progressCalls).toHaveLength(4);
      expect(reporter.progressCalls).toEqual([1, 2, 3, 4]);
      // reporter.done called with final count
      expect(reporter.doneCalls[0]).toBe(4);
    });

    it("file rotation in file mode: single commit's records can span rotation boundaries", async () => {
      const sha1 = "a".repeat(40);
      const commits = [makeRawCommit(sha1, "big commit", [], 1000)];
      const fileChanges = new Map<string, readonly FileChange[]>([
        [
          sha1,
          [
            { path: "a.txt", status: "added", additions: 1, deletions: 0 },
            { path: "b.txt", status: "added", additions: 1, deletions: 0 },
            { path: "c.txt", status: "added", additions: 1, deletions: 0 },
          ],
        ],
      ]);
      const adapter = makeFakeGitAdapter(commits, fileChanges);
      const config = makeConfig({
        outputDir: tmpDir,
        perFile: true,
        rotation: { maxLines: 2 },
      });
      await new Extractor(
        config,
        adapter,
        makeReporter(),
        () => new Date(),
        () => 0,
      ).run();

      const files = await findJsonlFiles(tmpDir);
      expect(files).toHaveLength(2); // 3 records, maxLines=2 → 2 files
      const file1Lines = (await readFile(files[0]!, "utf8")).split("\n").filter(Boolean);
      const file2Lines = (await readFile(files[1]!, "utf8")).split("\n").filter(Boolean);
      expect(file1Lines).toHaveLength(2);
      expect(file2Lines).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Fact vocabulary and checkpoint seam
  // ---------------------------------------------------------------------------

  describe("Fact vocabulary and checkpoint seam", () => {
    it("commit-mode: CommitFact projection preserves all output fields", async () => {
      const { fs, init, addCommit } = makeRepo("https://github.com/org/my-repo.git");
      await init();
      const sha = await addCommit("a.txt", "content", "first commit\n\nBody text", 1000);

      const adapter = new IsomorphicGitAdapter(fs);
      const config = makeConfig({ outputDir: tmpDir });
      await makeExtractor(config, adapter).run();

      const commits = await readFirstJsonlFile(tmpDir);
      expect(commits).toHaveLength(1);
      const commit = commits[0]!;

      // All fields expected from CommitFact → OutputCommit projection
      expect(commit.oid).toBe(sha);
      expect(commit.subject).toBe("first commit");
      expect(commit.body).toBe("Body text");
      expect(commit.repository.name).toBe("my-repo");
      expect(commit.repository.url).toBe("https://github.com/org/my-repo.git");
      expect(commit.parents).toEqual([]);
      expect(typeof commit.author.timestamp).toBe("string");
      expect(commit.author.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("file-mode: FileChangeFact projection preserves all output fields", async () => {
      const sha1 = "a".repeat(40);
      const commits = [makeRawCommit(sha1, "initial\n\nFirst file added", [], 1000)];
      const fileChanges = new Map<string, readonly FileChange[]>([
        [sha1, [{ path: "src/index.ts", status: "added", additions: 42, deletions: 0 }]],
      ]);
      const adapter = makeFakeGitAdapter(commits, fileChanges, "https://github.com/org/repo.git");
      const config = makeConfig({ outputDir: tmpDir, perFile: true });
      await new Extractor(
        config,
        adapter,
        makeReporter(),
        () => new Date(),
        () => 0,
      ).run();

      const rawContent = await readFile((await findJsonlFiles(tmpDir))[0]!, "utf8");
      const record = JSON.parse(rawContent.trim()) as OutputCommit & {
        file: { path: string; status: string; additions: number; deletions: number };
      };
      // Commit fields from CommitFact projection
      expect(record.oid).toBe(sha1);
      expect(record.subject).toBe("initial");
      expect(record.body).toBe("First file added");
      expect(record.repository.name).toBe("repo");
      expect(record.repository.url).toBe("https://github.com/org/repo.git");
      // File fields from FileChangeFact projection
      expect(record.file.path).toBe("src/index.ts");
      expect(record.file.status).toBe("added");
      expect(record.file.additions).toBe(42);
      expect(record.file.deletions).toBe(0);
    });

    it("ExtractionCheckpoint is interchangeable with StateFile compatibility alias", async () => {
      const { fs, init, addCommit } = makeRepo();
      await init();
      await addCommit("a.txt", "v1", "commit 1", 1000);

      const stateFilePath = join(tmpDir, "gitrail-state.json");
      const adapter = new IsomorphicGitAdapter(fs);

      await makeExtractor(
        makeConfig({ outputDir: tmpDir, stateFilePath, incremental: false }),
        adapter,
      ).run();

      const raw = await readFile(stateFilePath, "utf8");
      const checkpoint: ExtractionCheckpoint = JSON.parse(raw) as ExtractionCheckpoint;

      // ExtractionCheckpoint and StateFile are the same type via alias
      const asStateFile: StateFile = checkpoint;
      expect(asStateFile.version).toBe(1);
      expect(asStateFile.repositoryPath).toBe(resolve("/"));
      expect(asStateFile.branches).toHaveLength(1);

      const branch: BranchCheckpoint = checkpoint.branches[0]!;
      const asBranchEntry: StateBranchEntry = branch;
      expect(asBranchEntry.name).toBe("main");
      expect(typeof asBranchEntry.lastCommitHash).toBe("string");
    });

    it("CheckpointStore is interchangeable with StateStore compatibility alias", async () => {
      const stateFilePath = join(tmpDir, "gitrail-state.json");

      // makeFileStateStore returns StateStore; assert it satisfies CheckpointStore too
      const asCheckpointStore: CheckpointStore = makeFileStateStore(stateFilePath);
      const asStateStore: StateStore = asCheckpointStore;
      expect(asStateStore).toBeDefined();

      // Round-trip an ExtractionCheckpoint through the store
      const checkpoint: ExtractionCheckpoint = {
        version: 1,
        generatedAt: new Date().toISOString(),
        repositoryPath: resolve("/"),
        branches: [{ name: "main", lastCommitHash: "a".repeat(40) as CommitHash }],
      };
      await asCheckpointStore.write(checkpoint);
      const read = await asCheckpointStore.read();
      expect(read).not.toBeNull();
      expect(read!.version).toBe(1);
      expect(read!.branches[0]!.name).toBe("main");
    });

    it("CommitFact and FileChangeFact types are correctly shaped (compile-time seam check)", () => {
      // This test exists to ensure the types are importable and structurally correct.
      const fact: CommitFact = {
        oid: "a".repeat(40),
        message: "test commit\n",
        author: { name: "A", email: "a@x.com", timestamp: 1000, timezoneOffset: 0 },
        committer: { name: "A", email: "a@x.com", timestamp: 1000, timezoneOffset: 0 },
        parents: [],
        repository: { name: "repo", url: null },
      };
      const fileFact: FileChangeFact = {
        commit: fact,
        file: { path: "a.txt", status: "added", additions: 1, deletions: 0 },
      };
      expect(fact.oid).toHaveLength(40);
      expect(fact.repository.url).toBeNull();
      expect(fileFact.file.status).toBe("added");
      expect(fileFact.commit).toBe(fact);
    });
  });
});
