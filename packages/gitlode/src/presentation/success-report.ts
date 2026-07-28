import type { RenderSuccessReportOptions } from "./types.js";

export function renderSuccessReport(options: RenderSuccessReportOptions): void {
  const { presenter, quiet, profile, data } = options;

  if (quiet) {
    return;
  }

  presenter.renderSummary({
    recordsWritten: data.recordsWritten,
    commitsTraversed: data.commitsTraversed,
    filesCreated: data.filesCreated,
    bytesWritten: data.bytesWritten,
    elapsedMs: data.elapsedMs,
    refs: [...data.refs],
  });

  if (profile) {
    presenter.renderProfile(data.profileEntries, data.skippedDiffs);
  }
}
