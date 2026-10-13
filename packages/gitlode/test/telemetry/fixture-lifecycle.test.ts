import { writeSync } from "node:fs";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { validateRequalification } from "../../scripts/tooling/fixture-requalification.js";
import { supervisePerformance } from "../../scripts/tooling/performance-supervisor.js";
import { fixtureGitEnvironment, foregroundMaintenanceConfig } from "../support/fixture-git.js";
import {
  FixtureLifecycle,
  fixtureGit,
  fixtureIdentity,
  validateFixtureLinks,
  type FixtureLink,
} from "../support/fixture-lifecycle.js";
import { createPerformanceRepository } from "../support/performance-fixtures.js";
import type { RawRun } from "../support/performance-harness.js";
import { TestFixtureOwner, disposeTestFixtures } from "../support/test-fixture-owner.js";
const owners: TestFixtureOwner[] = [];
const c2Lifetimes: TestFixtureOwner[] = [];
let sourceOwner: TestFixtureOwner;
let suiteHadFailure = false;
afterEach(async (context) => {
  suiteHadFailure ||= !!context.task.result?.errors?.length;
  await disposeTestFixtures(owners, !!context.task.result?.errors?.length);
});

let root: string;
let repository: string;
let ordinal = 0;
beforeAll(async () => {
  sourceOwner = new TestFixtureOwner(new AbortController().signal);
  await sourceOwner.run(async () => {
    root = await mkdtemp(join(tmpdir(), "gitlode-fixture-lifecycle-test-"));
    sourceOwner.root(root);
    repository = join(root, "source");
    await createPerformanceRepository(
      repository,
      "commit_heavy_repository",
      {
        commits: 6,
        files: 1,
        rotations: 1,
        plugins: 0,
        scale: 0,
      },
      sourceOwner,
    );
  });
});
afterAll(async () => {
  if (c2Lifetimes.some((owner) => !owner.quiescent)) {
    try {
      writeSync(2, `Retained C2 source root after unconfirmed body settlement: ${root}\n`);
    } catch {
      /* Preserve primary error. */
    }
    return;
  }
  if (sourceOwner) await disposeTestFixtures([sourceOwner], suiteHadFailure);
});
async function prepared(owner?: TestFixtureOwner) {
  let parent = root;
  if (owner) {
    owner.check();
    parent = await mkdtemp(join(tmpdir(), "gitlode-c2-owned-"));
    owner.root(parent);
    owner.check();
  }
  const index = ordinal++;
  const directory = join(parent, `repository-${index}`);
  if (owner) await owner.work(() => cp(repository, directory, { recursive: true }));
  else await cp(repository, directory, { recursive: true });
  const lifecycle = new FixtureLifecycle(directory, join(parent, `evidence-${index}`), owner);
  await lifecycle.prepare();
  return lifecycle;
}

