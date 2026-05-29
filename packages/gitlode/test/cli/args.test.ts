import nodeFs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as git from "isomorphic-git";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { parseArgs, program, type ParseArgsResult } from "../../src/cli/args.js";
import type { CommitOid } from "../../src/core/index.js";
import { JsDiffAdapter, type GitAdapter } from "../../src/git/index.js";
import { IsomorphicGitAdapter } from "../../src/git/isomorphic-git-adapter.js";

const AUTHOR = {
  name: "Tester",
  email: "test@example.com",
  timestamp: 1_000_000,
  timezoneOffset: 0,
};

// A minimal mock adapter for tests that don't reach Git access
const noopAdapter: GitAdapter = {
  supportedObjectFormats: () => ["sha1"],
  resolveRef: async () => "abc123def456abc123def456abc123def456abc123" as CommitOid,
  getRepositoryObjectFormat: async () => "sha1",
  classifyRefType: async () => "branch",
  walkCommits: async function* () {},
  getRemoteUrl: async () => null,
  findMergeBase: async () => null,
  getFileChanges: async () => [],
};

let exitSpy: MockInstance;
let stderrSpy: MockInstance;
const originalArgv = process.argv.slice();

function makeRealAdapter(): IsomorphicGitAdapter {
  return new IsomorphicGitAdapter({ fs: nodeFs, diffAdapter: new JsDiffAdapter() });
}

function setArgv(...args: string[]) {
  process.argv = ["node", "gitlode", ...args];
}

function expectParsed(result: ParseArgsResult) {
  expect(result.kind).toBe("parsed");
  if (result.kind !== "parsed") {
    throw new Error(`Expected parsed result, got ${result.kind}`);
  }
  return result.parsed;
}

async function expectUserErrorTermination(
  promise: Promise<ParseArgsResult>,
  message: string,
): Promise<void> {
  await expect(promise).resolves.toEqual({
    kind: "termination",
    termination: { kind: "user-error", message, exitCode: 1 },
  });
  expect(exitSpy).not.toHaveBeenCalled();
  expect(stderrSpy).not.toHaveBeenCalled();
}

async function expectSuccessTermination(promise: Promise<ParseArgsResult>): Promise<void> {
  await expect(promise).resolves.toEqual({
    kind: "termination",
    termination: { kind: "success", exitCode: 0 },
  });
  expect(exitSpy).not.toHaveBeenCalled();
  expect(stderrSpy).not.toHaveBeenCalled();
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
  const dir = await mkdtemp(join(tmpdir(), "gitlode-args-test-"));
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
  it("--since-ref + --since-date → returns user-error termination", async () => {
    setArgv("--ref", "main", "--since-ref", "v1.0", "--since-date", "2024-01-01T00:00:00Z", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "--since-ref and --since-date cannot be used together",
    );
  });

  it("--incremental + --since-ref → returns user-error termination", async () => {
    setArgv("--incremental", "--ref", "main", "--state", "state.json", "--since-ref", "v1.0", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "--since-ref cannot be used with --incremental",
    );
  });

  it("--incremental + --since-date → returns user-error termination", async () => {
    setArgv(
      "--incremental",
      "--ref",
      "main",
      "--state",
      "state.json",
      "--since-date",
      "2024-01-01T00:00:00Z",
      ".",
    );
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "--since-date cannot be used with --incremental",
    );
  });

  it("--missing-state without --incremental → returns user-error termination", async () => {
    setArgv("--ref", "main", "--missing-state", "snapshot", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "--missing-state is only valid with --incremental",
    );
  });

  it("--incremental without --state → returns user-error termination", async () => {
    setArgv("--incremental", "--ref", "main", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "--state is required when using --incremental",
    );
  });

  it("--state + --since-ref is permitted in snapshot mode (no error)", async () => {
    // In snapshot mode, --state and --since-ref are allowed together.
    // The test verifies no mutual exclusion error — further processing may still fail.
    setArgv(
      "--ref",
      "main",
      "--state",
      join(tmpdir(), "gitlode-state.json"),
      "--since-ref",
      "v1.0",
      ".",
    );
    expectParsed(await parseArgs(noopAdapter));
  });

  it("--state + --since-date is permitted in snapshot mode (no error)", async () => {
    setArgv(
      "--ref",
      "main",
      "--state",
      join(tmpdir(), "gitlode-state.json"),
      "--since-date",
      "2024-01-01T00:00:00Z",
      ".",
    );
    expectParsed(await parseArgs(noopAdapter));
  });
});

