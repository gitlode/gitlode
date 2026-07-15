export interface CommitPathSchedulingHint {
  /**
   * Unix seconds from the expanded child commit's committer timestamp. This is path-local
   * scheduling metadata, not metadata about the pending parent node.
   */
  readonly sourceCommitterTimestamp: number;
}
