import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const child = fileURLToPath(
  new URL("../../scripts/telemetry-aggregation-child.mjs", import.meta.url),
);

async function run(...args: string[]) {
  const result = await execFileAsync(process.execPath, [child, ...args], {
    cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
    windowsHide: true,
  });
  return JSON.parse(result.stdout) as {
    scale: number;
    enabled: boolean;
    report: {
      signalStatus: Record<string, string>;
      spans: unknown[];
      counters: unknown[];
      histograms: unknown[];
      diagnostics: unknown[];
    } | null;
  };
}

describe("built aggregation collector child", () => {
  it("returns a complete enabled report from the built worker telemetry session", async () => {
    const result = await run("--scale", "4", "--profile");
    expect(result).toMatchObject({ scale: 4, enabled: true });
    expect(result.report?.signalStatus).toEqual({
      spans: "complete",
      counters: "complete",
      histograms: "complete",
    });
    expect(result.report?.diagnostics).toEqual([]);
    expect(result.report?.counters.length).toBeGreaterThan(0);
    expect(result.report?.histograms.length).toBeGreaterThan(0);
  });

  it("does not create a report when profiling is disabled", async () => {
    await expect(run("--scale", "4")).resolves.toMatchObject({
      scale: 4,
      enabled: false,
      report: null,
    });
  });
});
