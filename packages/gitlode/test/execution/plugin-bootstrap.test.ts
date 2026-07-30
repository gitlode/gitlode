import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Diagnostic } from "../../src/diagnostics/index.js";
import type { FactProjector } from "../../src/extraction-api/index.js";
import { noopInstrumentation } from "../../src/instrumentation/index.js";
import type { Namespace } from "../../src/plugin-api/index.js";
import type { ProgressEvent } from "../../src/progress/index.js";
import type { AbsoluteDirectoryPath } from "../../src/support/index.js";

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
