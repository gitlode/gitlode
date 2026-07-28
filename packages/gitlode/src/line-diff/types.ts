/**
 * Calculates line-level addition and deletion statistics for text content.
 *
 * Results must be finite non-negative integers, and identical inputs must
 * produce identical results.
 *
 * Binary detection and null-result policy belong to the caller. Inputs to this
 * contract are already known to be text.
 */
export interface LineDiffCalculator {
  computeLineDiff(
    before: Uint8Array,
    after: Uint8Array,
  ): {
    additions: number;
    deletions: number;
  };
}
