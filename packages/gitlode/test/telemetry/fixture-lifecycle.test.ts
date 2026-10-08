import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateRequalification } from "../../scripts/tooling/fixture-requalification.js";
import { supervisePerformance } from "../../scripts/tooling/performance-supervisor.js";
import { fixtureGitEnvironment } from "../support/fixture-git.js";
import {
  FixtureLifecycle,
  fixtureGit,
  fixtureIdentity,
  validateFixtureLinks,
} from "../support/fixture-lifecycle.js";
import { createPerformanceRepository } from "../support/performance-fixtures.js";
import type { RawRun } from "../support/performance-harness.js";

let root: string;
let repository: string;
let ordinal = 0;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "gitlode-fixture-lifecycle-test-"));
  repository = join(root, "source");
  await createPerformanceRepository(repository, "commit_heavy_repository", {
    commits: 6,
    files: 1,
    rotations: 1,
    plugins: 0,
    scale: 0,
  });
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});
async function prepared() {
  const index = ordinal++;
  const directory = join(root, `repository-${index}`);
  await cp(repository, directory, { recursive: true });
  const lifecycle = new FixtureLifecycle(directory, join(root, `evidence-${index}`));
  await lifecycle.prepare();
  return lifecycle;
}

describe("controlled fixture lifecycle", () => {
  it("queries finished history, persists foreground config and preserves a verified independent copy", async () => {
    const identity = await fixtureIdentity(repository);
    expect(identity.logical.count).toBe("6");
    expect(identity.logical.head).toBe(await fixtureGit(repository, ["rev-parse", "main"]));
    expect(identity.logical.refs).toContain("refs/tags/release-annotated");
    const lifecycle = await prepared();
    const capture = await lifecycle.capture("warmup", async () => "child");
    await lifecycle.finalize();
    expect(capture.value).toBe("child");
    expect(validateFixtureLinks([capture.fixtureLink], lifecycle.evidence())).toEqual([]);
    expect(
      (await fixtureIdentity(join(lifecycle.evidenceDirectory, "prepared-repository")))
        .layoutDigest,
    ).toBe(identity.layoutDigest);
    expect(validateFixtureLinks([undefined], lifecycle.evidence())).toContain(
      "fixture link is missing or mismatched",
    );
    const evidence = structuredClone(lifecycle.evidence());
    Object.assign(evidence.boundaries[1]!.identity, { inventory: [] });
    expect(validateFixtureLinks([capture.fixtureLink], evidence)).toContain(
      "fixture boundary inventory is missing or mismatched",
    );
  });

  it.each([
    ".git/refs/heads/main",
    ".git/objects/pack/injected.pack",
    ".git/objects/01/injected-object",
    ".git/objects/info/commit-graph",
    "alpha.txt",
  ])("stops dependent children and retains first drift evidence for %s", async (path) => {
    const lifecycle = await prepared();
    await mkdir(dirname(join(lifecycle.repository, path)), { recursive: true });
    await writeFile(join(lifecycle.repository, path), "changed bytes\n");
    let called = false;
    await expect(
      lifecycle.capture("next", async () => {
        called = true;
      }),
    ).rejects.toThrow();
    expect(called).toBe(false);
    const failure = await readFile(join(lifecycle.evidenceDirectory, "failure.json"), "utf8");
    await expect(lifecycle.boundary("retry")).rejects.toThrow("already inconclusive");
    expect(await readFile(join(lifecycle.evidenceDirectory, "failure.json"), "utf8")).toBe(failure);
    expect(await readFile(join(root, "source/alpha.txt"), "utf8")).toContain("root");
  });

  it.each([".git/index.lock", ".git/gc.pid", ".git/objects/info/alternates"])(
    "rejects unsafe marker %s",
    async (path) => {
      const lifecycle = await prepared();
      await writeFile(join(lifecycle.repository, path), "unsafe");
      await expect(lifecycle.boundary("unsafe")).rejects.toThrow();
    },
  );

  it("retains the root on evidence persistence failure", async () => {
    const lifecycle = await prepared();
    await rm(lifecycle.evidenceDirectory, { recursive: true });
    await writeFile(lifecycle.evidenceDirectory, "unwritable destination");
    await expect(lifecycle.capture("next", async () => "never")).rejects.toThrow();
    expect((await fixtureIdentity(lifecycle.repository)).logical.count).toBe("6");
  });

  it("removes inherited Git injection without changing unrelated environment", () => {
    const env = fixtureGitEnvironment({
      GIT_DIR: "outside",
      GIT_OBJECT_DIRECTORY: "outside",
      GIT_INDEX_FILE: "outside",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "gc.auto",
      GIT_CONFIG_VALUE_0: "0",
      PATH: "tools",
    });
    expect(env.PATH).toBe("tools");
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_CONFIG_COUNT).toBeUndefined();
    expect(env.GIT_OBJECT_DIRECTORY).toBeUndefined();
    expect(env.GIT_INDEX_FILE).toBeUndefined();
  });

  it.skipIf(process.platform !== "linux")(
    "rejects external links and configuration includes",
    async () => {
      const lifecycle = await prepared();
      const sentinel = join(root, "sentinel");
      await writeFile(sentinel, "outside");
      await symlink(sentinel, join(lifecycle.repository, "external"));
      await expect(lifecycle.boundary("link")).rejects.toThrow("unsafe fixture entry");
      expect(await readFile(sentinel, "utf8")).toBe("outside");
      const included = await prepared();
      await fixtureGit(included.repository, ["config", "include.path", sentinel]);
      await expect(included.boundary("include")).rejects.toThrow();
    },
  );

  it.skipIf(process.platform !== "linux")(
    "completes forced low-threshold automatic maintenance in the foreground",
    async () => {
      const index = ordinal++;
      const directory = join(root, `maintenance-${index}`);
      await cp(repository, directory, { recursive: true });
      await fixtureGit(directory, ["repack", "-d"]);
      await writeFile(join(directory, "new-object.txt"), "low threshold maintenance test\n");
      await fixtureGit(directory, ["add", "new-object.txt"]);
      await fixtureGit(directory, ["commit", "-m", "reachable low threshold test input"]);
      await fixtureGit(directory, ["repack", "-d"]);
      expect(await fixtureGit(directory, ["count-objects", "-v"])).toContain("packs: 2");
      const worker = join(root, `maintenance-worker-${index}.cjs`);
      await writeFile(
        worker,
        `const {execFileSync}=require('node:child_process');const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));env.GIT_CONFIG_NOSYSTEM='1';env.GIT_CONFIG_GLOBAL='/dev/null';execFileSync('git',['-c','maintenance.autoDetach=false','-c','gc.autoDetach=false','-c','gc.autoPackLimit=1','-c','gc.auto=1','commit','--allow-empty','-m','bounded maintenance test'],{cwd:${JSON.stringify(directory)},env});process.send({type:'performance-finished',exitCode:0},()=>process.disconnect());`,
      );
      const supervised = await supervisePerformance({
        executable: process.execPath,
        args: [worker],
        artifacts: join(root, `maintenance-supervision-${index}`),
      });
      expect(supervised.exitCode).toBe(0);
      const evidence = JSON.parse(await readFile(supervised.artifactPath, "utf8"));
      expect(evidence.cleanupConfirmed).toBe(true);
      expect(await fixtureGit(directory, ["count-objects", "-v"])).toContain("packs: 1");
      expect((await fixtureIdentity(directory)).logical.count).toBe("8");
    },
  );

  it("validates bounded requalification without renewed minimality", async () => {
    const lifecycle = await prepared();
    const capture = await lifecycle.capture("synthetic", async () => null);
    await lifecycle.finalize();
    const runs = Array.from(
      { length: 9 },
      (_, index) =>
        ({
          phase: index < 2 ? "warmup" : "measured",
          state: "legacy_off",
          exit: { code: 0, signal: null },
          captureErrors: [],
          elapsedMs: 12_000,
          fixtureLink: capture.fixtureLink,
        }) as unknown as RawRun,
    );
    const input = {
      selection: {
        quantity: 6,
        calibrationSha256: "a".repeat(64),
        manifestSha256: "b".repeat(64),
        protocol: "historical",
        legacyRevision: "c".repeat(40),
      },
      quantity: 6,
      legacyRevision: "c".repeat(40),
      runtimeSha256: "d".repeat(64),
      environment: {
        os: { name: "linux", version: "synthetic" },
        architecture: "x64",
        cpu: { model: "synthetic", logicalCount: 1 },
        totalMemoryBytes: 1024,
        nodeVersion: "22.23.1",
        npmVersion: "10.9.8",
        gitVersion: "2.53.0",
        gitAdapter: "git-cli",
        buildMode: "release-bundled",
        repositoryRevision: "c".repeat(40),
        calibrationTargetRecipeHash: "e".repeat(64),
        benchmarkScriptRevision: "f".repeat(40),
        profileState: "legacy_off",
        warmupCount: 2,
        measuredPairCount: 7,
      },
      runs,
      behaviorErrors: [],
      lifecycle: lifecycle.evidence(),
    };
    expect(validateRequalification(input)).toMatchObject({
      status: "eligible-pending-trunk-adoption",
      renewedMinimality: false,
      medianMs: 12_000,
      madMs: 0,
    });
    expect(validateRequalification({ ...input, runs: runs.slice(1) }).exitCode).toBe(2);
    expect(
      validateRequalification({ ...input, selection: { ...input.selection, quantity: 7 } })
        .exitCode,
    ).toBe(2);
    expect(
      validateRequalification({
        ...input,
        lifecycle: { ...input.lifecycle, status: "inconclusive" },
      }).exitCode,
    ).toBe(2);
    expect(validateRequalification({ ...input, environment: {} }).exitCode).toBe(2);
    expect(
      validateRequalification({
        ...input,
        selection: { ...input.selection, calibrationSha256: "missing" },
      }).exitCode,
    ).toBe(2);
    expect(
      validateRequalification({ ...input, lifecycle: { ...input.lifecycle, protocol: "wrong" } })
        .exitCode,
    ).toBe(2);
    expect(
      validateRequalification({
        ...input,
        runs: runs.map((run) => ({ ...run, elapsedMs: 31_000 })),
      }).exitCode,
    ).toBe(2);
    expect(
      validateRequalification({
        ...input,
        runs: runs.map((run) => ({ ...run, state: "target_off" })),
      }).exitCode,
    ).toBe(2);
    const zero = validateRequalification({
      ...input,
      runs: runs.map((run) => ({ ...run, elapsedMs: 0 })),
    });
    expect(zero.medianMs).toBe(0);
    expect(zero.exitCode).toBe(2);
    expect(
      validateRequalification({
        ...input,
        runs: runs.map((run, index) => ({ ...run, elapsedMs: 12_000 + index * 1000 })),
      }).exitCode,
    ).toBe(2);
  });
});
