import { diffLines } from "diff";

import type { LineDiffCalculator } from "../line-diff/index.js";

/** Line-diff calculator backed by the `diff` package's `diffLines`, using UTF-8 decoding. */
export class JsLineDiffCalculator implements LineDiffCalculator {
  computeLineDiff(before: Uint8Array, after: Uint8Array): { additions: number; deletions: number } {
    const decoder = new TextDecoder("utf-8");
    const oldStr = decoder.decode(before);
    const newStr = decoder.decode(after);
    const parts = diffLines(oldStr, newStr);
    let additions = 0;
    let deletions = 0;
    for (const part of parts) {
      if (part.added) additions += part.count ?? 0;
      if (part.removed) deletions += part.count ?? 0;
    }
    return { additions, deletions };
  }
}
