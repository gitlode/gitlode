import { expect, it, vi } from "vitest";

import { now } from "../support/windows-launcher/deadlines.ts";
import { CaseIO } from "../support/windows-launcher/io.mjs";

it.each(["setup mkdir", "scenario read", "scenario copy", "final receipt"])(
  "delayed %s is bounded and remains unknown until joined",
  async (phase) => {
    const io = new CaseIO();
    let finish!: () => void;
    let signal: AbortSignal | undefined;
    const pending = io.run(phase, now() + 20, async (abort) => {
      signal = abort;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    await expect(pending).rejects.toThrow(/settlement unknown/);
    expect(signal?.aborted).toBe(true);
    expect(io.snapshot()).toEqual([{ name: phase, settlement: "pending" }]);
    const later = vi.fn(async () => {});
    await expect(io.run("later launch", now() - 1, later)).rejects.toThrow(/admission cutoff/);
    expect(later).not.toHaveBeenCalled();
    finish();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(io.snapshot()).toEqual([]);
  },
);

it("receipt errors remain secondary to the body failure and permit subsequent cleanup", async () => {
  const io = new CaseIO();
  const body = new Error("original body");
  const receipt = new Error("receipt failure");
  let primary: unknown = body;
  const secondary: unknown[] = [];
  try {
    await io.run("receipt", now() + 50, async () => {
      throw receipt;
    });
  } catch (error) {
    secondary.push(error);
    primary ??= error;
  }
  const cleanup = vi.fn(async () => {});
  await io.run("later cleanup", now() + 50, cleanup);
  expect(primary).toBe(body);
  expect(secondary).toEqual([receipt]);
  expect(cleanup).toHaveBeenCalledOnce();
});
