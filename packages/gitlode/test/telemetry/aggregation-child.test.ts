import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { buildAggregationCollectorBundle } from "../../src/execution/telemetry/aggregation-collector-bundle.js";

const execFileAsync = promisify(execFile);

async function run(...args: string[]) {
  const outputDirectory = await mkdtemp(join(tmpdir(), "gitlode-aggregation-test-"));
  try {
    const bundle = await buildAggregationCollectorBundle(outputDirectory);
    const result = await execFileAsync(process.execPath, [bundle.path, ...args], {
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
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
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
