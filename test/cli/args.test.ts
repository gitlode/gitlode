import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodeFs from "node:fs";
import * as git from "isomorphic-git";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { IsomorphicGitAdapter } from "../../src/git/isomorphic-git-adapter.js";
import type { GitAdapter } from "../../src/git/index.js";
import { parseArgs } from "../../src/cli/args.js";

const AUTHOR = {
  name: "Tester",
  email: "test@example.com",
  timestamp: 1_000_000,
  timezoneOffset: 0,
};

// A minimal mock adapter for tests that don't reach Git access
const noopAdapter: GitAdapter = {
  resolveRef: async () => "abc123def456abc123def456abc123def456abc123",
  walkCommits: async function* () {},
  getRemoteUrl: async () => null,
};

let exitSpy: MockInstance;
let stderrSpy: MockInstance;
const originalArgv = process.argv.slice();

function setArgv(...args: string[]) {
  process.argv = ["node", "gitrail", ...args];
}

beforeEach(() => {
  exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  process.argv = originalArgv.slice();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers for real on-disk Git repos
// ---------------------------------------------------------------------------

async function makeRealRepo(options?: { remoteUrl?: string; branch?: string }): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "gitrail-args-test-"));
  const branch = options?.branch ?? "main";
  await git.init({ fs: nodeFs, dir, defaultBranch: branch });
  await git.setConfig({ fs: nodeFs, dir, path: "user.name", value: "Tester" });
  await git.setConfig({ fs: nodeFs, dir, path: "user.email", value: "test@example.com" });
  if (options?.remoteUrl) {
    await git.setConfig({
      fs: nodeFs,
      dir,
      path: "remote.origin.url",
      value: options.remoteUrl,
    });
  }
  // Make an initial commit so the branch ref resolves
  await writeFile(join(dir, "init.txt"), "init");
  await git.add({ fs: nodeFs, dir, filepath: "init.txt" });
  await git.commit({
    fs: nodeFs,
    dir,
    message: "initial commit",
    author: AUTHOR,
  });
  return dir;
}

// ---------------------------------------------------------------------------
// Mutual exclusion checks
// ---------------------------------------------------------------------------

describe("parseArgs – mutual exclusion", () => {
  it("--since-commit + --since-date → exits with code 1", async () => {
    setArgv(
      "--branch",
      "main",
      "--since-commit",
      "abc123",
      "--since-date",
      "2024-01-01T00:00:00Z",
      ".",
    );
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      "--since-commit and --since-date cannot be used together\n",
    );
  });

  it("--state + --since-commit → exits with code 1", async () => {
    setArgv("--branch", "main", "--state", "state.json", "--since-commit", "abc123", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      "--state and --since-commit cannot be used together. Use --state for incremental runs.\n",
    );
  });

  it("--state + --since-date → exits with code 1", async () => {
    setArgv(
      "--branch",
      "main",
      "--state",
      "state.json",
      "--since-date",
      "2024-01-01T00:00:00Z",
      ".",
    );
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      "--state and --since-date cannot be used together. Use --state for incremental runs.\n",
    );
  });
});

// ---------------------------------------------------------------------------
// Missing --branch
// ---------------------------------------------------------------------------

