import type { LineDiffCalculator } from "@gitlode/internal-contracts/line-diff";
import { diffLines } from "diff";

import type { LineDiffMetricRecorder } from "./line-diff-metric-recorder.js";

export interface JsLineDiffCalculatorDependencies {
  readonly metricRecorder: LineDiffMetricRecorder;
}

/** Line-diff calculator backed by the `diff` package's `diffLines`, using UTF-8 decoding. */
export class JsLineDiffCalculator implements LineDiffCalculator {
  private readonly metricRecorder: LineDiffMetricRecorder;

  constructor(dependencies: JsLineDiffCalculatorDependencies) {
    this.metricRecorder = dependencies.metricRecorder;
  }

  computeLineDiff(before: Uint8Array, after: Uint8Array): { additions: number; deletions: number } {
    const token = this.metricRecorder.startCompute();
    const inputSizeBytes = before.byteLength + after.byteLength;
    try {
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
      this.metricRecorder.completeCompute(token, "success", inputSizeBytes);
      return { additions, deletions };
    } catch (error) {
      this.metricRecorder.completeCompute(token, "error", inputSizeBytes);
      throw error;
    }
  }
}
