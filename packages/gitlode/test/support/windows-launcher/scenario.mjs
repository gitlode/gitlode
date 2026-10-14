import assert from "node:assert/strict";
import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";

import { now, cutoff, until, receipt, errorIdentity } from "./deadlines.ts";
import { WindowsLauncher, bounds } from "./launcher.ts";

const [mode, root, git, enclosing] = process.argv.slice(2);
const start = performance.now();
const outerEnd = Number(enclosing);
if (!Number.isFinite(outerEnd)) throw new Error("missing enclosing deadline");
const workEnd = outerEnd - bounds.cleanup;
const host = new WindowsLauncher(mode === "unicode");
let primary;
let secondary;
let unexpected;
const steps = [];
const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
async function file(name) {
  const begin = now(),
    end = cutoff(workEnd, 2000);
  try {
    return await receipt(join(root, name), end, `receipt ${name}`);
  } finally {
    steps.push({
      phase: `receipt ${name}`,
      at: begin,
      elapsedMs: now() - begin,
      ceiling: 2000,
      end,
    });
  }
}
async function phase(body, ms, name) {
  const begin = now(),
    end = cutoff(workEnd, ms);
  try {
    return await until(body, end, name);
  } finally {
    steps.push({ phase: name, at: begin, elapsedMs: now() - begin, ceiling: ms, end });
  }
}
const launch = (...args) => {
  if (now() >= workEnd) throw new Error("inner admission cutoff; retain root");
  return host.launch(...args);
};
try {
  await phase(host.ready, bounds.ready, "inner ready");
  steps.push({
    phase: "ready",
    ms: performance.now() - start,
    compileMs: host.compileMs,
    hostInJob: host.hostInJob,
  });
  if (mode === "unicode") {
    const text = "日本語";
    const command = launch(
      process.execPath,
      [
        "-e",
        "console.log(JSON.stringify({arg:process.argv[1],env:process.env.STAGE_B}));process.stderr.write(process.argv[1])",
        text,
      ],
      root,
      { SystemRoot: process.env.SystemRoot, STAGE_B: text },
    );
    const result = await phase(command.completion, 4000, "non-ASCII round trip");
    assert.equal(result.code, 0);
    assert.equal(result.absent, true);
    assert.deepEqual(JSON.parse(result.stdout.toString("utf8")), { arg: text, env: text });
    assert.deepEqual(
      result.stdout,
      Buffer.from(JSON.stringify({ arg: text, env: text }) + "\n", "utf8"),
    );
    assert.deepEqual(result.stderr, Buffer.from(text, "utf8"));
    steps.push({
      phase: "exact Unicode bytes and completion",
      splitRequest: true,
      absent: result.absent,
    });
  } else if (mode === "transport") {
    const args = ["space value", 'a"b', "trailing\\", "", '\\\\"', "日本語"];
    const command = launch(
      process.execPath,
      [
        "-e",
        "console.log(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd(),env:process.env.STAGE_B}));process.stderr.write('error identity');process.exitCode=7",
        ...args,
      ],
      root,
      { ...process.env, STAGE_B: 'space 日本語 " \\' },
    );
    const result = await phase(command.completion, 4000, "transport");
    assert.equal(result.code, 7);
    assert.equal(result.absent, true);
    const parsed = JSON.parse(result.stdout.toString());
    assert.deepEqual(parsed.args, args);
    assert.equal(parsed.cwd, root);
    assert.equal(parsed.env, 'space 日本語 " \\');
    assert.equal(result.stderr.toString(), "error identity");
    const output = await phase(
      launch(
        process.execPath,
        ["-e", "process.stdout.write('x'.repeat(100000));process.stderr.write('y'.repeat(100000))"],
        root,
      ).completion,
      4000,
      "bounded output",
    );
    assert.equal(output.stdout.length, 65536);
    assert.equal(output.stderr.length, 65536);
    assert.equal(output.stdout.toString(), "x".repeat(65536));
    assert.equal(output.stderr.toString(), "y".repeat(65536));
    const version = await phase(launch(git, ["--version"], root).completion, 4000, "real Git");
    assert.equal(version.code, 0);
    assert.match(version.stdout.toString(), /^git version /);
    steps.push({ phase: "git", version: version.stdout.toString().trim() });
  } else if (mode === "launch-races") {
    const missing = launch(join(root, "missing.exe"), [], root);
    await assert.rejects(phase(missing.completion, 2000, "missing executable"), /Win32Exception/);
    for (let i = 0; i < 3; i++) {
      const child = launch(process.execPath, ["-e", "setInterval(()=>{},1000)"], root);
      child.cancel();
      child.cancel();
      const result = await phase(child.completion, 2000, "abort registration race");
      assert.equal(result.absent, true);
      assert.equal(result.code, 123);
    }
  } else {
    const normal = mode === "orphan-normal";
    const child = launch(
      process.execPath,
      [join(import.meta.dirname, "workload.mjs"), "leader", root, normal ? "normal" : "hold"],
      root,
    );
    let completed = false;
    void child.completion.then(
      () => {
        completed = true;
      },
      () => {},
    );
    const leader = await file("leader.json"),
      intermediate = await file("intermediate.json"),
      descendant = await file("descendant.json");
    assert.equal(intermediate.parent, leader.pid);
    assert.equal(descendant.parent, intermediate.pid);
    const leaderExit = await file("leader-exit.json"),
      intermediateExit = await file("intermediate-exit.json");
    const leaderSpawn = await file("leader-spawn.json"),
      intermediateSpawn = await file("intermediate-spawn.json");
    assert.equal(leaderExit.pid, leader.pid);
    assert.equal(leaderExit.code, 0);
    assert.equal(intermediateExit.pid, intermediate.pid);
    assert.equal(intermediateExit.code, 0);
    assert.equal(leaderSpawn.pid, intermediate.pid);
    assert.equal(intermediateSpawn.pid, descendant.pid);
    if (now() + 100 >= workEnd) throw new Error("orphan delay cutoff; retain root");
    await wait(100);
    assert.equal(completed, false);
    assert.equal(host.exits.get(child.id), 0);
    steps.push({
      phase: "established orphan",
      leader,
      intermediate,
      descendant,
      leaderExit,
      intermediateExit,
      leaderSpawn,
      intermediateSpawn,
    });
    if (normal) {
      const result = await phase(child.completion, 3000, "normal descendant");
      assert.equal(result.absent, true);
      assert.equal(result.code, 0);
      assert.equal(result.stdout.length, 0);
      assert.equal(result.stderr.length, 0);
      await file("settled.json");
    } else if (mode === "orphan-cancel") {
      child.cancel();
      const result = await phase(child.completion, 2000, "cancel descendant");
      assert.equal(result.absent, true);
      assert.equal(result.stdout.length, 0);
      assert.equal(result.stderr.length, 0);
    } else if (mode === "driver-cleanup") {
      // The inner driver abandons disposal while the outer job still owns host and orphan.
      try {
        throw new Error(`stage-b-body:${mode}`);
      } catch (error) {
        primary = error;
      }
      await writeFile(
        join(root, "driver-abandoned.json"),
        JSON.stringify({
          primary: errorIdentity(primary),
          retained: true,
          fault: "runner-timeout-armed",
        }),
      );
      // Keep this runner alive for the independent owner to reach a controlled deadline and cancel it.
      await new Promise(() => {});
    } else {
      try {
        throw new Error(`stage-b-body:${mode}`);
      } catch (error) {
        primary = error;
      }
      if (mode === "observation-loss") child.denyObservation();
      else if (mode === "host-death") assert.equal(host.host.kill(), true);
      else if (mode === "malformed") host.host.stdin.write('{"kind":"unsupported"}\n');
      else throw new Error("unknown mode");
      await assert.rejects(
        phase(child.completion, 2000, "fault settlement"),
        /retain root|host lost/,
      );
      if (mode === "observation-loss")
        assert(host.faultReceipts.some((r) => r.kind === "injected" && r.phase === mode));
      if (mode === "malformed")
        assert(host.faultReceipts.some((r) => r.kind === "fatal" && r.phase === "control-kind"));
      steps.push({
        phase: "fault injection reached",
        mode,
        primary: errorIdentity(primary),
        receipts: host.faultReceipts,
      });
      try {
        await host.dispose(outerEnd);
      } catch (error) {
        secondary = error;
      }
      assert(secondary instanceof Error);
      await access(root);
      steps.push({
        phase: "uncertainty retains root",
        primary: errorIdentity(primary),
        secondary: errorIdentity(secondary),
      });
      assert.equal(host.host.exitCode === null && host.host.signalCode === null, false);
      await writeFile(
        join(root, "scenario.json"),
        JSON.stringify({
          mode,
          steps,
          elapsedMs: performance.now() - start,
          retained: true,
          uncertain: true,
          primary: errorIdentity(primary),
          secondary: errorIdentity(secondary),
          cutoffs: { outerEnd, workEnd },
          events: host.events,
        }),
      );
      process.exit(0);
    }
  }
} catch (error) {
  if (primary) unexpected = error;
  else primary = error;
}
try {
  await host.dispose(outerEnd);
} catch (error) {
  secondary = error;
  primary ??= error;
}
await writeFile(
  join(root, "scenario.json"),
  JSON.stringify({
    mode,
    steps,
    elapsedMs: performance.now() - start,
    compileMs: host.compileMs,
    retained: Boolean(primary),
    primary: errorIdentity(primary),
    unexpected: unexpected ? errorIdentity(unexpected) : undefined,
    secondary: secondary ? errorIdentity(secondary) : undefined,
    cutoffs: { outerEnd, workEnd },
    events: host.events,
  }),
);
if (unexpected || primary) throw unexpected ?? primary;
