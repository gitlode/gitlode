import { describe, expect, it } from "vitest";

import { renderSuccessReport } from "../../src/presentation/success-report.js";

const profileReport = {
  schemaVersion: 1 as const,
  signalStatus: {
    spans: "complete" as const,
    counters: "complete" as const,
    histograms: "complete" as const,
  },
  spans: [],
  counters: [],
  histograms: [],
  diagnostics: [],
};

function makePresenter() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    renderSummary(...args: unknown[]) {
      calls.push({ method: "renderSummary", args });
    },
    renderProfile(...args: unknown[]) {
      calls.push({ method: "renderProfile", args });
    },
  };
}

describe("renderSuccessReport", () => {
  it("suppresses output in quiet mode", () => {
    const presenter = makePresenter();

    renderSuccessReport({
      presenter: presenter as never,
      quiet: true,
      profile: true,
      data: {
        recordsWritten: 1,
        commitsTraversed: 1,
        filesCreated: 1,
        bytesWritten: 1,
        elapsedMs: 1,
        refs: ["main"],
        profileReport: undefined,
      },
    });

    expect(presenter.calls).toEqual([]);
  });

  it("renders summary output and omits profile output when profile is disabled", () => {
    const presenter = makePresenter();

    renderSuccessReport({
      presenter: presenter as never,
      quiet: false,
      profile: false,
      data: {
        recordsWritten: 2,
        commitsTraversed: 3,
        filesCreated: 4,
        bytesWritten: 5,
        elapsedMs: 6,
        refs: ["main"],
        profileReport: undefined,
      },
    });

    expect(presenter.calls.map((call) => call.method)).toEqual(["renderSummary"]);
  });

  it("renders profile output after summary when profile is enabled", () => {
    const presenter = makePresenter();

    renderSuccessReport({
      presenter: presenter as never,
      quiet: false,
      profile: true,
      data: {
        recordsWritten: 2,
        commitsTraversed: 3,
        filesCreated: 4,
        bytesWritten: 5,
        elapsedMs: 6,
        refs: ["main"],
        profileReport,
      },
    });

    expect(presenter.calls.map((call) => call.method)).toEqual(["renderSummary", "renderProfile"]);
  });
});