// ---------------------------------------------------------------------------
// Missing --branch
// ---------------------------------------------------------------------------

describe("parseArgs – missing --ref", () => {
  it("returns user-error termination when no --branch is provided", async () => {
    setArgv(".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "At least one --ref must be specified",
    );
  });
});

// ---------------------------------------------------------------------------
// --rotate-lines validation
// ---------------------------------------------------------------------------

describe("parseArgs – --rotate-lines validation", () => {
  it.each([["abc"], ["0"], ["-1"], ["1.5"]])(
    "rejects non-positive-integer value %s",
    async (val) => {
      setArgv("--ref", "main", "--rotate-lines", val, ".");
      await expectUserErrorTermination(
        parseArgs(noopAdapter),
        "--rotate-lines must be a positive integer",
      );
    },
  );
});

// ---------------------------------------------------------------------------
// --rotate-size validation
// ---------------------------------------------------------------------------

describe("parseArgs – --rotate-size validation", () => {
  it.each([["abc"], ["1MiB"], ["1.5G"], ["+1M"], ["-1M"], ["1 M"], ["1MB"]])(
    "rejects invalid format %s",
    async (val) => {
      setArgv("--ref", "main", "--rotate-size", val, ".");
      await expectUserErrorTermination(
        parseArgs(noopAdapter),
        "--rotate-size must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)",
      );
    },
  );

  it.each([["1"], ["1048575"], ["1K"], ["68719476737"], ["65G"]])(
    "rejects out-of-range value %s",
    async (val) => {
      setArgv("--ref", "main", "--rotate-size", val, ".");
      await expectUserErrorTermination(
        parseArgs(noopAdapter),
        "--rotate-size must be between 1048576 and 68719476736 bytes",
      );
    },
  );

  it.each([
    ["1048576", 1_048_576],
    ["104857600", 104_857_600],
    ["500M", 524_288_000],
    ["1G", 1_073_741_824],
    ["1g", 1_073_741_824],
    ["1024K", 1_048_576],
    ["64G", 68_719_476_736],
    [" 500M ", 524_288_000],
  ] as [string, number][])("accepts valid --rotate-size %s", async (val, expected) => {
    setArgv("--ref", "main", "--rotate-size", val, ".");
    const parsed = expectParsed(await parseArgs(noopAdapter));
    expect(parsed.rotation.maxBytes).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// --max-diff-size validation
// ---------------------------------------------------------------------------

describe("parseArgs – --max-diff-size validation", () => {
  it.each([["abc"], ["1MiB"], ["1.5G"], ["+1M"], ["-1M"], ["1 M"], ["1MB"]])(
    "rejects invalid format %s",
    async (val) => {
      setArgv("--ref", "main", "--max-diff-size", val, ".");
      await expectUserErrorTermination(
        parseArgs(noopAdapter),
        "--max-diff-size must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)",
      );
    },
  );

  it("rejects zero", async () => {
    setArgv("--ref", "main", "--max-diff-size", "0", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "--max-diff-size must be at least 1 byte",
    );
  });

  it.each([
    ["1", 1],
    ["100K", 102_400],
    ["1M", 1_048_576],
    ["2G", 2_147_483_648],
    [" 500M ", 524_288_000],
  ] as [string, number][])("accepts valid --max-diff-size %s", async (val, expected) => {
    setArgv("--ref", "main", "--max-diff-size", val, ".");
    const parsed = expectParsed(await parseArgs(noopAdapter));
    expect(parsed.maxDiffSize).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// --since-date validation
// ---------------------------------------------------------------------------

describe("parseArgs – --since-date validation", () => {
  it("rejects invalid ISO 8601 date", async () => {
    setArgv("--ref", "main", "--since-date", "not-a-date", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      "Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
    );
  });

  it("accepts a valid ISO 8601 date (validation passes)", async () => {
    setArgv("--ref", "main", "--since-date", "2024-01-01T00:00:00Z", ".");
    expectParsed(await parseArgs(noopAdapter));
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
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.outputPrefix).toBe("my-repo");
  });

  it("derives prefix from SSH-style remote URL", async () => {
    repoDir = await makeRealRepo({ remoteUrl: "git@github.com:org/another-repo.git" });
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.outputPrefix).toBe("another-repo");
  });

  it("falls back to directory basename when no remote", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    // The prefix should be the basename of the temp dir
    const expected = repoDir.split(/[/\\]/).pop()!;
    expect(parsed.outputPrefix).toBe(expected);
  });

  it("uses explicit --output-prefix when provided", async () => {
    repoDir = await makeRealRepo({ remoteUrl: "https://github.com/org/my-repo.git" });
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, "--output-prefix", "custom-prefix", repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.outputPrefix).toBe("custom-prefix");
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
    const adapter = makeRealAdapter();
    setArgv(
      "--ref",
      "main",
      "--ref",
      "develop",
      "--output-dir",
      repoDir,
      "--output-prefix",
      "test-prefix",
      repoDir,
    );
    // "develop" branch doesn't exist but that's OK — extractor handles it
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.repositoryPath).toBe(repoDir);
    expect(parsed.refs).toEqual(["main", "develop"]);
    expect(parsed.outputPrefix).toBe("test-prefix");
    expect(parsed.rotation).toEqual({ maxLines: undefined, maxBytes: undefined });
    expect(parsed.range).toBeUndefined();
    expect(parsed.stateFilePath).toBeUndefined();
    expect(parsed.incremental).toBe(false);
  });

  it("returns correct rotation config", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv(
      "--ref",
      "main",
      "--rotate-lines",
      "1000",
      "--rotate-size",
      "1048576",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.rotation).toEqual({ maxLines: 1000, maxBytes: 1048576 });
  });

  it("returns correct range for --since-date", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv(
      "--ref",
      "main",
      "--since-date",
      "2024-06-01T00:00:00Z",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.range).toEqual({ type: "date", since: new Date("2024-06-01T00:00:00Z") });
  });

  it("sets stateFilePath when --state is provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    const stateFilePath = join(repoDir, "state.json");
    setArgv("--ref", "main", "--state", stateFilePath, "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.stateFilePath).toBe(stateFilePath);
  });

  it("sets quiet=true when --quiet is provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--quiet", "--output-dir", repoDir, repoDir);
    const { quiet } = expectParsed(await parseArgs(adapter));
    expect(quiet).toBe(true);
  });

  it("sets quiet=false when --quiet is not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const { quiet } = expectParsed(await parseArgs(adapter));
    expect(quiet).toBe(false);
  });

  it("sets profile=true when --profile is provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--profile", "--output-dir", repoDir, repoDir);
    const { profile } = expectParsed(await parseArgs(adapter));
    expect(profile).toBe(true);
  });

  it("sets profile=false when --profile is not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const { profile } = expectParsed(await parseArgs(adapter));
    expect(profile).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// --incremental flag
// ---------------------------------------------------------------------------

describe("parseArgs – --incremental", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("incremental defaults to false when --incremental is not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.incremental).toBe(false);
  });

  it("sets incremental=true when --incremental is provided", async () => {
    repoDir = await makeRealRepo();
    const stateDir = repoDir;
    const stateFile = join(stateDir, "state.json");
    await import("node:fs/promises").then(({ writeFile: wf }) =>
      wf(stateFile, JSON.stringify({ version: 2, generatedAt: "", repositoryPath: "/", refs: [] })),
    );
    const adapter = makeRealAdapter();
    setArgv(
      "--incremental",
      "--ref",
      "main",
      "--state",
      stateFile,
      "--output-dir",
      repoDir,
      repoDir,
    );
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.incremental).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// --incremental + state
// ---------------------------------------------------------------------------

describe("parseArgs – incremental mode", () => {
  let repoDir: string;
  let stateDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
    if (stateDir) await rm(stateDir, { recursive: true, force: true });
  });

  it("accepts --incremental with --state pointing to an existing file", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "gitlode-args-state-"));
    const stateFile = join(stateDir, "state.json");
    await writeFile(
      stateFile,
      JSON.stringify({ version: 2, generatedAt: "", repositoryPath: "/", refs: [] }),
    );
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv(
      "--incremental",
      "--ref",
      "main",
      "--state",
      stateFile,
      "--output-dir",
      repoDir,
      repoDir,
    );
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.incremental).toBe(true);
    expect(parsed.stateFilePath).toBe(stateFile);
    expect(parsed.missingState).toBe("error");
  });

  it("exits 1 when --incremental and state file missing (default --missing-state error)", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "gitlode-args-state-"));
    const missingStatePath = join(stateDir, "nonexistent.json");
    setArgv("--incremental", "--ref", "main", "--state", missingStatePath, ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      `State file not found: ${missingStatePath}`,
    );
  });

  it("accepts --missing-state snapshot when --incremental is set", async () => {
    stateDir = await mkdtemp(join(tmpdir(), "gitlode-args-state-"));
    const missingStatePath = join(stateDir, "nonexistent.json");
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv(
      "--incremental",
      "--ref",
      "main",
      "--state",
      missingStatePath,
      "--missing-state",
      "snapshot",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.incremental).toBe(true);
    expect(parsed.missingState).toBe("snapshot");
  });

  it("rejects --missing-state with invalid value", async () => {
    setArgv(
      "--incremental",
      "--ref",
      "main",
      "--state",
      "state.json",
      "--missing-state",
      "ignore",
      ".",
    );
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      '--missing-state must be "error" or "snapshot"',
    );
  });
});

