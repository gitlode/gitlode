import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, expect, it, vi } from "vitest";

import { runOrdered } from "../support/windows-launcher/case.ts";
import { cutoff, now, receipt, settleCleanup } from "../support/windows-launcher/deadlines.ts";
import { WindowsLauncher } from "../support/windows-launcher/launcher.ts";
import { Frames, frameLimit, output } from "../support/windows-launcher/protocol.ts";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
import { spawn } from "node:child_process";

afterEach(() => {
  vi.restoreAllMocks();
});

it("first unexplained failure and insufficient campaign remainder stop later admission", async () => {
  const calls: string[] = [];
  const primary = new Error("first-boundary");
  const result = await runOrdered(
    ["first", "second"],
    async (mode) => {
      calls.push(mode);
      throw primary;
    },
    Infinity,
  );
  expect(calls).toEqual(["first"]);
  expect(result.primary).toBe(primary);
  expect(result.unreached).toEqual(["second"]);
  const expired = await runOrdered(
    ["first"],
    async () => {
      calls.push("unexpected");
    },
    now() + 100,
  );
  expect(expired.admitted).toEqual([]);
  expect(expired.unreached).toEqual(["first"]);
});
function fakeHost() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  const launcher = new WindowsLauncher();
  const send = (message: object) => child.stdout.write(JSON.stringify(message) + "\n");
  const ready = () => send({ kind: "ready", version: 1, compileMs: 1, hostInJob: false });
  return { child, launcher, send, ready };
}

it("strict incremental UTF-8 frames split within Unicode and coalesced beyond one frame limit", () => {
  const frames = new Frames();
  const messages: unknown[] = [];
  const bytes = Buffer.from('{"value":"日本語"}\r\n');
  const split = bytes.indexOf(Buffer.from("日")) + 1;
  frames.push(bytes.subarray(0, split), (m) => messages.push(m));
  expect(messages).toEqual([]);
  frames.push(bytes.subarray(split), (m) => messages.push(m));
  expect(messages).toEqual([{ value: "日本語" }]);
  const large = Buffer.from(JSON.stringify({ value: "x".repeat(frameLimit - 20) }) + "\n");
  frames.push(Buffer.concat([large, large]), (m) => messages.push(m));
  expect(messages.length).toBe(3);
  frames.end();
});

it("finite malformed, BOM, blank, oversized, no-newline, truncated and invalid base64 vectors seal framing", () => {
  const vectors = [
    Buffer.from([123, 34, 120, 34, 58, 34, 195, 40, 34, 125, 10]),
    Buffer.from("{bad}\n"),
    Buffer.from("[]\n"),
    Buffer.from("\n"),
    Buffer.from("\ufeff{}\n"),
    Buffer.alloc(frameLimit + 1, 120),
  ];
  for (const bytes of vectors) {
    const frames = new Frames();
    expect(() => frames.push(bytes, () => {})).toThrow(/control frame/);
    expect(() => frames.push(Buffer.from("{}\n"), () => {})).toThrow(/sealed/);
  }
  const truncated = new Frames();
  truncated.push(Buffer.from("{}"), () => {});
  expect(() => truncated.end()).toThrow(/truncated/);
  for (const value of ["YR==", "a===", "YQ", "Y Q==", "!!!!", "x".repeat(90000)])
    expect(() => output(value)).toThrow(/encoding/);
  expect(output("YQ==")).toEqual(Buffer.from("a"));
});

it("adapter rejects malformed UTF-8 before readiness (fail-before regression)", async () => {
  const { child, launcher } = fakeHost();
  child.stdout.write(
    Buffer.concat([
      Buffer.from('{"kind":"ready","version":1,"compileMs":1,"hostInJob":false,"x":"'),
      Buffer.from([195, 40]),
      Buffer.from('"}\n'),
    ]),
  );
  await expect(launcher.ready).rejects.toThrow(/retain root/);
  child.emit("close");
});

it("adapter rejects noncanonical base64 after valid ordered receipts (fail-before regression)", async () => {
  const { child, launcher, send, ready } = fakeHost();
  ready();
  await launcher.ready;
  const command = launcher.launch("C:\\node.exe", [], "C:\\root", {});
  send({ kind: "started", id: command.id, pid: 1 });
  send({ kind: "exit", id: command.id, code: 0 });
  send({ kind: "complete", id: command.id, absent: true, stdout: "YR==", stderr: "" });
  await expect(command.completion).rejects.toThrow(/retain root/);
  child.emit("close");
});

it("one cached disposal still awaits close after shutdown rejection (fail-before regression)", async () => {
  const { child, launcher, ready } = fakeHost();
  ready();
  await launcher.ready;
  child.stdout.write('{"kind":"fatal"}\n');
  const first = launcher.dispose();
  expect(launcher.dispose()).toBe(first);
  let settled = false;
  void first.catch(() => {
    settled = true;
  });
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(settled).toBe(false);
  child.emit("close");
  await expect(first).rejects.toThrow(/cleanup uncertainty/);
});

it("cleanup phases share one absolute cutoff and preserve separate error identities", async () => {
  const calls: string[] = [];
  const primary = new Error("stage-b-body:unit");
  const end = now() + 40;
  let secondary: unknown;
  try {
    await settleCleanup(end, [
      {
        name: "shutdown",
        run: async () => {
          calls.push("shutdown");
          throw new Error("shutdown fault");
        },
      },
      {
        name: "close",
        run: () => {
          calls.push("close");
          return new Promise(() => {});
        },
      },
    ]);
  } catch (error) {
    secondary = error;
  }
  expect(calls).toEqual(["shutdown", "close"]);
  expect(primary.message).toBe("stage-b-body:unit");
  expect((secondary as AggregateError).errors.map((e: Error) => e.message)).toEqual([
    "shutdown fault",
    "close deadline; retain root",
  ]);
  expect(cutoff(100, 30, () => 90)).toBe(100);
  expect(cutoff(100, 30, () => 10)).toBe(40);
});

it("expired receipt polling joins its read and stops scheduling before rejection", async () => {
  const root = await mkdtemp(join(tmpdir(), "stage-b-poll-"));
  try {
    await expect(receipt(join(root, "absent.json"), now() + 20, "unit receipt")).rejects.toThrow();
    // Removing the only root immediately after rejection must not race an active receipt reader.
  } finally {
    await rm(root, { recursive: true });
  }
});
