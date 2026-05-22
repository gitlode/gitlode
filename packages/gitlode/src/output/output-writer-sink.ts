import type { OutputSink } from "../core/types.js";
import type { OutputRecord } from "./types.js";
import { OutputWriter } from "./writer.js";

/** Thin adapter that makes `OutputWriter` satisfy the Core-owned `OutputSink` interface. */
export class OutputWriterSink implements OutputSink {
  private readonly writer: OutputWriter;

  constructor(writer: OutputWriter) {
    this.writer = writer;
  }

  write(record: OutputRecord): Promise<void> {
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
