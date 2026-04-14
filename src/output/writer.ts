import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";

import type { RotationConfig } from "../core/index.js";
import type { OutputCommit } from "./types.js";

export class OutputWriter {
  private seq = 0;
  private handle: FileHandle | null = null;
  private lineCount = 0;
  private byteCount = 0;
  private totalBytesWritten = 0;

  constructor(
    private readonly outputDir: string,
    private readonly prefix: string,
    private readonly rotation: RotationConfig,
  ) {}

  get filesCreated(): number {
    return this.seq;
  }

  get bytesWritten(): number {
    return this.totalBytesWritten;
  }

  private async openNext(): Promise<FileHandle> {
    this.seq++;
    const seqStr = String(this.seq).padStart(6, "0");
    const filename = `${this.prefix}-${seqStr}.jsonl`;
    const filepath = join(this.outputDir, filename);
    const handle = await open(filepath, "w");
    this.handle = handle;
    this.lineCount = 0;
    this.byteCount = 0;
    return handle;
  }

  async write(commit: OutputCommit): Promise<void> {
    const handle = this.handle ?? (await this.openNext());
    const line = JSON.stringify(commit) + "\n";
    const bytes = Buffer.byteLength(line, "utf8");
    await handle.write(line, null, "utf8");
    this.lineCount++;
    this.byteCount += bytes;
    this.totalBytesWritten += bytes;

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
