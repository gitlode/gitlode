import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { writeAtomicJson } from "../../scripts/tooling/atomic-json.js";
import * as processGroup from "../../scripts/tooling/performance-process-group.js";
import {
  supervisePerformance,
  supervisionOptions,
  SUPERVISION_DEFAULTS,
  type SupervisionPersistence,
} from "../../scripts/tooling/performance-supervisor.js";

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function run(
  script: string,
  overrides: Partial<typeof limits> = {},
  persistence: Partial<SupervisionPersistence> = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "gitlode-supervision-test-"));
  directories.push(directory);
  const worker = join(directory, "worker.cjs");
  await writeFile(worker, script);
  const messages: string[] = [];
  const failures: string[] = [];
  const result = await supervisePerformance({
    executable: process.execPath,
    args: [worker],
    artifacts: directory,
    limits: { ...limits, ...overrides },
    onProgress: (line) => messages.push(line),
    onFailure: (line) => failures.push(line),
    persistence,
  });
  return {
    ...result,
    directory,
    messages,
    failures,
    evidence: JSON.parse(await readFile(result.artifactPath, "utf8")),
  };
}
const limits = {
  ...SUPERVISION_DEFAULTS,
  preparationMs: 3000,
  executionMs: 150,
  processingMs: 150,
  heartbeatMs: 40,
  terminationGraceMs: 80,
  cleanupWaitMs: 500,
  diagnosticBytes: 128,
};
const send = (stage: string, operation = "test-work") =>
  `process.send({type:'performance-stage',progress:{stage:'${stage}',operation:'${operation}',quantity:8,phase:'measured',iteration:1,state:'target_on'}});`;
const complete = (exitCode: number) =>
  `process.send({type:'performance-finished',exitCode:${exitCode}},()=>{process.disconnect();process.exitCode=${exitCode};});`;

describe("supervision options", () => {
  it("separates operational limits from unchanged worker arguments", () => {
    expect(
      supervisionOptions(["measure", "--execution-timeout-ms", "900", "--fixture", "fixture"]),
    ).toEqual({
      limits: { ...SUPERVISION_DEFAULTS, executionMs: 900 },
      workerArgs: ["measure", "--fixture", "fixture"],
    });
  });
  it.each(["0", "-1", "Infinity", "1.5", "2147483648", "", "--fixture"])(
    "rejects invalid deadline %s",
    (value) => {
      expect(() => supervisionOptions(["measure", "--execution-timeout-ms", value])).toThrow(
        /integer/,
      );
    },
  );
});

