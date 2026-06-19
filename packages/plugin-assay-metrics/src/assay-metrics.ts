export interface BaseMetrics {
  additions: number | null;
  deletions: number | null;
}
export function computeDelta(base: BaseMetrics): number | null {
  const { additions, deletions } = base;
  if (additions === null || deletions === null) {
    return null;
  }
  return additions - deletions;
}
export function computeChurn(base: BaseMetrics): number | null {
  const { additions, deletions } = base;
  if (additions === null || deletions === null) {
    return null;
  }
  return additions + deletions;
}
export function computeNetChange(base: BaseMetrics): number | null {
  const { additions, deletions } = base;
  if (additions === null || deletions === null) {
    return null;
  }
  return Math.max(additions, deletions);
}
