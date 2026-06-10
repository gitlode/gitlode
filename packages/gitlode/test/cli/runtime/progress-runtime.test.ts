import { describe, expect, it } from "vitest";

import {
  createStyling,
  type Clock,
  type Scheduler,
  type TerminalSink,
} from "../../../src/cli/progress/index.js";
import { createProgressRuntime } from "../../../src/cli/runtime/index.js";

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

function makeClock(initialMs = 0): Clock {
  const now = initialMs;
  return {
    nowMs() {
      return now;
    },
  };
}

function makeScheduler(): Scheduler {
  return {
    setInterval(fn) {
      void fn;
      return () => {};
    },
  };
}

describe("createProgressRuntime", () => {
  it("selects quiet mode and still routes warnings through the presenter", () => {
    const sink = makeSink();
    const runtime = createProgressRuntime({
      sink,
      clock: makeClock(),
      scheduler: makeScheduler(),
      quiet: true,
      isTTY: true,
      styling: createStyling(false),
    });

    runtime.reporter.emit({ type: "phase-start", phase: "preparing" });
    runtime.reporter.emit({ type: "warning", message: "quiet warning" });

    expect(runtime.uiMode).toBe("quiet");
    expect(sink.records).toEqual([{ type: "writeLine", text: "[WARN] quiet warning" }]);
  });

  it("selects tty-interactive mode and renders live progress updates", () => {
    const sink = makeSink();
    const runtime = createProgressRuntime({
      sink,
      clock: makeClock(1000),
      scheduler: makeScheduler(),
      quiet: false,
      isTTY: true,
      styling: createStyling(true),
    });

    runtime.reporter.emit({ type: "phase-start", phase: "preparing" });

    expect(runtime.uiMode).toBe("tty-interactive");
    expect(sink.records.some((record) => record.type === "rewriteLine")).toBe(true);
  });

  it("selects non-tty summary mode and suppresses heartbeat rewrites", () => {
    const sink = makeSink();
    const runtime = createProgressRuntime({
      sink,
      clock: makeClock(1000),
      scheduler: makeScheduler(),
      quiet: false,
      isTTY: false,
      styling: createStyling(false),
    });

    runtime.reporter.emit({ type: "phase-start", phase: "preparing" });
    runtime.reporter.emit({ type: "warning", message: "visible warning" });

    expect(runtime.uiMode).toBe("non-tty-summary");
    expect(sink.records.some((record) => record.type === "rewriteLine")).toBe(false);
    expect(sink.records).toContainEqual({ type: "writeLine", text: "[WARN] visible warning" });
  });
});
