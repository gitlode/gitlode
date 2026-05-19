import type { GitAdapter } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import { withProfilerAsync } from "./profile/index.js";
import type {
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
  CommitOid,
  ExtractionRange,
  ProgressReporter,
  StageProfiler,
} from "./types.js";
import { assertNever } from "./types.js";

function resolveExcludeHash(
  refName: string,
  priorRefMap: ReadonlyMap<string, CommitOid>,
  newRefExclude: CommitOid | undefined,
  range: ExtractionRange | undefined,
): CommitOid | undefined {
  if (range === undefined) {
    return priorRefMap.get(refName) ?? newRefExclude;
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
      const { repositoryPath, refs, mode, priorRefMap, range } = request;

      const newRefs = new Set<string>(
        mode === "incremental" ? refs.filter((ref) => !priorRefMap.has(ref)) : [],
      );

      let newRefExclude: CommitOid | undefined;
      if (newRefs.size > 0 && priorRefMap.size > 0) {
        const mergeBase = await this.adapter.findMergeBase(
          repositoryPath,
          Array.from(priorRefMap.values()),
        );
        newRefExclude = mergeBase ?? undefined;
      }

      const plans: TraversalPlan[] = [];
      for (const ref of refs) {
        let head: CommitOid;
        let isBranch: boolean;
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
        isBranch = await this.adapter.isRefBranch(repositoryPath, ref);

        plans.push({
          name: ref,
          head,
          excludeHash: resolveExcludeHash(ref, priorRefMap, newRefExclude, range),
          isBranch,
        });
      }

      return plans;
    });
  }
}
