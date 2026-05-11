import { describe, expect, it } from "vitest";

import {
  formatElapsed,
  formatProfileLines,
  formatSummaryLines,
  humanizeBytes,
  ProgressController,
  resolveUiMode,
  type Clock,
  type Scheduler,
  type TerminalSink,
  type UiMode,
} from "../src/cli/progress.js";
import type { ProgressEvent } from "../src/core/index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface SinkRecord {
  type: "writeLine" | "rewriteLine" | "newline";
  text?: string;
}

function makeSink(): TerminalSink & { records: SinkRecord[] } {
  const records: SinkRecord[] = [];
  return {
    records,
    writeLine(text: string) {
      records.push({ type: "writeLine", text });
    },
    rewriteLine(text: string) {
      records.push({ type: "rewriteLine", text });
    },
    newline() {
      records.push({ type: "newline" });
    },
  };
}

function makeClock(initialMs = 0): Clock & { advanceMs: (ms: number) => void } {
  let now = initialMs;
  return {
    nowMs() {
      return now;
    },
    advanceMs(ms: number) {
      now += ms;
    },
  };
}

/** Scheduler that records scheduled callbacks but does NOT auto-fire them. */
function makeScheduler(): Scheduler & {
  tick: () => void;
  cancelCount: number;
} {
  const callbacks: Array<() => void> = [];
  let cancelCount = 0;
  return {
    cancelCount: 0,
    tick() {
      for (const cb of callbacks) cb();
    },
    setInterval(fn, _ms) {
      callbacks.push(fn);
      return () => {
        cancelCount++;
        // capture into outer scope for reads
        (this as { cancelCount: number }).cancelCount = cancelCount;
      };
    },
  };
}

function makeController(mode: UiMode): {
  ctrl: ProgressController;
  sink: ReturnType<typeof makeSink>;
  clock: ReturnType<typeof makeClock>;
  scheduler: ReturnType<typeof makeScheduler>;
} {
  const sink = makeSink();
  const clock = makeClock(1000);
  const scheduler = makeScheduler();
  const ctrl = new ProgressController(sink, clock, scheduler, mode);
  return { ctrl, sink, clock, scheduler };
}

function emit(ctrl: ProgressController, event: ProgressEvent) {
  ctrl.handleEvent(event);
}

// ---------------------------------------------------------------------------
// humanizeBytes
// ---------------------------------------------------------------------------

