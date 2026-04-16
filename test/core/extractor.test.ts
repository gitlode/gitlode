import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Extractor } from "../../src/core/extractor.js";
import type { ExtractorConfig, StateFile } from "../../src/core/index.js";
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

async function readJsonlFile(filePath: string): Promise<OutputCommit[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutputCommit);
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
    const extractor = new Extractor(config, adapter);
    await extractor.run();

    const commits = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));
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
    const raw = await readFile(join(tmpDir, "repo-000001.jsonl"), "utf8");
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
    const extractor = new Extractor(config, adapter);
    await extractor.run();

    const commits = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));

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
    const extractor = new Extractor(config, adapter);
    await extractor.run();

    const commits = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));
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
    const extractor = new Extractor(config, adapter);
    await extractor.run();

    const commits = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));
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
    await new Extractor(config1, adapter).run();

    const firstCommits = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));
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
      await new Extractor(config2, adapter).run();

      // No commits to write — no output file created (writer.seq stays 0)
      try {
        await readFile(join(tmpDir2, "repo-000001.jsonl"), "utf8");
        // If file exists, it should be empty
        const commits = await readJsonlFile(join(tmpDir2, "repo-000001.jsonl"));
        expect(commits).toHaveLength(0);
      } catch (err) {
        // File not created is also acceptable (writer never opened a file)
        expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
      }
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
    const extractor = new Extractor(config, adapter);

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
    const extractor = new Extractor(config, adapter);
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
    const extractor = new Extractor(config, adapter);
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

    await new Extractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" }),
      adapter,
    ).run();

    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      const result = await new Extractor(
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
    const extractor = new Extractor(config, adapter);
    await extractor.run();

    const file1 = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));
    const file2 = await readJsonlFile(join(tmpDir, "repo-000002.jsonl"));

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
    await new Extractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" }),
      adapter,
    ).run();

    // Second run in snapshot mode — state content is ignored, all commits extracted again
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await new Extractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, mode: "snapshot" }),
        adapter,
      ).run();

      const commits = await readJsonlFile(join(tmpDir2, "repo-000001.jsonl"));
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
    await new Extractor(
      makeConfig({ outputDir: tmpDir, stateFilePath, mode: "snapshot" }),
      adapter,
    ).run();

    // Add a new commit after the state was recorded
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    // Second run in incremental mode — should only get the new commit
    const tmpDir2 = join(tmpdir(), `gitrail-extractor-test-${randomUUID()}`);
    await mkdir(tmpDir2, { recursive: true });
    try {
      await new Extractor(
        makeConfig({ outputDir: tmpDir2, stateFilePath, mode: "incremental" }),
        adapter,
      ).run();

      const commits = await readJsonlFile(join(tmpDir2, "repo-000001.jsonl"));
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
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const result = await new Extractor(
        makeConfig({
          outputDir: tmpDir,
          stateFilePath: missingStatePath,
          mode: "incremental",
          onMissingState: "snapshot",
        }),
        adapter,
      ).run();

      // All commits extracted (full traversal)
      expect(result.commitsWritten).toBe(2);
      const commits = await readJsonlFile(join(tmpDir, "repo-000001.jsonl"));
      const oids = commits.map((c) => c.oid);
      expect(oids).toContain(sha1);
      expect(oids).toContain(sha2);

      // Warning was emitted
      const warningCall = stderrSpy.mock.calls.find(
        (args) => typeof args[0] === "string" && args[0].includes("State file not found"),
      );
      expect(warningCall).toBeDefined();
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
