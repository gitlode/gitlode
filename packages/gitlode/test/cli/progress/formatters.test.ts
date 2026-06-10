import { describe, expect, it } from "vitest";

import { formatActiveLine, formatDoneLine } from "../../../src/cli/progress/formatters.js";
import type { PhaseSnapshot } from "../../../src/cli/progress/types.js";

describe("formatActiveLine", () => {
  it("formats active line for preparing phase", () => {
    const snapshot: PhaseSnapshot = {
      phase: "preparing",
      startMs: 1000,
      refIndex: 0,
      refCount: 0,
      commitsTraversed: 0,
      recordsWritten: 0,
      bytesWritten: 0,
      nowMs: 1500,
    };
    const line = formatActiveLine(snapshot, "|");
    expect(line).toBe("| Preparing extraction  elapsed 0.5s");
  });

  it("formats active line for extracting phase with branch info", () => {
    const snapshot: PhaseSnapshot = {
      phase: "extracting",
      startMs: 1000,
      refIndex: 1,
      refCount: 3,
      commitsTraversed: 1234,
      recordsWritten: 5678,
      bytesWritten: 987654321,
      nowMs: 2500,
    };
    const line = formatActiveLine(snapshot, "/");
    expect(line).toBe(
      "/ Extracting history  refs 2/3  commits 1,234  records 5,678  written 941.9MB  elapsed 1.5s",
    );
  });

  it("formats active line for finalizing phase", () => {
    const snapshot: PhaseSnapshot = {
      phase: "finalizing",
      startMs: 1000,
      refIndex: 0,
      refCount: 0,
      commitsTraversed: 0,
      recordsWritten: 0,
      bytesWritten: 0,
      nowMs: 3000,
    };
    const line = formatActiveLine(snapshot, "-");
    expect(line).toBe("- Finalizing output  elapsed 2.0s");
  });
});

describe("formatDoneLine", () => {
  it("formats done line for preparing phase", () => {
    const snapshot: PhaseSnapshot = {
      phase: "preparing",
      startMs: 1000,
      refIndex: 0,
      refCount: 0,
      commitsTraversed: 0,
      recordsWritten: 0,
      bytesWritten: 0,
      nowMs: 1500,
    };
    const line = formatDoneLine(snapshot);
    expect(line).toBe("✓ Preparing extraction  elapsed 0.5s");
  });
  it("formats done line for extracting phase with branch info", () => {
    const snapshot: PhaseSnapshot = {
      phase: "extracting",
      startMs: 1000,
      refIndex: 1,
      refCount: 3,
      commitsTraversed: 1234,
      recordsWritten: 5678,
      bytesWritten: 987654321,
      nowMs: 2500,
    };
    const line = formatDoneLine(snapshot);
    expect(line).toBe(
      "✓ Extracting history  refs 3/3  commits 1,234  records 5,678  written 941.9MB  elapsed 1.5s",
    );
  });
  it("formats done line for finalizing phase", () => {
    const snapshot: PhaseSnapshot = {
      phase: "finalizing",
      startMs: 1000,
      refIndex: 0,
      refCount: 0,
      commitsTraversed: 0,
      recordsWritten: 0,
      bytesWritten: 0,
      nowMs: 3000,
    };
    const line = formatDoneLine(snapshot);
    expect(line).toBe("✓ Finalizing output  elapsed 2.0s");
  });
});
