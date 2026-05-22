export interface SummaryData {
  recordsWritten: number;
  commitsTraversed: number;
  filesCreated: number;
  bytesWritten: number;
  elapsedMs: number;
  refs: readonly string[];
}
