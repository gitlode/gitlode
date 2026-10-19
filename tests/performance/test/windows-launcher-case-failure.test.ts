import { expect, it, vi, beforeEach } from "vitest";

import { runCase } from "../support/windows-launcher/case.ts";
import { now } from "../support/windows-launcher/deadlines.ts";

const fake = vi.hoisted(() => ({
  mkdir: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  construct: vi.fn(),
  cancel: vi.fn(),
  dispose: vi.fn(),
  completion: Promise.resolve({
    code: 0,
    absent: true,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
  }),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: fake.mkdir,
  readFile: fake.read,
  writeFile: fake.write,
}));
vi.mock("../support/windows-launcher/launcher.ts", () => ({
  bounds: { ready: 40, operation: 40, cleanup: 20, test: 100 },
  WindowsLauncher: class {
    ready = Promise.resolve();
    events = [];
    constructor() {
      fake.construct();
    }
    launch() {
      return { completion: fake.completion, cancel: fake.cancel };
    }
    dispose = fake.dispose;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  fake.mkdir.mockResolvedValue(undefined);
  fake.read.mockResolvedValue('{"retained":false}');
  fake.write.mockResolvedValue(undefined);
  fake.cancel.mockReset();
  fake.dispose.mockReset().mockResolvedValue(undefined);
  fake.completion = Promise.resolve({
    code: 0,
    absent: true,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
  });
});

it("actual case delayed setup prevents launch, records unknown I/O, and joins a late completion", async () => {
  let finish!: () => void;
  fake.mkdir.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await expect(runCase("unicode", "evidence", now() + 55)).rejects.toThrow(
    /I\/O settlement unknown/,
  );
  expect(fake.construct).not.toHaveBeenCalled();
  const saved = JSON.parse(fake.write.mock.calls[0]![1]);
  expect(saved.pendingIO).toContainEqual({ name: "case mkdir", settlement: "pending" });
  expect(saved.observedOuterAbsence).toBe(false);
  finish();
});

it("actual scenario read cutoff still disposes the owner and retains uncertainty", async () => {
  let finish!: () => void;
  fake.read.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await expect(runCase("unicode", "evidence", now() + 55)).rejects.toThrow(
    /scenario read deadline/,
  );
  expect(fake.dispose).toHaveBeenCalledTimes(2);
  const saved = JSON.parse(fake.write.mock.calls[0]![1]);
  expect(saved.pendingIO).toContainEqual({ name: "scenario read", settlement: "pending" });
  expect(saved.primary.message).toMatch(/settlement unknown/);
  finish();
});

it("actual cancellation, disposal and receipt failures preserve body identity and all secondaries", async () => {
  const body = new Error("original body"),
    cancel = new Error("cancel"),
    dispose = new Error("dispose"),
    receipt = new Error("receipt");
  fake.completion = Promise.reject(body);
  void fake.completion.catch(() => {});
  fake.cancel.mockImplementation(() => {
    throw cancel;
  });
  fake.dispose.mockRejectedValue(dispose);
  fake.write.mockRejectedValue(receipt);
  await expect(runCase("unicode", "evidence")).rejects.toBe(body);
  expect(fake.dispose).toHaveBeenCalledOnce();
  const saved = JSON.parse(fake.write.mock.calls[0]![1]);
  expect(saved.primary.message).toBe("original body");
  expect(saved.secondary.map((error: { message: string }) => error.message)).toEqual([
    "cancel",
    "dispose",
  ]);
});
