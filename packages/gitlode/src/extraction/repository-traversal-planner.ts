import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  ExtractionRange,
  RefCheckpoint,
  TraversalPlan,
  TraversalPlanner,
  TraversalPlanningRequest,
} from "@gitlode/internal-contracts/extraction";
import type { GitAdapter } from "@gitlode/internal-contracts/git";
import { GitAdapterError } from "@gitlode/internal-contracts/git";
import type { CommitOid, RefType } from "@gitlode/internal-contracts/model";
import { getTelemetryAttributeMetadata } from "@gitlode/internal-contracts/telemetry";
import { withAsyncSpan } from "@gitlode/internal-foundation/otel-support";
import { assertNever, getOrThrow } from "@gitlode/internal-foundation/support";
import type { Context, Tracer } from "@opentelemetry/api";

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
    return range.since;
  } else if (range.type === "date") {
    return undefined;
  } else {
    assertNever(range);
  }
}

export class RepositoryTraversalPlanner implements TraversalPlanner {
  private readonly adapter: GitAdapter;
  private readonly tracer: Tracer;

  constructor(adapter: GitAdapter, tracer: Tracer) {
    this.adapter = adapter;
    this.tracer = tracer;
  }

  async plan(
    request: TraversalPlanningRequest,
    diagnosticReporter: DiagnosticReporter,
    parentContext?: Context,
  ): Promise<readonly TraversalPlan[]> {
    return await withAsyncSpan(
      this.tracer,
      "gitlode.planning",
      async (span) => {
        const { repositoryPath, refs, mode, priorRefs, range } = request;
        span.setAttribute(getTelemetryAttributeMetadata("requested_ref_count").key, refs.length);
        span.setAttribute(getTelemetryAttributeMetadata("prior_ref_count").key, priorRefs.length);
        span.setAttribute(getTelemetryAttributeMetadata("extraction_mode").key, mode);
        span.setAttribute(
          getTelemetryAttributeMetadata("extraction_range_kind").key,
          range?.type ?? "none",
        );

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
              diagnosticReporter.report({
                severity: "warn",
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

        span.setAttribute(getTelemetryAttributeMetadata("traversal_plan_count").key, plans.length);
        span.setAttribute(
          getTelemetryAttributeMetadata("skipped_ref_count").key,
          refs.length - plans.length,
        );
        return plans;
      },
      undefined,
      parentContext,
    );
  }
}
