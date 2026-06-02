import { describe, expect, it } from "vitest";

import { renderSuccessReport } from "../../../src/cli/runtime/index.js";

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
      success: {
        recordsWritten: 1,
        commitsTraversed: 1,
        filesCreated: 1,
        bytesWritten: 1,
        elapsedMs: 1,
        refs: ["main"],
        profileEntries: [],
        skippedDiffs: 0,
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
      success: {
        recordsWritten: 2,
        commitsTraversed: 3,
        filesCreated: 4,
        bytesWritten: 5,
        elapsedMs: 6,
        refs: ["main"],
        profileEntries: [],
        skippedDiffs: 0,
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
      success: {
        recordsWritten: 2,
        commitsTraversed: 3,
        filesCreated: 4,
        bytesWritten: 5,
        elapsedMs: 6,
        refs: ["main"],
        profileEntries: [{ name: "elapsed", wallMs: 1, workMs: 1 }],
        skippedDiffs: 2,
      },
    });

    expect(presenter.calls.map((call) => call.method)).toEqual(["renderSummary", "renderProfile"]);
  });
});
