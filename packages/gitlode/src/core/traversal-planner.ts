import type { GitAdapter } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import type { CommitOid, RefType } from "../model/index.js";
import { withProfilerAsync } from "../profile/index.js";
import type { StageProfiler } from "../profile/type.js";
import { assertNever, getOrThrow } from "../support/index.js";
import type {
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
  ExtractionRange,
  RefCheckpoint,
  ProgressReporter,
} from "./types.js";

function buildCheckpointKey(ref: string, refType: RefType): string {
  return `${refType}:${ref}`;
}

function resolveExcludeHash(
  checkpointTipOid: CommitOid | undefined,
  mergeBaseExclude: CommitOid | undefined,
  range: ExtractionRange | undefined,
): CommitOid | undefined {
  if (range === undefined) {
    return checkpointTipOid ?? mergeBaseExclude;
  }
  if (range.type === "ref") {
    return range.ref;
  } else if (range.type === "date") {
    return undefined;
  } else {
    assertNever(range);
  }
}

export class DefaultTraversalPlanner implements TraversalPlanner {
  private readonly adapter: GitAdapter;
  private readonly profiler?: StageProfiler;

  constructor(adapter: GitAdapter, profiler?: StageProfiler) {
    this.adapter = adapter;
    this.profiler = profiler;
  }

  async plan(
    request: TraversalPlanningRequest,
    reporter: ProgressReporter,
  ): Promise<readonly TraversalPlan[]> {
    return withProfilerAsync(this.profiler, async () => {
      const { repositoryPath, refs, mode, priorRefs, range } = request;

      const priorCheckpointByIdentity = new Map<string, RefCheckpoint>(
        priorRefs.map((entry) => [buildCheckpointKey(entry.ref, entry.refType), entry]),
      );

      const priorBranchTips = priorRefs
        .filter((entry) => entry.refType === "branch")
        .map((entry) => entry.tipOid);

      const requestedRefMetadata: Array<{ name: string; refType: RefType }> = [];
      for (const ref of refs) {
        const refType = await this.adapter.classifyRefType(repositoryPath, ref);
        requestedRefMetadata.push({ name: ref, refType });
      }

      const hasNewBranchRefs =
        mode === "incremental" &&
        requestedRefMetadata.some(
          (entry) =>
            entry.refType === "branch" &&
            !priorCheckpointByIdentity.has(buildCheckpointKey(entry.name, entry.refType)),
        );

      let mergeBaseForNewBranches: CommitOid | undefined;
      if (hasNewBranchRefs && priorBranchTips.length > 0) {
        const mergeBase = await this.adapter.findMergeBase(repositoryPath, priorBranchTips);
        mergeBaseForNewBranches = mergeBase ?? undefined;
      }

      const requestedRefTypeByName = new Map<string, RefType>(
        requestedRefMetadata.map((entry) => [entry.name, entry.refType]),
      );

      const plans: TraversalPlan[] = [];
      for (const ref of refs) {
        let head: CommitOid;
        const refType = getOrThrow(requestedRefTypeByName, ref);
        try {
          head = await this.adapter.resolveRef(repositoryPath, ref);
        } catch (err) {
          if (err instanceof GitAdapterError && err.code === "REF_NOT_FOUND") {
            reporter.emit({
              type: "warning",
              message: `Warning: Ref "${ref}" no longer exists in the repository. Skipping.`,
            });
            continue;
          }
          throw err;
        }

        const checkpoint = priorCheckpointByIdentity.get(buildCheckpointKey(ref, refType));
        const mergeBaseExclude =
          mode === "incremental" && refType === "branch" && checkpoint === undefined
            ? mergeBaseForNewBranches
            : undefined;

        plans.push({
          name: ref,
          refType,
          head,
          excludeHash: resolveExcludeHash(checkpoint?.tipOid, mergeBaseExclude, range),
        });
      }

      return plans;
    });
  }
}
