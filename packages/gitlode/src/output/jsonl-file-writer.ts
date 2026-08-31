import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";

import type { ProjectedRecord } from "@gitlode/internal-contracts/extraction";

import type { JsonlFileWriterMetricRecorder } from "./jsonl-file-writer-metric-recorder.js";

interface RotationOptions {
  readonly maxLines?: number;
  readonly maxBytes?: number;
}

export class JsonlFileWriter {
  private seq = 0;
  private handle: FileHandle | null = null;
  private lineCount = 0;
  private byteCount = 0;
  private totalBytesWritten = 0;

  private readonly outputDir: string;
  private readonly filenameFor: (seq: number) => string;
  private readonly rotation: RotationOptions;
  private readonly metricRecorder: JsonlFileWriterMetricRecorder;
  constructor(
    outputDir: string,
    filenameFor: (seq: number) => string,
    rotation: RotationOptions,
    metricRecorder: JsonlFileWriterMetricRecorder,
  ) {
    this.outputDir = outputDir;
    this.filenameFor = filenameFor;
    this.rotation = rotation;
    this.metricRecorder = metricRecorder;
  }

  get filesCreated(): number {
    return this.seq;
  }

  get bytesWritten(): number {
    return this.totalBytesWritten;
  }

  private async openNext(): Promise<FileHandle> {
    const nextSeq = this.seq + 1;
    const filename = this.filenameFor(nextSeq);
    const filepath = join(this.outputDir, filename);
    const handle = await open(filepath, "w");
    this.seq = nextSeq;
    this.metricRecorder.recordFileCreated();
    this.handle = handle;
    this.lineCount = 0;
    this.byteCount = 0;
    return handle;
  }

  async write(record: ProjectedRecord): Promise<void> {
    const handle = this.handle ?? (await this.openNext());
    const line = JSON.stringify(record) + "\n";
    const bytes = Buffer.byteLength(line, "utf8");
    await handle.write(line, null, "utf8");
    this.lineCount++;
    this.byteCount += bytes;
    this.totalBytesWritten += bytes;
    this.metricRecorder.recordBytesWritten(bytes);

    const rotateByLines =
      this.rotation.maxLines !== undefined && this.lineCount >= this.rotation.maxLines;
    const rotateByBytes =
      this.rotation.maxBytes !== undefined && this.byteCount >= this.rotation.maxBytes;
    if (rotateByLines || rotateByBytes) {
      await handle.close();
      this.handle = null;
    }
  }

  async close(): Promise<void> {
    if (this.handle !== null) {
      await this.handle.close();
      this.handle = null;
    }
  }
}
