import nodeFs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as git from "isomorphic-git";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { parseArgs } from "../../src/cli/args.js";
import type { GitAdapter } from "../../src/git/index.js";
import { IsomorphicGitAdapter } from "../../src/git/isomorphic-git-adapter.js";

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
  it("--since-ref + --since-date → exits with code 1", async () => {
    setArgv("--branch", "main", "--since-ref", "v1.0", "--since-date", "2024-01-01T00:00:00Z", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      "--since-ref and --since-date cannot be used together\n",
    );
  });

  it("--mode incremental + --since-ref → exits with code 1", async () => {
    setArgv(
      "--mode",
      "incremental",
      "--branch",
      "main",
      "--state",
      "state.json",
      "--since-ref",
      "v1.0",
      ".",
    );
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith("--since-ref cannot be used with --mode incremental\n");
  });

  it("--mode incremental + --since-date → exits with code 1", async () => {
    setArgv(
      "--mode",
      "incremental",
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
    expect(stderrSpy).toHaveBeenCalledWith("--since-date cannot be used with --mode incremental\n");
  });

  it("--on-missing-state without --mode incremental → exits with code 1", async () => {
    setArgv("--branch", "main", "--on-missing-state", "snapshot", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      "--on-missing-state is only valid with --mode incremental\n",
    );
  });

  it("--mode incremental without --state → exits with code 1", async () => {
    setArgv("--mode", "incremental", "--branch", "main", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith("--state is required when using --mode incremental\n");
  });

  it("--state + --since-ref is permitted in snapshot mode (no error)", async () => {
    // In snapshot mode, --state and --since-ref are allowed together.
    // The test verifies no mutual exclusion error — further processing may still fail.
    setArgv("--branch", "main", "--state", "/tmp/state.json", "--since-ref", "v1.0", ".");
    const result = await parseArgs(noopAdapter).catch((e: unknown) => e);
    if (result instanceof Error && result.message.includes("process.exit")) {
      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("cannot be used together"),
      );
      expect(stderrSpy).not.toHaveBeenCalledWith(expect.stringContaining("cannot be used with"));
    }
  });

  it("--state + --since-date is permitted in snapshot mode (no error)", async () => {
    setArgv(
      "--branch",
      "main",
      "--state",
      "/tmp/state.json",
      "--since-date",
      "2024-01-01T00:00:00Z",
      ".",
    );
    const result = await parseArgs(noopAdapter).catch((e: unknown) => e);
    if (result instanceof Error && result.message.includes("process.exit")) {
      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("cannot be used together"),
      );
      expect(stderrSpy).not.toHaveBeenCalledWith(expect.stringContaining("cannot be used with"));
    }
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
    expect(config.mode).toBe("snapshot");
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
    const stateFilePath = join(repoDir, "state.json");
    setArgv("--branch", "main", "--state", stateFilePath, "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.stateFilePath).toBe(stateFilePath);
  });

  it("sets quiet=true when --quiet is provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--quiet", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.quiet).toBe(true);
  });

  it("sets quiet=false when --quiet is not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.quiet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// --mode flag and -m alias
// ---------------------------------------------------------------------------

describe("parseArgs – --mode", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("defaults mode to snapshot when --mode is not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.mode).toBe("snapshot");
  });

  it("accepts --mode snapshot explicitly", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--mode", "snapshot", "--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.mode).toBe("snapshot");
  });

  it("accepts -m as alias for --mode", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("-m", "snapshot", "--branch", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.mode).toBe("snapshot");
  });

  it("rejects invalid --mode value", async () => {
    setArgv("--mode", "auto", "--branch", "main", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith('--mode must be "snapshot" or "incremental"\n');
  });
});

// ---------------------------------------------------------------------------
// --mode incremental + state
// ---------------------------------------------------------------------------