describe("parseArgs – missing --branch", () => {
  it("exits with code 1 when no --branch is provided", async () => {
    setArgv(".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith("At least one --branch must be specified\n");
  });
});

// ---------------------------------------------------------------------------
// --rotate-lines validation
// ---------------------------------------------------------------------------

describe("parseArgs – --rotate-lines validation", () => {
  it.each([["abc"], ["0"], ["-1"], ["1.5"]])(
    "rejects non-positive-integer value %s",
    async (val) => {
      setArgv("--branch", "main", "--rotate-lines", val, ".");
      await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalledWith("--rotate-lines must be a positive integer\n");
    },
  );
});

// ---------------------------------------------------------------------------
// --rotate-size validation
// ---------------------------------------------------------------------------

describe("parseArgs – --rotate-size validation", () => {
  it("rejects invalid --rotate-size", async () => {
    setArgv("--branch", "main", "--rotate-size", "abc", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith("--rotate-size must be a positive integer\n");
  });
});

// ---------------------------------------------------------------------------
// --since-date validation
// ---------------------------------------------------------------------------

describe("parseArgs – --since-date validation", () => {
  it("rejects invalid ISO 8601 date", async () => {
    setArgv("--branch", "main", "--since-date", "not-a-date", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid date format for --since-date"),
    );
  });

  it("accepts a valid ISO 8601 date (validation passes)", async () => {
    // Validation passes — this test verifies that no format error is thrown
    // (further processing may still fail due to no real repo; we only check the stderr)
    setArgv("--branch", "main", "--since-date", "2024-01-01T00:00:00Z", ".");
    // Process exits with 1 because "." may or may not be a valid git repo in CI,
    // but the important thing is the message is NOT about --since-date format
    const result = await parseArgs(noopAdapter).catch((e: unknown) => e);
    // If it threw (process.exit was called), make sure it wasn't the date-format error
    if (result instanceof Error && result.message.includes("process.exit")) {
      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Invalid date format for --since-date"),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// --output-prefix derivation (real on-disk repo)
// ---------------------------------------------------------------------------

describe("parseArgs – --output-prefix derivation", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("derives prefix from remote origin URL when available", async () => {
    repoDir = await makeRealRepo({ remoteUrl: "https://github.com/org/my-repo.git" });
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.outputPrefix).toBe("my-repo");
  });

  it("derives prefix from SSH-style remote URL", async () => {
    repoDir = await makeRealRepo({ remoteUrl: "git@github.com:org/another-repo.git" });
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.outputPrefix).toBe("another-repo");
  });

  it("falls back to directory basename when no remote", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    // The prefix should be the basename of the temp dir
    const expected = repoDir.split(/[/\\]/).pop()!;
    expect(config.outputPrefix).toBe(expected);
  });

  it("uses explicit --output-prefix when provided", async () => {
    repoDir = await makeRealRepo({ remoteUrl: "https://github.com/org/my-repo.git" });
    const adapter = new IsomorphicGitAdapter();
    setArgv(
      "--branch",
      "main",
      "--output-dir",
      repoDir,
      "--output-prefix",
      "custom-prefix",
      repoDir,
    );
    const config = await parseArgs(adapter);
    expect(config.outputPrefix).toBe("custom-prefix");
  });
});

// ---------------------------------------------------------------------------
// Valid args round-trip
// ---------------------------------------------------------------------------

describe("parseArgs – valid args round-trip", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("returns correct ExtractorConfig for full extraction", async () => {
    repoDir = await makeRealRepo({ remoteUrl: "https://github.com/org/my-repo.git" });
    const adapter = new IsomorphicGitAdapter();
    setArgv(
      "--branch",
      "main",
      "--branch",
      "develop",
      "--output-dir",
      repoDir,
      "--output-prefix",
      "test-prefix",
      repoDir,
    );
    // "develop" branch doesn't exist but that's OK — extractor handles it
    const config = await parseArgs(adapter);
    expect(config.repositoryPath).toBe(repoDir);
    expect(config.branches).toEqual(["main", "develop"]);
    expect(config.outputPrefix).toBe("test-prefix");
    expect(config.rotation).toEqual({ maxLines: undefined, maxBytes: undefined });
    expect(config.range).toBeUndefined();
    expect(config.stateFilePath).toBeUndefined();
  });

  it("returns correct rotation config", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv(
      "--branch",
      "main",
      "--rotate-lines",
      "1000",
      "--rotate-size",
      "1048576",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const config = await parseArgs(adapter);
    expect(config.rotation).toEqual({ maxLines: 1000, maxBytes: 1048576 });
  });

  it("returns correct range for --since-date", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv(
      "--branch",
      "main",
      "--since-date",
      "2024-06-01T00:00:00Z",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const config = await parseArgs(adapter);
    expect(config.range).toEqual({ type: "date", since: new Date("2024-06-01T00:00:00Z") });
  });

  it("sets stateFilePath when --state is provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--state", "/tmp/state.json", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.stateFilePath).toBe("/tmp/state.json");
  });
});
