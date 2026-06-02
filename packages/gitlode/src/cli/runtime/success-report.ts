import type { RenderSuccessReportOptions } from "./types.js";

export function renderSuccessReport(options: RenderSuccessReportOptions): void {
  const { presenter, quiet, profile, success } = options;

  if (quiet) {
    return;
  }

  presenter.renderSummary({
    recordsWritten: success.recordsWritten,
    commitsTraversed: success.commitsTraversed,
    filesCreated: success.filesCreated,
    bytesWritten: success.bytesWritten,
    elapsedMs: success.elapsedMs,
    refs: [...success.refs],
  });

  if (profile) {
    presenter.renderProfile(success.profileEntries, success.skippedDiffs);
  }
}