describe("humanizeBytes", () => {
  it("formats bytes", () => {
    expect(humanizeBytes(0)).toBe("0 B");
    expect(humanizeBytes(512)).toBe("512 B");
    expect(humanizeBytes(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(humanizeBytes(1024)).toBe("1.0 KB");
    expect(humanizeBytes(2048)).toBe("2.0 KB");
    expect(humanizeBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(humanizeBytes(1024 * 1024)).toBe("1.0 MB");
    expect(humanizeBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });

  it("formats gigabytes", () => {
    expect(humanizeBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------

describe("formatElapsed", () => {
  it("formats elapsed time", () => {
    expect(formatElapsed(0)).toBe("0.0s");
    expect(formatElapsed(1000)).toBe("1.0s");
    expect(formatElapsed(1500)).toBe("1.5s");
    expect(formatElapsed(60000)).toBe("60.0s");
  });
});

// ---------------------------------------------------------------------------
// formatSummaryLines
// ---------------------------------------------------------------------------

describe("formatSummaryLines", () => {
  it("starts with 'Extraction complete' header", () => {
    const lines = formatSummaryLines({
      recordsWritten: 0,
      commitsTraversed: 0,
      filesCreated: 0,
      bytesWritten: 0,
      elapsedMs: 0,
      branches: [],
    });
    expect(lines[0]).toBe("Extraction complete");
  });

  it("includes all 6 fields in the correct order", () => {
    const lines = formatSummaryLines({
      recordsWritten: 42,
      commitsTraversed: 10,
      filesCreated: 2,
      bytesWritten: 1024,
      elapsedMs: 3000,
      branches: ["main"],
    });

    const fieldLines = lines.slice(1);
    expect(fieldLines[0]).toMatch(/Records written/);
    expect(fieldLines[1]).toMatch(/Commits traversed/);
    expect(fieldLines[2]).toMatch(/Files created/);
    expect(fieldLines[3]).toMatch(/Bytes written/);
    expect(fieldLines[4]).toMatch(/Elapsed time/);
    expect(fieldLines[5]).toMatch(/Branches/);
  });

  it("label column is padded to 18 characters", () => {
    const lines = formatSummaryLines({
      recordsWritten: 0,
      commitsTraversed: 0,
      filesCreated: 0,
      bytesWritten: 0,
      elapsedMs: 0,
      branches: [],
    });
    // Each field line: "  " + label.padEnd(18) + ": " + value
    for (const line of lines.slice(1)) {
      // Extract the part between leading "  " and ":"
      const match = /^  (.+): /.exec(line);
      expect(match).not.toBeNull();
      expect(match![1]!.length).toBe(18);
    }
  });

  it("uses humanized bytes for Bytes written", () => {
    const lines = formatSummaryLines({
      recordsWritten: 0,
      commitsTraversed: 0,
      filesCreated: 0,
      bytesWritten: 2048,
      elapsedMs: 0,
      branches: [],
    });
    const bytesLine = lines.find((l) => l.includes("Bytes written"));
    expect(bytesLine).toContain("2.0 KB");
  });

  it("shows '(none)' for empty branches", () => {
    const lines = formatSummaryLines({
      recordsWritten: 0,
      commitsTraversed: 0,
      filesCreated: 0,
      bytesWritten: 0,
      elapsedMs: 0,
      branches: [],
    });
    const branchLine = lines.find((l) => l.includes("Branches"));
    expect(branchLine).toContain("(none)");
  });
});

// ---------------------------------------------------------------------------
// resolveUiMode
// ---------------------------------------------------------------------------

describe("resolveUiMode", () => {
  it("quiet overrides TTY", () => {
    expect(resolveUiMode(true, true)).toBe("quiet");
    expect(resolveUiMode(true, false)).toBe("quiet");
  });

  it("TTY → tty-interactive", () => {
    expect(resolveUiMode(false, true)).toBe("tty-interactive");
  });

  it("non-TTY → non-tty-summary", () => {
    expect(resolveUiMode(false, false)).toBe("non-tty-summary");
  });
});

// ---------------------------------------------------------------------------
// ProgressController — tty-interactive mode
// ---------------------------------------------------------------------------

describe("ProgressController (tty-interactive)", () => {
  it("phase-start redraws active line", () => {
    const { ctrl, sink } = makeController("tty-interactive");
    emit(ctrl, { type: "phase-start", phase: "preparing" });

    const rewrites = sink.records.filter((r) => r.type === "rewriteLine");
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]!.text).toMatch(/Preparing extraction/);
  });

  it("phase-end writes done line and newline", () => {
    const { ctrl, sink } = makeController("tty-interactive");
    emit(ctrl, { type: "phase-start", phase: "preparing" });
    emit(ctrl, { type: "phase-end", phase: "preparing" });

    // Last rewriteLine should contain done line (no spinner char at start)
    const rewrites = sink.records.filter((r) => r.type === "rewriteLine");
    const last = rewrites[rewrites.length - 1];
    expect(last?.text).toMatch(/^ {2}Preparing extraction/);

    const newlines = sink.records.filter((r) => r.type === "newline");
    expect(newlines).toHaveLength(1);
  });

  it("heartbeat tick advances spinner and redraws", () => {
    const { ctrl, sink, clock, scheduler } = makeController("tty-interactive");
    emit(ctrl, { type: "phase-start", phase: "extracting" });
    const beforeCount = sink.records.filter((r) => r.type === "rewriteLine").length;

    clock.advanceMs(600); // past the semantic-redraw suppression window (< 100ms)
    scheduler.tick();

    const afterCount = sink.records.filter((r) => r.type === "rewriteLine").length;
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it("warning interrupts active line: newline + warn + redraw", () => {
    const { ctrl, sink } = makeController("tty-interactive");
    emit(ctrl, { type: "phase-start", phase: "extracting" });
    emit(ctrl, { type: "warning", message: "Test warning" });

    const newlines = sink.records.filter((r) => r.type === "newline");
    const writes = sink.records.filter((r) => r.type === "writeLine");
    const rewrites = sink.records.filter((r) => r.type === "rewriteLine");

    expect(newlines).toHaveLength(1);
    expect(writes.some((w) => w.text === "Test warning")).toBe(true);
    // Redraw after the warning
    expect(rewrites.length).toBeGreaterThanOrEqual(2);
  });

  it("extracting-progress: shows branch/commits/records/bytes in active line", () => {
    const { ctrl, sink } = makeController("tty-interactive");
    emit(ctrl, { type: "phase-start", phase: "extracting" });
    emit(ctrl, {
      type: "extracting-progress",
      phase: "extracting",
      branchIndex: 0,
      branchCount: 2,
      commitsTraversed: 5,
      recordsWritten: 3,
      bytesWritten: 2048,
    });

    const rewrites = sink.records.filter((r) => r.type === "rewriteLine");
    const last = rewrites[rewrites.length - 1]!;
    expect(last.text).toMatch(/branch 1\/2/);
    expect(last.text).toMatch(/commits 5/);
    expect(last.text).toMatch(/records 3/);
    expect(last.text).toMatch(/2\.0 KB/);
  });
});

// ---------------------------------------------------------------------------
// formatProfileLines
// ---------------------------------------------------------------------------

describe("formatProfileLines", () => {
  it("returns empty array for empty input", () => {
    expect(formatProfileLines([])).toEqual([]);
  });

  it("starts with 'Profile' header", () => {
    const lines = formatProfileLines([{ name: "elapsed", wallMs: 18.4, workMs: 18.4 }]);
    expect(lines[0]).toBe("Profile");
  });

  it("formats wall and work with 2 decimal places", () => {
    const lines = formatProfileLines([{ name: "elapsed", wallMs: 18.4, workMs: 15.6 }]);
    expect(lines[1]).toContain("wall=");
    expect(lines[1]).toContain("18.40ms");
    expect(lines[1]).toContain("work=");
    expect(lines[1]).toContain("15.60ms");
  });

  it("right-aligns numbers and pads name column", () => {
    const lines = formatProfileLines([
      { name: "elapsed", wallMs: 18.4, workMs: 18.4 },
      { name: "elapsed/planning", wallMs: 1.1, workMs: 1.1 },
    ]);
    // name column: "elapsed/planning" is longer, so "elapsed" must be padded
    expect(lines[1]).toMatch(/^  elapsed\s+: wall=/);
    expect(lines[2]).toMatch(/^  elapsed\/planning\s*: wall=/);
  });
});

// ---------------------------------------------------------------------------
// ProgressController — non-tty-summary mode
// ---------------------------------------------------------------------------

describe("ProgressController (non-tty-summary)", () => {
  it("does not emit rewriteLine", () => {
    const { ctrl, sink } = makeController("non-tty-summary");
    emit(ctrl, { type: "phase-start", phase: "preparing" });
    emit(ctrl, { type: "phase-end", phase: "preparing" });

    const rewrites = sink.records.filter((r) => r.type === "rewriteLine");
    expect(rewrites).toHaveLength(0);
  });

  it("warnings shown via writeLine", () => {
    const { ctrl, sink } = makeController("non-tty-summary");
    emit(ctrl, { type: "warning", message: "Non-TTY warning" });

    const writes = sink.records.filter((r) => r.type === "writeLine");
    expect(writes.some((w) => w.text === "Non-TTY warning")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ProgressController — quiet mode
// ---------------------------------------------------------------------------

describe("ProgressController (quiet)", () => {
  it("quiet: no output for phase events", () => {
    const { ctrl, sink } = makeController("quiet");
    emit(ctrl, { type: "phase-start", phase: "preparing" });
    emit(ctrl, { type: "phase-end", phase: "preparing" });
    emit(ctrl, { type: "phase-start", phase: "extracting" });
    emit(ctrl, {
      type: "extracting-progress",
      phase: "extracting",
      branchIndex: 0,
      branchCount: 1,
      commitsTraversed: 1,
      recordsWritten: 1,
      bytesWritten: 100,
    });
    emit(ctrl, { type: "phase-end", phase: "extracting" });

    expect(sink.records).toHaveLength(0);
  });
});
