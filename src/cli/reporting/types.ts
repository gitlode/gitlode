export interface SummaryData {
  recordsWritten: number;
  commitsTraversed: number;
  filesCreated: number;
  bytesWritten: number;
  elapsedMs: number;
  branches: readonly string[];
}
