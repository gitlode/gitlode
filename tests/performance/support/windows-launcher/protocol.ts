export const frameLimit = 1048576;
export const outputLimit = 65536;

// Retain at most one byte-bounded frame. Decode only complete frames, strictly.
export class Frames {
  private bytes = Buffer.alloc(frameLimit);
  private length = 0;
  private failed = false;
  push(chunk: Buffer, receive: (message: Record<string, unknown>) => void) {
    if (this.failed) throw new Error("control admission sealed");
    try {
      for (const byte of chunk) {
        if (byte !== 10) {
          if (this.length === frameLimit) throw new Error("oversized control frame");
          this.bytes[this.length++] = byte;
          continue;
        }
        let size = this.length;
        if (size && this.bytes[size - 1] === 13) size--;
        if (!size || (this.bytes[0] === 239 && this.bytes[1] === 187 && this.bytes[2] === 191))
          throw new Error("blank/BOM control frame");
        const line = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          this.bytes.subarray(0, size),
        );
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          throw new Error("invalid control JSON");
        }
        if (!message || typeof message !== "object" || Array.isArray(message))
          throw new Error("invalid control schema");
        this.length = 0;
        receive(message as Record<string, unknown>);
      }
    } catch {
      this.failed = true;
      throw new Error("invalid control frame; retain root");
    }
  }
  end() {
    if (this.length) {
      this.failed = true;
      throw new Error("truncated control frame; retain root");
    }
  }
}

export function output(value: unknown): Buffer {
  if (
    typeof value !== "string" ||
    value.length > 4 * Math.ceil(outputLimit / 3) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    throw new Error("invalid bounded output encoding");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > outputLimit || bytes.toString("base64") !== value)
    throw new Error("invalid bounded output encoding");
  return bytes;
}
