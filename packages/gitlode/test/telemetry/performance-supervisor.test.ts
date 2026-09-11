import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeAtomicJson } from "../../scripts/tooling/atomic-json.js";
import {
  supervisePerformance,
  supervisionOptions,
  SUPERVISION_DEFAULTS,
  type SupervisionPersistence,
} from "../../scripts/tooling/performance-supervisor.js";

const directories: string[] = [];
afterEach(async () => {
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
  it("kills an owned grandchild that ignores TERM when the worker exits first", async () => {
    const result = await run(
      `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'ignore'});process.send({type:'performance-child',pid:child.pid});setTimeout(()=>{${send("execution")}while(true){}},100);`,
    );
    expect(result.evidence.failure).toBe("execution-deadline-exceeded");
    const pid =
      result.evidence.current.pid ??
      result.evidence.events.findLast((event: { progress: { pid?: number } }) => event.progress.pid)
        ?.progress.pid;
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
  });
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
