import type { OutputSink, ProjectedRecord } from "../extraction-api/index.js";
import type { OutputWriter } from "./writer.js";

/** Thin adapter that makes `OutputWriter` satisfy the extraction `OutputSink` contract. */
export class OutputWriterSink implements OutputSink {
  private readonly writer: OutputWriter;

  constructor(writer: OutputWriter) {
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
