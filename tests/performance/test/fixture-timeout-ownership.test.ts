import { execFile, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, expect, it } from "vitest";

import { createDeterministicRepository } from "../../support/deterministic-repository.js";
import { fixtureExec } from "../../support/fixture-git.js";
import { TestFixtureOwner } from "../../support/test-fixture-owner.js";
import { runRepositoryProfileSidecar } from "../scripts/telemetry-performance.js";
import { FixtureLifecycle } from "../support/fixture-lifecycle.js";
import { createPerformanceRepository } from "../support/performance-fixtures.js";

const execute = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const probe = process.env.GITLODE_FIXTURE_TIMEOUT_PROBE;
const exists = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );
const quantities = { commits: 5, files: 1, plugins: 0, rotations: 1, scale: 0 };
const input = (root: string, workerEntryPath: string) => ({
  cli: join(root, "unused-cli.js"),
  workerEntryPath,
  repository: root,
  config: join(root, "config.json"),
  runId: "ownership-probe",
  fixture: "commit_heavy_repository" as const,
  adapter: "isomorphic-git" as const,
  revision: "probe",
  recipeHash: "probe",
  quantities,
});

if (probe) {
  let owner: TestFixtureOwner;
  let root: string;
  const events: string[] = [];
  afterEach(async (context) => {
    events.push("teardown-start");
    expect(await exists(root)).toBe(true);
    const result = await owner.dispose();
    events.push("disposal-return");
    await writeFile(
      process.env.GITLODE_FIXTURE_TIMEOUT_RESULT!,
      JSON.stringify({
        ...result,
        events,
        errors: context.task.result?.errors?.map((error) => error.message),
      }),
    );
    const expectedRetained = probe.includes("unconfirmed");
    expect(result.removed).toBe(!expectedRetained);
    for (const owned of result.roots) expect(await exists(owned)).toBe(expectedRetained);
    expect(events).not.toContain("new-operation");
    if (!expectedRetained) {
      expect(events.indexOf("body-settled")).toBeLessThan(events.indexOf("disposal-return"));
      expect(events).toContain("io-settled");
    }
  });
  it("owned actual timeout probe", async (context) => {
    owner = new TestFixtureOwner(context.signal, probe === "unconfirmed" ? 100 : 4000);
    return await owner.run(async () => {
      root = await mkdtemp(join(tmpdir(), "gitlode-owned-timeout-"));
      owner.root(root);
      await writeFile(join(root, "config.json"), "{}");
      const entry = join(root, "stall.cjs");
      await writeFile(
        entry,
        probe === "child"
          ? "const {spawn}=require('node:child_process'); const descendant=spawn(process.execPath,['-e','setInterval(() => {}, 1000)'],{stdio:'inherit'}); process.on('SIGTERM',()=>{descendant.once('close',()=>process.exit(0));descendant.kill('SIGTERM');}); setInterval(() => {}, 1000);\n"
          : "setInterval(() => {}, 1000);\n",
      );
      context.signal.addEventListener("abort", () => events.push("cancelled"), { once: true });
      // Already-started I/O deliberately settles after the real runner starts teardown.
      const io = owner.work(async () => {
        await new Promise<void>((done) => {
          context.signal.addEventListener("abort", () => setTimeout(done, 50), { once: true });
        });
        expect(await exists(root)).toBe(true);
        await writeFile(join(root, "settled.txt"), "settled before disposal");
        events.push("io-settled");
      });
      void io.catch(() => undefined);
      let child: Promise<unknown>;
      if (probe.startsWith("sidecar")) {
        if (probe === "sidecar-unconfirmed") {
          const register = owner.child.bind(owner);
          owner.child = (child) => {
            register(child);
            register(new EventEmitter() as ChildProcess);
          };
        }
        child = runRepositoryProfileSidecar({ ...input(root, entry), owner });
      } else if (probe === "unconfirmed") {
        // Controlled unavailable close; no PID is supplied, so no foreign process can be killed.
        owner.child(new EventEmitter() as ChildProcess);
        child = new Promise(() => {});
      } else {
        child = fixtureExec(owner, process.execPath, [entry], { encoding: "utf8" });
      }
      try {
        await child;
        await owner.work(async () => {
          events.push("new-operation");
        });
      } finally {
        await io.catch(() => undefined);
        try {
          await owner.work(async () => {
            events.push("new-operation");
          });
        } catch {
          /* Expected cancellation gate. */
        }
        events.push("body-settled");
      }
    });
  }, 1500);
} else {
  it("retains owned roots when child registration fails without replacing the primary error", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-child-registration-"));
    const owner = new TestFixtureOwner(new AbortController().signal, 100, () => {
      throw new Error("secondary notification failure");
    });
    owner.root(root);
    const primary = new Error("child registration failed");
    let launched: ChildProcess | undefined;
    owner.child = (child) => {
      launched = child;
      throw primary;
    };
    try {
      await expect(
        owner.run(
          async () =>
            await fixtureExec(owner, process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
              encoding: "utf8",
            }),
        ),
      ).rejects.toBe(primary);
      expect((await owner.dispose()).removed).toBe(false);
      expect(await exists(root)).toBe(true);
    } finally {
      if (launched) {
        const close = new Promise<void>((done) => {
          launched!.once("close", done);
        });
        launched.kill();
        await close;
      }
      await rm(root, { recursive: true, force: true });
    }
  });

  it.for(["baseline", "C2"])(
    "stops actual fixture helper operations after cancellation: %s",
    async (mode) => {
      const root = await mkdtemp(join(tmpdir(), "gitlode-helper-cancellation-"));
      const controller = new AbortController();
      const owner = new TestFixtureOwner(controller.signal);
      owner.root(root);
      const primary = new Error("controlled helper cancellation");
      if (mode === "C2")
        await createPerformanceRepository(
          join(root, "repository"),
          "commit_heavy_repository",
          quantities,
        );
      const register = owner.child.bind(owner);
      owner.child = (child) => {
        register(child);
        child.once("close", () => controller.abort(primary));
      };
      try {
        const lifecycle = new FixtureLifecycle(
          join(root, "repository"),
          join(root, "evidence"),
          owner,
        );
        await expect(
          owner.run(async () =>
            mode === "C2"
              ? await lifecycle.prepare()
              : await createDeterministicRepository(root, owner),
          ),
        ).rejects.toBe(primary);
        expect(owner.timeline.filter((event) => event.event === "child-registered")).toHaveLength(
          1,
        );
        expect(
          await exists(
            mode === "C2" ? join(root, "evidence/prepared-repository") : join(root, "alpha.txt"),
          ),
        ).toBe(false);
      } finally {
        expect((await owner.dispose()).removed).toBe(true);
      }
    },
  );

  it("awaits outstanding parallel I/O after the primary operation rejects", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-parallel-settlement-"));
    const owner = new TestFixtureOwner(new AbortController().signal);
    owner.root(root);
    const primary = new Error("first parallel failure");
    let settled = false;
    await expect(
      owner.run(
        async () =>
          await Promise.all([
            owner.work(async () => {
              throw primary;
            }),
            owner.work(async () => {
              await new Promise((done) => {
                setTimeout(done, 50);
              });
              expect(await exists(root)).toBe(true);
              await writeFile(join(root, "settled"), "settled");
              settled = true;
            }),
          ]),
      ),
    ).rejects.toBe(primary);
    expect((await owner.dispose()).removed).toBe(true);
    expect(settled).toBe(true);
    expect(await exists(root)).toBe(false);
  });

  it.for(["child", "sidecar", "unconfirmed", "sidecar-unconfirmed"])(
    "waits or retains at the actual Vitest timeout/teardown boundary: %s",
    { timeout: 20000 },
    async (mode) => {
      const evidence = await mkdtemp(join(tmpdir(), "gitlode-timeout-evidence-"));
      const resultPath = join(evidence, "result.json");
      try {
        let output = "";
        try {
          await execute(
            process.execPath,
            [
              join(repositoryRoot, "node_modules/vitest/vitest.mjs"),
              "run",
              "tests/performance/test/fixture-timeout-ownership.test.ts",
              "-t",
              "owned actual timeout probe",
            ],
            {
              cwd: repositoryRoot,
              timeout: 15000,
              env: {
                ...process.env,
                GITLODE_FIXTURE_TIMEOUT_PROBE: mode,
                GITLODE_FIXTURE_TIMEOUT_RESULT: resultPath,
              },
            },
          );
          throw new Error("nested timeout unexpectedly passed");
        } catch (error) {
          const failure = error as { code?: number; stdout?: string; stderr?: string };
          expect(failure.code).toBe(1);
          output = `${failure.stdout}\n${failure.stderr}`;
        }
        expect(output).toContain("Test timed out in 1500ms");
        expect(output).not.toContain("Hook timed out");
        expect(output).not.toContain("AssertionError");
        process.stderr.write(`Expected nested timeout (${mode}):\n${output}\n`);
        const result = JSON.parse(await readFile(resultPath, "utf8")) as {
          removed: boolean;
          roots: string[];
          events: string[];
          errors: string[];
          diagnostics: string[];
          timeline: { event: string; pid?: number }[];
        };
        process.stderr.write(`Observed timeout ownership (${mode}): ${JSON.stringify(result)}\n`);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("Test timed out");
        expect(result.events).toContain("cancelled");
        expect(result.events).not.toContain("new-operation");
        expect(result.removed).toBe(!mode.includes("unconfirmed"));
        expect(result.roots).toHaveLength(mode.startsWith("sidecar") ? 2 : 1);
        const realChildren = result.timeline.filter(
          (event) => event.event === "child-registered" && event.pid !== undefined,
        );
        for (const child of realChildren) {
          expect(result.timeline).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ event: "child-close", pid: child.pid }),
              expect.objectContaining({ event: "termination-confirmed", pid: child.pid }),
            ]),
          );
        }
        for (const root of result.roots) {
          expect(dirname(root)).toBe(tmpdir());
          expect(await exists(root)).toBe(mode.includes("unconfirmed"));
          // No-PID stubs have ended with the runner; every real owned tree must be confirmed above.
          if (mode.includes("unconfirmed")) await rm(root, { recursive: true, force: true });
        }
      } finally {
        await rm(evidence, { recursive: true, force: true });
      }
    },
  );

  it("preserves a primary error when cleanup notification fails and waits for rejected parallel work", async () => {
    const cancellation = new AbortController();
    const owner = new TestFixtureOwner(cancellation.signal, 100, () => {
      throw new Error("notification failure");
    });
    const root = await mkdtemp(join(tmpdir(), "gitlode-owner-primary-"));
    owner.root(root);
    const primary = new Error("primary failure");
    owner.child(new EventEmitter() as ChildProcess);
    try {
      await expect(
        owner.run(async () => {
          throw primary;
        }),
      ).rejects.toBe(primary);
      const result = await owner.dispose();
      expect(result.removed).toBe(false);
      expect(await exists(root)).toBe(true);
      expect(result.diagnostics).toContain("fixture quiescence unconfirmed; retained owned roots");
      expect(() => owner.work(async () => "new work")).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps no-owner sidecar normal/error cleanup and delegates only explicit owner disposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "gitlode-sidecar-contract-"));
    const controller = new AbortController();
    const owner = new TestFixtureOwner(controller.signal);
    owner.root(root);
    try {
      const entry = join(root, "worker.cjs");
      await writeFile(join(root, "config.json"), "{}");
      // A protocol error exercises shared result parsing, never a fake successful capture.
      await writeFile(
        entry,
        "require('node:worker_threads').parentPort.on('message', () => require('node:worker_threads').parentPort.postMessage({type:'result',result:{kind:'user-error',message:'controlled worker rejection'}}));",
      );
      const normal = await runRepositoryProfileSidecar(input(root, entry));
      expect(normal.status).toBe("inconclusive");
      expect(normal.error).toBe("controlled worker rejection");
      expect(await exists(dirname(normal.outputPath!))).toBe(false);
      const failed = await runRepositoryProfileSidecar(
        input(root, join(root, "missing-worker.js")),
      );
      expect(failed.status).toBe("inconclusive");
      expect(await exists(dirname(failed.outputPath!))).toBe(false);
      const owned = await runRepositoryProfileSidecar({ ...input(root, entry), owner });
      expect(owned.status).toBe("inconclusive");
      expect(await exists(dirname(owned.outputPath!))).toBe(true);
      expect(owner.roots.has(dirname(owned.outputPath!))).toBe(true);
      await createPerformanceRepository(root, "commit_heavy_repository", quantities, owner);
      const successful = await runRepositoryProfileSidecar(
        input(root, join(repositoryRoot, "packages/gitlode/dist/execution/worker-entry.js")),
      );
      expect(successful.status).toBe("available");
      expect(successful.provenance.workerBundleSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(await exists(dirname(successful.outputPath!))).toBe(false);
    } finally {
      expect((await owner.dispose()).removed).toBe(true);
    }
    expect(await exists(root)).toBe(false);
  });

  it("registers a sidecar root during creation cancellation and retains on registration failure", async () => {
    const controller = new AbortController();
    const owner = new TestFixtureOwner(controller.signal);
    const register = owner.root.bind(owner);
    owner.root = (root) => {
      register(root);
      controller.abort(new Error("creation cancelled"));
    };
    await expect(
      runRepositoryProfileSidecar({ ...input(tmpdir(), "unused"), owner }),
    ).rejects.toThrow("creation cancelled");
    expect(owner.roots.size).toBe(1);
    for (const root of owner.roots) {
      expect(await exists(root)).toBe(true);
      expect(await exists(join(root, "output"))).toBe(false);
    }
    expect((await owner.dispose()).removed).toBe(true);
    const failureOwner = new TestFixtureOwner(new AbortController().signal);
    let retained = "";
    const primary = new Error("registration failed");
    failureOwner.root = (root) => {
      retained = root;
      throw primary;
    };
    failureOwner.diagnostic = () => {
      throw new Error("secondary reporting failure");
    };
    await expect(
      runRepositoryProfileSidecar({ ...input(tmpdir(), "unused"), owner: failureOwner }),
    ).rejects.toBe(primary);
    expect(await exists(retained)).toBe(true);
    expect(await exists(join(retained, "output"))).toBe(false);
    // Creation failed before any child or I/O launch; this freshly observed root is quiescent.
    await rm(retained, { recursive: true, force: true });
    expect((await failureOwner.dispose()).removed).toBe(true);
  });
}
