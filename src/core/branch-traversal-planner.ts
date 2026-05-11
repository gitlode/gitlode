import type { GitAdapter } from "../git/index.js";
import { GitAdapterError } from "../git/index.js";
import { withProfilerAsync } from "./profiler-utils.js";
import type {
  BranchTraversalPlan,
  BranchTraversalPlanner,
  BranchTraversalPlanningRequest,
  CommitHash,
  ExtractionRange,
  Reporter,
  StageProfiler,
} from "./types.js";
import { assertNever } from "./types.js";

function resolveExcludeHash(
  branchName: string,
  priorBranchMap: ReadonlyMap<string, CommitHash>,
  newBranchExclude: CommitHash | undefined,
  range: ExtractionRange | undefined,
): CommitHash | undefined {
  if (range === undefined) {
    return priorBranchMap.get(branchName) ?? newBranchExclude;
  }
  if (range.type === "ref") {
    return range.ref;
  } else if (range.type === "date") {
    return undefined;
  } else {
    assertNever(range);
  }
}

export class DefaultBranchTraversalPlanner implements BranchTraversalPlanner {
  private readonly adapter: GitAdapter;
  private readonly profiler?: StageProfiler;

  constructor(adapter: GitAdapter, profiler?: StageProfiler) {
    this.adapter = adapter;
    this.profiler = profiler;
  }

  async plan(
    request: BranchTraversalPlanningRequest,
    reporter: Reporter,
  ): Promise<readonly BranchTraversalPlan[]> {
    return withProfilerAsync(this.profiler, async () => {
      const { repositoryPath, branches, mode, priorBranchMap, range } = request;

      const newBranches = new Set<string>(
        mode === "incremental" ? branches.filter((branch) => !priorBranchMap.has(branch)) : [],
      );

      let newBranchExclude: CommitHash | undefined;
      if (newBranches.size > 0 && priorBranchMap.size > 0) {
        const mergeBase = await this.adapter.findMergeBase(
          repositoryPath,
          Array.from(priorBranchMap.values()),
        );
        newBranchExclude = mergeBase ?? undefined;
      }

      const plans: BranchTraversalPlan[] = [];
      for (const branch of branches) {
        let head: CommitHash;
        try {
          head = await this.adapter.resolveRef(repositoryPath, branch);
        } catch (err) {
          if (err instanceof GitAdapterError && err.code === "REF_NOT_FOUND") {
            reporter.warn(
              `Warning: Branch "${branch}" no longer exists in the repository. Skipping.`,
            );
            continue;
          }
          throw err;
        }

        plans.push({
          name: branch,
          head,
          excludeHash: resolveExcludeHash(branch, priorBranchMap, newBranchExclude, range),
        });
      }

      return plans;
    });
  }
}