// ---------------------------------------------------------------------------
// State parent directory existence check
// ---------------------------------------------------------------------------

describe("parseArgs – state parent directory validation", () => {
  it("exits 1 when state parent directory does not exist", async () => {
    setArgv("--ref", "main", "--state", "/nonexistent-dir-abc/state.json", ".");
    await expectUserErrorTermination(
      parseArgs(noopAdapter),
      `Parent directory for state file not found: ${resolve("/nonexistent-dir-abc")}`,
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
    setArgv("--ref", "main", "--since-ref", "v1.0", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(noopAdapter));
    expect(parsed.range).toEqual({
      type: "ref",
      ref: "abc123def456abc123def456abc123def456abc123",
    });
  });

  it("exits 1 when --since-ref is not found in repository", async () => {
    repoDir = await makeRealRepo();
    const { GitAdapterError } = await import("../../src/git/index.js");
    const failAdapter: GitAdapter = {
      supportedObjectFormats: () => ["sha1"],
      resolveRef: async (_repoPath, ref) => {
        if (ref === "nonexistent-tag") {
          throw new GitAdapterError("Ref not found", "REF_NOT_FOUND");
        }
        return "abc123def456abc123def456abc123def456abc123" as CommitOid;
      },
      getRepositoryObjectFormat: async () => "sha1",
      classifyRefType: async () => "branch",
      walkCommits: async function* () {},
      getRemoteUrl: async () => null,
      findMergeBase: async () => null,
      getFileChanges: async () => [],
    };
    setArgv("--ref", "main", "--since-ref", "nonexistent-tag", "--output-dir", repoDir, repoDir);
    await expectUserErrorTermination(parseArgs(failAdapter), "Ref not found: nonexistent-tag");
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

  it("-r collects ref values", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("-r", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.refs).toContain("main");
  });

  it("-r can be used multiple times (repeatable)", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("-r", "main", "-r", "develop", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.refs).toContain("main");
    expect(parsed.refs).toContain("develop");
  });

  it("-o is accepted as alias for --output-dir", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "-o", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.outputDir).toBe(repoDir);
  });

  it("-s is accepted as alias for --state", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    const stateFilePath = join(repoDir, "state.json");
    setArgv("--ref", "main", "-s", stateFilePath, "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.stateFilePath).toBe(stateFilePath);
  });

  it("-q is accepted as alias for --quiet", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "-q", "--output-dir", repoDir, repoDir);
    const { quiet } = expectParsed(await parseArgs(adapter));
    expect(quiet).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// --per-file
// ---------------------------------------------------------------------------

describe("parseArgs – --per-file", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("defaults perFile to false when --per-file is not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.perFile).toBe(false);
  });

  it("sets perFile=true when --per-file is provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--per-file", "--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.perFile).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// --repo-name and --repo-url
// ---------------------------------------------------------------------------

describe("parseArgs – --repo-name and --repo-url", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });
  it("returns repoName from --repo-name", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--repo-name", "my-override", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.repoName).toBe("my-override");
  });

  it("returns repoUrl from --repo-url", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv(
      "--ref",
      "main",
      "--repo-url",
      "https://example.com/repo",
      "--output-dir",
      repoDir,
      repoDir,
    );
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.repoUrl).toBe("https://example.com/repo");
  });

  it("repoName and repoUrl default to undefined when not provided", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.repoName).toBeUndefined();
    expect(parsed.repoUrl).toBeUndefined();
  });

  it("repoName and repoUrl can be provided independently", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--repo-name", "only-name", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.repoName).toBe("only-name");
    expect(parsed.repoUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unknown option rejection
// ---------------------------------------------------------------------------

describe("parseArgs – unknown option rejection", () => {
  it("returns user-error termination for an unknown option", async () => {
    setArgv("--unknown-flag", "--ref", "main", ".");
    await expectUserErrorTermination(parseArgs(noopAdapter), "Unknown option: --unknown-flag");
  });

  it("returns user-error termination for a typo resembling a known option", async () => {
    setArgv("--rotaet-lines", "100", "--ref", "main", ".");
    await expectUserErrorTermination(parseArgs(noopAdapter), "Unknown option: --rotaet-lines");
  });

  it("does not reject tokens after -- as unknown options", async () => {
    setArgv("--ref", "main", ".", "--", "--ignored");
    const result = await parseArgs(noopAdapter);
    if (result.kind === "termination" && result.termination.kind === "user-error") {
      expect(result.termination.message).not.toContain("Unknown option: --ignored");
    }
  });

  it("returns success termination for --help", async () => {
    setArgv("--help");
    await expectSuccessTermination(parseArgs(noopAdapter));
  });
});

// ---------------------------------------------------------------------------
// Parser schema validation boundary
// ---------------------------------------------------------------------------

describe("parseArgs – schema validation boundary", () => {
  let repoDir: string;

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("converts parsed option shape errors to user-error termination", async () => {
    repoDir = await makeRealRepo();
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);

    vi.spyOn(program, "opts").mockReturnValueOnce({
      ...program.opts(),
      ref: "main",
    } as never);

    await expectUserErrorTermination(
      parseArgs(adapter),
      "Invalid input: expected array, received string",
    );
  });
});

// ---------------------------------------------------------------------------
// --config
// ---------------------------------------------------------------------------

describe("parseArgs – --config", () => {
  let repoDir: string;
  let configFile: string;

  beforeEach(async () => {
    repoDir = await makeRealRepo();
    configFile = join(repoDir, "gitlode.config.json");
    await writeFile(
      configFile,
      JSON.stringify({ version: 1, extensions: { "my-plugin": { entrypoint: "./plugin.js" } } }),
    );
  });

  afterEach(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true });
  });

  it("defaults configPath to undefined when --config is not provided", async () => {
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.configPath).toBeUndefined();
  });

  it("resolves --config to an absolute path", async () => {
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, "-c", configFile, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.configPath).toBe(configFile);
  });

  it("accepts -c as alias for --config", async () => {
    const adapter = makeRealAdapter();
    setArgv("--ref", "main", "--output-dir", repoDir, "-c", configFile, repoDir);
    const parsed = expectParsed(await parseArgs(adapter));
    expect(parsed.configPath).toBeDefined();
  });

  it("returns user-error termination when config file does not exist", async () => {
    const adapter = makeRealAdapter();
    setArgv(
      "--ref",
      "main",
      "--output-dir",
      repoDir,
      "--config",
      join(repoDir, "nonexistent.json"),
      repoDir,
    );
    await expectUserErrorTermination(
      parseArgs(adapter),
      `Config file not found: ${join(repoDir, "nonexistent.json")}`,
    );
  });
});