describe("parseArgs – incremental mode", () => {
  let repoDir: string;
  let stateDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
    if (stateDir) await rm(stateDir, { recursive: true, force: true });
  });

  it("accepts --mode incremental with --state pointing to an existing file", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "gitrail-args-state-"));
    const stateFile = join(stateDir, "state.json");
    await writeFile(
      stateFile,
      JSON.stringify({ version: 1, generatedAt: "", repositoryPath: "/", branches: [] }),
    );
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv(
      "--mode",
      "incremental",
      "--branch",
      "main",
      "--state",
      stateFile,
      "--output-dir",
      repoDir,
      repoDir,
    );
    const config = await parseArgs(adapter);
    expect(config.mode).toBe("incremental");
    expect(config.stateFilePath).toBe(stateFile);
    expect(config.onMissingState).toBe("error");
  });

  it("exits 1 when --mode incremental and state file missing (default --on-missing-state error)", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "gitrail-args-state-"));
    const missingStatePath = join(stateDir, "nonexistent.json");
    setArgv("--mode", "incremental", "--branch", "main", "--state", missingStatePath, ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("State file not found:"));
  });

  it("accepts --on-missing-state snapshot when mode is incremental", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "gitrail-args-state-"));
    const missingStatePath = join(stateDir, "nonexistent.json");
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv(
      "--mode",
      "incremental",
      "--branch",
      "main",
      "--state",
      missingStatePath,
      "--on-missing-state",
      "snapshot",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const config = await parseArgs(adapter);
    expect(config.mode).toBe("incremental");
    expect(config.onMissingState).toBe("snapshot");
  });

  it("rejects --on-missing-state with invalid value", async () => {
    setArgv(
      "--mode",
      "incremental",
      "--branch",
      "main",
      "--state",
      "state.json",
      "--on-missing-state",
      "ignore",
      ".",
    );
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith('--on-missing-state must be "error" or "snapshot"\n');
  });
});

// ---------------------------------------------------------------------------
// State parent directory existence check
// ---------------------------------------------------------------------------

describe("parseArgs – state parent directory validation", () => {
  it("exits 1 when state parent directory does not exist", async () => {
    setArgv("--branch", "main", "--state", "/nonexistent-dir-abc/state.json", ".");
    await expect(parseArgs(noopAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Parent directory for state file not found:"),
    );
  });
});

// ---------------------------------------------------------------------------
// --since-ref
// ---------------------------------------------------------------------------

describe("parseArgs – --since-ref", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("returns range with type 'ref' when --since-ref is provided", async () => {
    repoDir = await makeRealRepo();
    // The noopAdapter resolveRef always returns a hash, so since-ref validation passes
    setArgv("--branch", "main", "--since-ref", "v1.0", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(noopAdapter);
    expect(config.range).toEqual({
      type: "ref",
      ref: "abc123def456abc123def456abc123def456abc123",
    });
  });

  it("exits 1 when --since-ref is not found in repository", async () => {
    repoDir = await makeRealRepo();
    const { GitAdapterError } = await import("../../src/git/index.js");
    const failAdapter: GitAdapter = {
      resolveRef: async (_repoPath, ref) => {
        if (ref === "nonexistent-tag") {
          throw new GitAdapterError("Ref not found", "REF_NOT_FOUND");
        }
        return "abc123def456abc123def456abc123def456abc123";
      },
      walkCommits: async function* () {},
      getRemoteUrl: async () => null,
    };
    setArgv("--branch", "main", "--since-ref", "nonexistent-tag", "--output-dir", repoDir, repoDir);
    await expect(parseArgs(failAdapter)).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith("Ref not found: nonexistent-tag\n");
  });
});

// ---------------------------------------------------------------------------
// Shorthand aliases
// ---------------------------------------------------------------------------

describe("parseArgs – shorthand aliases", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("-b collects branch values", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("-b", "main", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.branches).toContain("main");
  });

  it("-b can be used multiple times (repeatable)", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("-b", "main", "-b", "develop", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.branches).toContain("main");
    expect(config.branches).toContain("develop");
  });

  it("-o is accepted as alias for --output-dir", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "-o", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.outputDir).toBe(repoDir);
  });

  it("-s is accepted as alias for --state", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    const stateFilePath = join(repoDir, "state.json");
    setArgv("--branch", "main", "-s", stateFilePath, "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.stateFilePath).toBe(stateFilePath);
  });

  it("-q is accepted as alias for --quiet", async () => {
    repoDir = await makeRealRepo();
    const adapter = new IsomorphicGitAdapter();
    setArgv("--branch", "main", "-q", "--output-dir", repoDir, repoDir);
    const config = await parseArgs(adapter);
    expect(config.quiet).toBe(true);
  });
});
