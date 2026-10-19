import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ mkdir: vi.fn(), write: vi.fn(), spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: fake.mkdir, writeFile: fake.write }));
vi.mock("node:child_process", () => ({ spawn: fake.spawn }));
const originalExitCode = process.exitCode;
const originalArgv = process.argv;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
  process.argv = originalArgv;
});

function setup() {
  vi.resetModules();
  vi.clearAllMocks();
  process.argv = ["node", "driver.mjs", "evidence"];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "hrtime"] });
  const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  fake.mkdir.mockResolvedValue(undefined);
  fake.write.mockResolvedValue(undefined);
  return { exit, stderr };
}
async function driver() {
  const path = "../support/windows-launcher/driver.mjs";
  return import(path);
}
it("driver arms before initial mkdir and retains its watchdog for unknown pending filesystem work", async () => {
  const { exit, stderr } = setup();
  let finish!: () => void;
  fake.mkdir.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const run = driver();
  await vi.waitFor(() => expect(fake.mkdir).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(256000);
  await run;
  expect(fake.spawn).not.toHaveBeenCalled();
  expect(exit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(4000);
  expect(exit).toHaveBeenCalledWith(1);
  expect(String(stderr.mock.calls[0]![0])).toContain('"settlementUnknown":true');
  finish();
});
it("driver retains final watchdog through a stalled receipt write after observed runner close", async () => {
  const { exit, stderr } = setup();
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
    unref: vi.fn(),
  });
  fake.spawn.mockReturnValue(child);
  let finish!: () => void;
  fake.write.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const run = driver();
  await vi.waitFor(() => expect(fake.spawn).toHaveBeenCalledOnce());
  child.emit("close", 0, null);
  await vi.waitFor(() => expect(fake.write).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(260000);
  await run;
  expect(exit).toHaveBeenCalledWith(1);
  const saved = JSON.parse(String(stderr.mock.calls[0]![0]));
  expect(saved.pendingIO).toContainEqual({ name: "driver receipt", settlement: "pending" });
  expect(saved.retained).toBe(true);
  finish();
});
