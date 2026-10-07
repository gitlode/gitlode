import { execFile } from "node:child_process";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Rolldown } from "tsdown";
import { describe, expect, it } from "vitest";

import { buildAggregationCollectorBundle } from "../../scripts/tooling/aggregation-collector-bundle.js";

const execFileAsync = promisify(execFile);

async function run(...args: string[]) {
  const outputDirectory = await mkdtemp(join(tmpdir(), "gitlode-aggregation-test-"));
  try {
    const bundle = await buildAggregationCollectorBundle(outputDirectory);
    const files = (await readdir(outputDirectory, { recursive: true }))
      .filter((file) => /\.(?:js|mjs)$/.test(file))
      .sort();
    const inventory = Buffer.concat(
      await Promise.all(
        files.map(async (file) =>
          Buffer.concat([Buffer.from(file), await readFile(join(outputDirectory, file))]),
        ),
      ),
    );
    expect(bundle.bytesContent.equals(inventory)).toBe(true);
    expect(bundle.bytes).toBe(inventory.byteLength);
    const graph = await Rolldown.rolldown({
      input: bundle.path,
      plugins: [
        {
          name: "aggregation-asset-inspection",
          resolveId(source) {
            if (!source.startsWith(".") && !isAbsolute(source))
              return { id: source, external: true };
            return null;
          },
        },
      ],
    });
    try {
      const emitted = await graph.generate({ format: "esm" });
      const chunks = emitted.output.filter((item) => item.type === "chunk");
      expect(
        chunks.reduce((count, chunk) => count + chunk.dynamicImports.length, 0),
      ).toBeGreaterThan(0);
      for (const chunk of chunks) {
        for (const id of chunk.moduleIds.filter((id) => isAbsolute(id))) {
          expect(files.map((file) => resolve(outputDirectory, file))).toContain(resolve(id));
        }
      }
    } finally {
      await graph.close();
    }
    const result = await execFileAsync(process.execPath, [bundle.path, ...args], {
      cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
      windowsHide: true,
      timeout: 30_000,
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