describe("controlled fixture lifecycle", () => {
  it.for(["device", "type", "operation", "duplicate", "embedded", "substitution"])(
    "C2 rejects inconsistent stored evidence: %s",
    async (mode, context) => {
      const owner = new TestFixtureOwner(context.signal);
      owners.push(owner);
      c2Lifetimes.push(owner);
      return await owner.run(async () => {
        const lifecycle = await prepared(owner);
        const first = await lifecycle.capture("cli-0", async () => null);
        const second = await lifecycle.capture("cli-1", async () => null);
        await lifecycle.finalize();
        const evidence = structuredClone(lifecycle.evidence());
        const post = evidence.boundaries[2]!;
        if (mode === "device" || mode === "type")
          Object.assign(post.identity.filesystem, { [mode]: 999 });
        if (mode === "operation") Object.assign(post, { label: "sidecar-99-post" });
        if (mode === "duplicate") Object.assign(evidence.boundaries[3]!, { id: post.id });
        if (mode === "embedded") Object.assign(post.identity, { layoutDigest: "wrong" });
        expect(
          validateFixtureLinks(
            [mode === "substitution" ? second.fixtureLink : first.fixtureLink],
            evidence,
            ["cli-0"],
          ).length,
        ).toBeGreaterThan(0);
      });
    },
  );
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

  it.skipIf(process.platform !== "linux").each([true, false])(
    "completes forced low-threshold automatic maintenance in the foreground: enabled=%s",
    async (enabled) => {
      const index = ordinal++;
      const directory = join(root, `maintenance-${index}`);
      await cp(repository, directory, { recursive: true });
      await fixtureGit(directory, ["repack", "-d"]);
      await writeFile(join(directory, "new-object.txt"), "low threshold maintenance test\n");
      await fixtureGit(directory, ["add", "new-object.txt"]);
      await fixtureGit(directory, ["commit", "-m", "reachable low threshold test input"]);
      await fixtureGit(directory, ["repack", "-d"]);
      expect(await fixtureGit(directory, ["count-objects", "-v"])).toContain("packs: 2");
      const trace = join(root, `maintenance-trace-${index}.jsonl`);
      const snapshot = join(root, `maintenance-return-${index}.json`);
      // Git 2.54 changed the default strategy to geometric. This gc-specific threshold
      // probe must select gc explicitly without changing the production fixture recipe.
      const config = [
        ...foregroundMaintenanceConfig,
        "-c",
        "maintenance.strategy=gc",
        "-c",
        `maintenance.auto=${enabled}`,
        "-c",
        "gc.autoPackLimit=1",
        "-c",
        "gc.auto=1",
      ];
      const worker = join(root, `maintenance-worker-${index}.cjs`);
      await writeFile(
        worker,
        `const {execFileSync}=require('node:child_process');
const {readFileSync,writeFileSync}=require('node:fs');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));
Object.assign(env,{TZ:'UTC',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'});
const options={cwd:${JSON.stringify(directory)},env,encoding:'utf8'};
const config=${JSON.stringify(config)};
const configuration=execFileSync('git',[...config,'config','--show-origin','--show-scope','--list'],options);
options.env.GIT_TRACE2_EVENT=${JSON.stringify(trace)};
execFileSync('git',[...config,'commit','--allow-empty','-m','bounded maintenance test'],options);
// Freeze completion evidence immediately on command return, before supervisor cleanup.
writeFileSync(${JSON.stringify(snapshot)},JSON.stringify({configuration,trace:readFileSync(${JSON.stringify(trace)},'utf8'),objects:execFileSync('git',['count-objects','-v'],{...options,env:{...options.env,GIT_TRACE2_EVENT:'0'}})}));
process.send({type:'performance-finished',exitCode:0},()=>process.disconnect());`,
      );
      const supervised = await supervisePerformance({
        executable: process.execPath,
        args: [worker],
        artifacts: join(root, `maintenance-supervision-${index}`),
      });
      expect(supervised.exitCode).toBe(0);
      const evidence = JSON.parse(await readFile(supervised.artifactPath, "utf8"));
      expect(evidence.cleanupConfirmed).toBe(true);
      const returned = JSON.parse(await readFile(snapshot, "utf8"));
      for (const setting of [
        "maintenance.autodetach=false",
        "gc.autodetach=false",
        "maintenance.strategy=gc",
        `maintenance.auto=${enabled}`,
        "gc.autopacklimit=1",
        "gc.auto=1",
      ])
        expect(returned.configuration).toContain(setting);
      const events = (returned.trace as string)
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const maintenance = events.filter(
        (event) => event.event === "child_start" && event.argv?.includes("maintenance"),
      );
      expect(maintenance).toHaveLength(enabled ? 1 : 0);
      if (enabled) {
        expect(maintenance[0].argv).toContain("--auto");
        for (const command of ["maintenance", "gc", "repack"]) {
          const start = events.findIndex(
            (event) => event.event === "child_start" && event.argv?.includes(command),
          );
          expect(start, `${command} activation before command return`).toBeGreaterThanOrEqual(0);
          const child = events[start];
          const end = events.findIndex(
            (event, position) =>
              position > start &&
              event.event === "child_exit" &&
              event.sid === child.sid &&
              event.child_id === child.child_id &&
              event.code === 0,
          );
          expect(end, `${command} successful completion before command return`).toBeGreaterThan(
            start,
          );
        }
      }
      expect(returned.objects).toContain(`packs: ${enabled ? 1 : 2}`);
      expect(await fixtureGit(directory, ["count-objects", "-v"])).toContain(
        `packs: ${enabled ? 1 : 2}`,
      );
      expect((await fixtureIdentity(directory)).logical.count).toBe("8");
    },
  );

  it("validates bounded requalification without renewed minimality", async () => {
    const lifecycle = await prepared();
    const capture = await lifecycle.capture("cli-0", async () => null);
    await lifecycle.finalize();
    // Requalify synthetic timings with distinct bindings derived from one real observed pair.
    const observed = lifecycle.evidence();
    const boundaries = [observed.boundaries[0]!];
    const captures: { fixtureLink: FixtureLink }[] = [];
    for (let index = 0; index < 9; index++) {
      const pre = `${observed.instanceId}-${index * 2 + 1}`;
      const post = `${observed.instanceId}-${index * 2 + 2}`;
      boundaries.push(
        { ...observed.boundaries[1]!, id: pre, label: `cli-${index}-pre` },
        { ...observed.boundaries[2]!, id: post, label: `cli-${index}-post` },
      );
      captures.push({ fixtureLink: { ...capture.fixtureLink, pre, post } });
    }
    boundaries.push({ ...observed.boundaries[3]!, id: `${observed.instanceId}-19` });
    const syntheticEvidence = { ...observed, boundaries };
    const runs = Array.from(
      { length: 9 },
      (_, index) =>
        ({
          phase: index < 2 ? "warmup" : "measured",
          state: "legacy_off",
          exit: { code: 0, signal: null },
          captureErrors: [],
          elapsedMs: 12_000,
          fixtureLink: captures[index]!.fixtureLink,
          pairIndex: index < 2 ? index : index - 2,
          order: "A-B",
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
      lifecycle: syntheticEvidence,
    };
    expect(validateRequalification(input)).toMatchObject({
      status: "eligible-pending-trunk-adoption",
      renewedMinimality: false,
      medianMs: 12_000,
      madMs: 0,
    });
    expect(validateRequalification({ ...input, runs: runs.slice(1) }).exitCode).toBe(2);
    expect(
      validateRequalification({
        ...input,
        runs: runs.map((run, index) =>
          index === 0 ? { ...run, fixtureLink: runs[1]!.fixtureLink } : run,
        ),
      }).exitCode,
    ).toBe(2);
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
