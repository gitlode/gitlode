import { describe, expect, it } from "vitest";

import {
  ProgressController,
  type Clock,
  type Scheduler,
  type TerminalSink,
} from "../../../src/cli/progress/index.js";

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

function makeScheduler(): Scheduler & { cancelCount: number } {
  let cancelCount = 0;
  return {
    cancelCount,
    setInterval() {
      return () => {
        cancelCount += 1;
        this.cancelCount = cancelCount;
      };
    },
  };
}

describe("ProgressController.abortActiveDisplay", () => {
  it("stops the heartbeat and finalizes the active tty line with a newline", () => {
    const sink = makeSink();
    const clock = makeClock(1000);
    const scheduler = makeScheduler();
    const controller = new ProgressController(sink, clock, scheduler, "tty-interactive");

    controller.handleEvent({ type: "phase-start", phase: "extracting" });
    controller.abortActiveDisplay();

    expect(scheduler.cancelCount).toBe(1);
    expect(sink.records.filter((record) => record.type === "newline")).toHaveLength(1);
  });

  it("is a no-op for non-tty modes with no active display", () => {
    const sink = makeSink();
    const clock = makeClock(1000);
    const scheduler = makeScheduler();
    const controller = new ProgressController(sink, clock, scheduler, "non-tty-summary");

    controller.abortActiveDisplay();

    expect(scheduler.cancelCount).toBe(0);
    expect(sink.records).toEqual([]);
  });
});
