import { describe, expect, it } from "vitest";

import { createRunPresenter, normalizeUnknownError } from "../../src/cli/presenter.js";
import type { Clock, Scheduler, Styling, TerminalSink } from "../../src/cli/progress/index.js";

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

const plainStyling: Styling = {
  spinnerGlyph: (text) => text,
  doneMarker: (text) => text,
  stageLabel: (text) => text,
  summaryHeader: (text) => text,
  warnBadge: (text) => text,
  errorBadge: (text) => text,
  fieldKey: (text) => text,
  primaryValue: (text) => text,
  unitSuffix: (text) => text,
  refsValue: (text) => text,
};

describe("normalizeUnknownError", () => {
  it("returns the same error if it's already an Error instance", () => {
    const error = new Error("original error");
    expect(normalizeUnknownError(error)).toBe(error);
  });

  it("converts a string into an Error instance", () => {
    const error = "string error";
    const normalized = normalizeUnknownError(error);
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toBe("string error");
  });

  it("converts a non-string, non-Error value into an Error instance with a stringified message", () => {
    const error = { some: "object" };
    const normalized = normalizeUnknownError(error);
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toBe("[object Object]");
  });
});

describe("createRunPresenter", () => {
  it("renders runtime user errors through the run presenter after aborting an active display", () => {
    const sink = makeSink();
    const scheduler = makeScheduler();
    const presenter = createRunPresenter({
      sink,
      clock: makeClock(1000),
      scheduler,
      uiMode: "tty-interactive",
      styling: plainStyling,
    });

    presenter.handleProgressEvent({ type: "phase-start", phase: "extracting" });
    presenter.renderUserError("fatal message");

    expect(scheduler.cancelCount).toBe(1);
    expect(sink.records.map((record) => record.type)).toEqual([
      "rewriteLine",
      "newline",
      "writeLine",
    ]);
    expect(sink.records.at(-1)?.text).toBe("fatal message");
  });

  it("renders quiet warnings without a progress controller", () => {
    const sink = makeSink();
    const presenter = createRunPresenter({
      sink,
      clock: makeClock(1000),
      scheduler: makeScheduler(),
      uiMode: "quiet",
      styling: plainStyling,
    });

    presenter.handleProgressEvent({ type: "warning", message: "warning message" });

    expect(sink.records).toEqual([{ type: "writeLine", text: "[WARN] warning message" }]);
  });

  it("renders error diagnostics through the active progress surface and redraws the line", () => {
    const sink = makeSink();
    const presenter = createRunPresenter({
      sink,
      clock: makeClock(1000),
      scheduler: makeScheduler(),
      uiMode: "tty-interactive",
      styling: plainStyling,
    });

    presenter.handleProgressEvent({ type: "phase-start", phase: "extracting" });
    presenter.renderDiagnostic("error", "line 1\nline 2");

    expect(sink.records.map((record) => record.type)).toEqual([
      "rewriteLine",
      "newline",
      "writeLine",
      "writeLine",
      "rewriteLine",
    ]);
    expect(sink.records[2]).toEqual({ type: "writeLine", text: "[ERROR] line 1" });
    expect(sink.records[3]).toEqual({ type: "writeLine", text: "[ERROR] line 2" });
  });

  it("renders summary lines as non-progress output", () => {
    const sink = makeSink();
    const presenter = createRunPresenter({
      sink,
      clock: makeClock(1000),
      scheduler: makeScheduler(),
      uiMode: "non-tty-summary",
      styling: plainStyling,
    });

    presenter.renderSummary({
      recordsWritten: 3,
      commitsTraversed: 2,
      filesCreated: 1,
      bytesWritten: 1024,
      elapsedMs: 500,
      refs: ["main"],
    });

    expect(sink.records[0]).toEqual({ type: "newline" });
    expect(sink.records[1]).toEqual({ type: "writeLine", text: "Extraction complete" });
  });
});
