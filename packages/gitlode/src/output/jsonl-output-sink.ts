import type { OutputSink, ProjectedRecord } from "@gitlode/internal-contracts/extraction";

import type { JsonlFileWriter } from "./jsonl-file-writer.js";

/** Thin adapter that makes `JsonlFileWriter` satisfy the extraction `OutputSink` contract. */
export class JsonlOutputSink implements OutputSink {
  private readonly writer: JsonlFileWriter;

  constructor(writer: JsonlFileWriter) {
    this.writer = writer;
  }

  write(record: ProjectedRecord): Promise<void> {
    return this.writer.write(record);
  }

  close(): Promise<void> {
    return this.writer.close();
  }

  get filesCreated(): number {
    return this.writer.filesCreated;
  }

  get bytesWritten(): number {
    return this.writer.bytesWritten;
  }
}
