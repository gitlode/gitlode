import type { Diagnostic } from "@gitlode/internal-contracts/diagnostics";
import type { FactProjector } from "@gitlode/internal-contracts/extraction";
import type { ProgressEvent } from "@gitlode/internal-contracts/progress";
import { noopInstrumentation } from "@gitlode/internal-foundation/instrumentation";
import type { AbsoluteDirectoryPath } from "@gitlode/internal-foundation/support";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Namespace } from "../../src/plugin-api/index.js";

const pluginRuntime = vi.hoisted(() => ({
  checkPluginCompatibility: vi.fn(),
  initializePlugins: vi.fn(),
  resolvePluginEntries: vi.fn(),
}));

vi.mock("../../src/plugin-runtime/index.js", () => ({
  ...pluginRuntime,
  EnrichingFactProjector: class EnrichingFactProjector {},
}));

import { buildPluginProjector } from "../../src/execution/plugin-bootstrap.js";

const namespace = "test-plugin" as Namespace;
const pluginEntry = {
  namespace,
  failurePolicy: "skip-fact" as const,
  plugin: { init: vi.fn(), project: vi.fn() },
};
const declarations = {
  [namespace]: { entrypoint: "./plugin.js", failurePolicy: "skip-fact" as const },
};
const baseProjector = {} as FactProjector;

describe("buildPluginProjector reporter wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginRuntime.resolvePluginEntries.mockResolvedValue({
      kind: "resolved",
      entries: [pluginEntry],
    });
  });

  it("routes compatibility and initialization diagnostics separately from plugin phase progress", async () => {
    pluginRuntime.checkPluginCompatibility.mockImplementation(
      async (_entries, _declarations, _baseDirectory, reporter) => {
        reporter.warn("compatibility warning");
      },
    );
    pluginRuntime.initializePlugins.mockImplementation(async (entries, createRuntimeContext) => {
      const context = createRuntimeContext(entries[0]);
      context.warn("initialization warning");
      context.error("initialization error");
      return [{ entry: entries[0], type: "ready" }];
    });

    const progressEvents: ProgressEvent[] = [];
    const diagnostics: Diagnostic[] = [];
    const result = await buildPluginProjector(
      declarations,
      "/plugins" as AbsoluteDirectoryPath,
      baseProjector,
      {
        progressReporter: { emit: (event) => progressEvents.push(event) },
        diagnosticReporter: { report: (diagnostic) => diagnostics.push(diagnostic) },
      },
      noopInstrumentation,
    );

    expect(result.kind).toBe("success");
    expect(progressEvents).toEqual([
      { type: "phase-start", phase: "initializing-plugins" },
      { type: "phase-end", phase: "initializing-plugins" },
    ]);
    expect(diagnostics).toEqual([
      { severity: "warn", message: "compatibility warning" },
      { severity: "warn", message: 'Plugin "test-plugin": initialization warning' },
      { severity: "error", message: 'Plugin "test-plugin": initialization error' },
    ]);
  });
});
