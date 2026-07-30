import type { LineDiffCalculator } from "@gitlode/internal-contracts/line-diff";
import { diffLines } from "diff";

interface LineDiffInstrumentation {
  run<T>(name: string, operation: () => T): T;
}

export interface JsLineDiffCalculatorDependencies {
  readonly instrumentation: LineDiffInstrumentation;
}

/** Line-diff calculator backed by the `diff` package's `diffLines`, using UTF-8 decoding. */
export class JsLineDiffCalculator implements LineDiffCalculator {
  private readonly instrumentation: LineDiffInstrumentation;

  constructor(dependencies: JsLineDiffCalculatorDependencies) {
    this.instrumentation = dependencies.instrumentation;
  }

  computeLineDiff(before: Uint8Array, after: Uint8Array): { additions: number; deletions: number } {
    return this.instrumentation.run("line_diff.compute", () => {
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
    });
  }
}