describe.skipIf(process.platform !== "linux")("Linux process supervision", () => {
  it("requires group quiescence after normal completion rather than signal success", async () => {
    let observations = 0;
    vi.spyOn(processGroup, "observeProcessGroup").mockImplementation((group) => {
      observations++;
      return observations < 4 ? [{ pid: group + 1, group, start: "123", state: "S" }] : [];
    });
    const result = await run(complete(0));
    expect(observations).toBeGreaterThanOrEqual(4);
    expect(result.evidence).toMatchObject({ status: "completed", cleanupConfirmed: true });
  });
  it.each(["live", "observation", "identity", "signal"])(
    "persists cleanup uncertainty on normal completion: %s",
    async (mode) => {
      if (mode === "signal") {
        const kill = process.kill.bind(process);
        vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
          if (pid < 0 && signal === "SIGKILL")
            throw Object.assign(new Error("denied"), { code: "EPERM" });
          return kill(pid, signal);
        });
      } else {
        vi.spyOn(processGroup, "observeProcessGroup").mockImplementation((group) => {
          if (mode === "observation") throw new Error("unreadable");
          return [{ pid: group, group, start: "0", state: "S" }];
        });
        // A distinct PID supplies a genuinely live member without mismatching the leader.
        if (mode === "live")
          vi.mocked(processGroup.observeProcessGroup).mockImplementation((group) => [
            { pid: group + 1, group, start: "123", state: "S" },
          ]);
      }
      const result = await run(complete(0));
      expect(result).toMatchObject({
        exitCode: 2,
        status: "inconclusive",
        failure: "process-cleanup-failed",
      });
      expect(result.evidence.cleanupConfirmed).toBe(false);
      expect(result.evidence.cleanupErrors.length).toBeGreaterThan(0);
      if (mode !== "signal")
        expect(result.evidence.cleanupErrors).toContain("group-quiescence-not-confirmed");
    },
  );
  it("retains the original deadline failure alongside signal errors", async () => {
    const kill = process.kill.bind(process);
    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (pid < 0 && signal === "SIGKILL")
        throw Object.assign(new Error("denied"), { code: "EPERM" });
      return kill(pid, signal);
    });
    const result = await run(`${send("execution")}setInterval(()=>{},1000);`);
    expect(result.evidence).toMatchObject({
      failure: "execution-deadline-exceeded",
      cleanupConfirmed: false,
      cleanupErrors: ["group-SIGKILL-failed"],
    });
    expect(result.exitCode).toBe(2);
  });
  it("returns finite uncertainty even when observation prevents signaling a live worker", async () => {
    const identify = processGroup.processIdentity;
    let identity: processGroup.ProcessIdentity | undefined;
    vi.spyOn(processGroup, "processIdentity").mockImplementation((pid) => {
      identity = identify(pid);
      return identity;
    });
    vi.spyOn(processGroup, "observeProcessGroup").mockImplementation(() => {
      throw new Error("injected unreadable process table");
    });
    try {
      const result = await run(`${send("execution")}setInterval(()=>{},1000);`);
      expect(result.evidence).toMatchObject({
        status: "inconclusive",
        failure: "execution-deadline-exceeded",
        cleanupConfirmed: false,
      });
      expect(result.evidence.cleanupErrors).toContain("worker-close-not-observed");
      expect(result.evidence.cleanupErrors).toContain("group-quiescence-not-confirmed");
    } finally {
      vi.restoreAllMocks();
      if (identity) {
        // This test deliberately denies cleanup; reclaim only its captured owned identity.
        const current = identify(identity.pid);
        expect(current.start).toBe(identity.start);
        expect(current.group).toBe(identity.group);
        const group = new processGroup.GroupCompletion(identity);
        const errors: string[] = [];
        expect(
          await processGroup.completeProcessGroup({
            budgetMs: limits.cleanupWaitMs,
            force: () => {
              process.kill(-current.group, "SIGKILL");
            },
            observe: () => group.observe(processGroup.observeProcessGroup(current.group)),
            closed: () => true,
            errors,
          }),
        ).toBe(true);
      }
    }
  });
  it.each([0, 2])(
    "keeps a completed workflow exit %i distinct from performance acceptance",
    async (code) => {
      const result = await run(`${send("processing")}${complete(code)}`);
      expect(result.exitCode).toBe(code);
      expect(result.evidence).toMatchObject({
        status: "completed",
        finishedCode: code,
        performanceAcceptance: "consult-formal-artifacts",
      });
    },
  );
  it("turns a final diagnostic-log write failure into persisted inconclusive evidence", async () => {
    const result = await run(complete(0), {}, { writeDiagnostic: async () => Promise.reject() });
    expect(result).toMatchObject({
      exitCode: 2,
      status: "inconclusive",
      failure: "final-diagnostic-write-failed",
      terminalEvidenceSaved: true,
    });
    expect(result.evidence).toMatchObject({
      status: "inconclusive",
      failure: "final-diagnostic-write-failed",
      finalizationErrors: ["final-diagnostic-write-failed"],
      diagnostics: { saved: false },
      finishedCode: 0,
    });
    expect(result.failures).toEqual(["[performance] final diagnostic log write failed"]);
  });
  it("retries a failed final snapshot once as terminal inconclusive evidence", async () => {
    let rejected = false;
    const result = await run(
      complete(0),
      {},
      {
        writeSnapshot: async (directory, name, value) => {
          if ((value as { status?: string }).status !== "running" && !rejected) {
            rejected = true;
            throw new Error("injected final snapshot failure");
          }
          await writeAtomicJson(directory, name, value);
        },
      },
    );
    expect(result).toMatchObject({
      exitCode: 2,
      status: "inconclusive",
      failure: "final-snapshot-write-failed",
      terminalEvidenceSaved: true,
    });
    expect(result.evidence).toMatchObject({
      status: "inconclusive",
      failure: "final-snapshot-write-failed",
      finalizationErrors: ["final-snapshot-write-failed"],
      diagnostics: { saved: true },
      finishedCode: 0,
    });
    expect(result.failures).toHaveLength(1);
  });
  it("returns exit 2 with bounded reporting when terminal snapshot storage stays unwritable", async () => {
    let terminalAttempts = 0;
    const result = await run(
      complete(0),
      {},
      {
        writeSnapshot: async (directory, name, value) => {
          if ((value as { status?: string }).status !== "running") {
            terminalAttempts++;
            throw new Error("injected persistent terminal snapshot failure");
          }
          await writeAtomicJson(directory, name, value);
        },
      },
    );
    expect(result).toMatchObject({
      exitCode: 2,
      status: "inconclusive",
      failure: "final-snapshot-write-failed",
      terminalEvidenceSaved: false,
    });
    expect(terminalAttempts).toBe(2);
    expect(result.evidence.status).toBe("running");
    expect(result.failures).toEqual([
      "[performance] final supervision snapshot write failed; attempting recovery once",
      "[performance] terminal supervision snapshot recovery failed; no terminal artifact saved",
    ]);
    expect(result.failures.join("\n").length).toBeLessThan(300);
  });
  it.each(["preparation", "execution", "processing"])(
    "bounds a stalled %s stage even if the worker event loop blocks",
    async (stage) => {
      const result = await run(`${send(stage)} while(true) {}`, { preparationMs: 250 });
      expect(result.exitCode).toBe(2);
      expect(result.evidence).toMatchObject({
        status: "inconclusive",
        failure: `${stage}-deadline-exceeded`,
        current: { stage, quantity: 8, iteration: 1 },
      });
      expect(result.messages.length).toBeGreaterThan(1);
    },
  );
  it("does not extend a deadline for repeated PID notifications", async () => {
    const result = await run(
      `${send("execution")}setInterval(()=>process.send({type:'performance-child',pid:process.pid}),10);`,
    );
    expect(result.evidence.failure).toBe("execution-deadline-exceeded");
    expect(result.evidence.stageElapsedMs).toBeLessThan(1500);
  });
  it("retains bounded diagnostics and existing completed evidence on abrupt failure", async () => {
    const result = await run(
      `require('node:fs').writeFileSync(require('node:path').join(process.env.GITLODE_PERFORMANCE_ARTIFACTS,'completed-pilot.json'),'{}');process.stderr.write('x'.repeat(4096));setTimeout(()=>process.exit(1),30);`,
    );
    expect(result.evidence).toMatchObject({
      status: "inconclusive",
      failure: "worker-exited-without-completion",
    });
    expect(result.evidence.diagnostics.retainedBytes).toBe(128);
    expect(result.evidence.diagnostics.droppedBytes).toBeGreaterThan(0);
    expect(
      (await readFile(join(result.directory, result.evidence.diagnostics.filename))).length,
    ).toBe(128);
    expect(await readFile(join(result.directory, "completed-pilot.json"), "utf8")).toBe("{}");
    expect(JSON.stringify(result.evidence)).not.toContain(result.directory);
  });
  it.each(["worker-first", "worker-last", "normal-completion"])(
    "cleans a ready TERM-resistant grandchild: %s",
    async (order) => {
      const result = await run(
        `const {spawn}=require('node:child_process');
      ${order === "worker-last" ? "process.on('SIGTERM',()=>{});" : ""}
      const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)"],{stdio:['ignore','ignore','ignore','ipc']});
      child.once('message',()=>{process.send({type:'performance-child',pid:child.pid});child.disconnect();child.unref();${order === "normal-completion" ? complete(0) : `${send("execution")}setInterval(()=>{},1000);`}});`,
      );
      expect(result.evidence.failure).toBe(
        order === "normal-completion" ? undefined : "execution-deadline-exceeded",
      );
      expect(result.evidence.cleanupConfirmed).toBe(true);
      expect(
        processGroup
          .observeProcessGroup(result.evidence.workerPid)
          .filter((member) => member.state !== "Z"),
      ).toEqual([]);
      const pid =
        result.evidence.current.pid ??
        result.evidence.events.findLast(
          (event: { progress: { pid?: number } }) => event.progress.pid,
        )?.progress.pid;
      // The PID message precedes the stage here; use the progress output to locate the owned child.
      const childPid =
        pid ??
        Number(result.messages.find((line) => /child=\d+/.test(line))?.match(/child=(\d+)/)?.[1]);
      expect(childPid).toBeGreaterThan(0);
      let state = "missing";
      try {
        state = (await readFile(`/proc/${childPid}/stat`, "utf8")).split(") ")[1]!.split(" ")[0]!;
      } catch {
        /* A reaped process is already gone. */
      }
      expect(["missing", "Z"]).toContain(state);
    },
  );
  it("rejects malformed stage identity and records an inconclusive result", async () => {
    const result = await run(
      `process.send({type:'performance-stage',progress:{stage:'execution',operation:'/tmp/private-path'}});setInterval(()=>{},1000);`,
    );
    expect(result.evidence.failure).toBe("invalid-stage-message");
    expect(JSON.stringify(result.evidence)).not.toContain("/tmp/private-path");
  });
  it("creates distinct supervision evidence for repeated invocations", async () => {
    const result = await run(complete(0));
    const again = await supervisePerformance({
      executable: process.execPath,
      args: [join(result.directory, "worker.cjs")],
      artifacts: result.directory,
      limits,
    });
    expect(again.artifactPath).not.toBe(result.artifactPath);
    expect(
      (await readdir(result.directory)).filter((name) => /^supervision-.*\.json$/.test(name)),
    ).toHaveLength(2);
  });
  it("records launch failure without waiting for a child that does not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gitlode-supervision-missing-"));
    directories.push(directory);
    const result = await supervisePerformance({
      executable: join(directory, "missing"),
      args: [],
      artifacts: directory,
      limits,
    });
    expect(JSON.parse(await readFile(result.artifactPath, "utf8"))).toMatchObject({
      status: "inconclusive",
      failure: "worker-launch-failed",
    });
  });
});
