import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeProcessGroup,
  GroupCompletion,
} from "../../scripts/tooling/performance-process-group.js";

afterEach(() => vi.useRealTimers());
const leader = { pid: 100, group: 100, start: "20", state: "S" };
const descendant = { pid: 101, group: 100, start: "21", state: "S" };

describe("bounded group completion", () => {
  it("charges signaling and observation to the same cleanup budget", async () => {
    vi.useFakeTimers();
    const errors: string[] = [];
    const result = completeProcessGroup({
      budgetMs: 50,
      force: () => {
        vi.advanceTimersByTime(40);
      },
      observe: () => {
        vi.advanceTimersByTime(10);
        return true;
      },
      closed: () => true,
      errors,
    });
    expect(await result).toBe(false);
    expect(errors).toEqual(["group-quiescence-not-confirmed"]);
  });
  it.each(["worker-first", "worker-last", "normal-completion"])(
    "waits after signal success: %s",
    async (order) => {
      vi.useFakeTimers();
      const errors: string[] = [];
      let closed = order !== "worker-last";
      let live = true;
      const force = vi.fn();
      let returned = false;
      const result = completeProcessGroup({
        budgetMs: 50,
        force,
        observe: () => !live,
        closed: () => closed,
        errors,
      }).then((value) => {
        returned = true;
        return value;
      });
      await vi.advanceTimersByTimeAsync(20);
      expect(returned).toBe(false);
      live = false;
      await vi.advanceTimersByTimeAsync(10);
      expect(returned).toBe(order !== "worker-last");
      closed = true;
      await vi.advanceTimersByTimeAsync(10);
      expect(await result).toBe(true);
      expect(force).toHaveBeenCalledOnce();
      expect(errors).toEqual([]);
    },
  );

  it.each(["live", "signal", "observation", "close"])(
    "returns uncertainty within the original budget: %s",
    async (mode) => {
      vi.useFakeTimers();
      const errors: string[] = [];
      const result = completeProcessGroup({
        budgetMs: 50,
        force: () => {
          if (mode === "signal") throw new Error("signal failure");
        },
        observe: () => {
          if (mode === "observation") throw new Error("unreadable");
          return mode !== "live";
        },
        closed: () => mode !== "close",
        errors,
      });
      await vi.advanceTimersByTimeAsync(50);
      expect(await result).toBe(false);
      expect(errors).toContain(
        mode === "signal" ? "group-SIGKILL-failed" : "group-quiescence-not-confirmed",
      );
      if (mode === "close") expect(errors).toContain("worker-close-not-observed");
      if (mode === "observation") expect(errors).toContain("group-observation-or-identity-failed");
    },
  );

  it("distinguishes zombie, live state, disappearance and identity reuse", () => {
    const group = new GroupCompletion(leader);
    expect(group.observe([descendant])).toBe(false);
    expect(group.observe([{ ...descendant, state: "R" }])).toBe(false);
    expect(group.observe([{ ...descendant, state: "Z" }])).toBe(true);
    expect(group.observe([])).toBe(true);
    expect(() => group.observe([{ ...descendant, start: "99" }])).toThrow("identity-mismatch");
    expect(() => group.observe([{ ...leader, start: "99" }])).toThrow("identity-mismatch");
    expect(() => group.observe([{ ...descendant, group: 999 }])).toThrow("identity-mismatch");
  });
});
