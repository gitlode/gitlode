import {
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type TelemetryAttributeValue,
} from "@gitlode/internal-contracts/telemetry";
import type {
  DagFallbackReason,
  DagOperationObservation,
  DagOperationObservationHooks,
  DagTraversalRole,
} from "@gitlode/internal-foundation/dag";
import type { Counter, Meter, Span } from "@opentelemetry/api";

type DagOperation = TelemetryAttributeValue<"dag_operation">;
type DifferenceOperation = Extract<DagOperation, "difference">;
type ReachableOperation = Extract<DagOperation, "reachable">;
type CertifiedClosureOperation = Extract<DagOperation, "certified-closure">;
export type StreamDagOperationContext =
  | {
      readonly operation: DifferenceOperation;
      readonly strategy: TelemetryAttributeValue<"dag_strategy">;
      readonly hasExclusion: boolean;
    }
  | { readonly operation: ReachableOperation };
export type CertifiedClosureDagOperationContext = {
  readonly operation: CertifiedClosureOperation;
};
export type DagOperationContext = StreamDagOperationContext | CertifiedClosureDagOperationContext;
export type StreamDagCompletion = {
  readonly type: "stream";
  readonly completion: "exhausted" | "cancelled" | "handled_throw" | "error";
};
export type CertifiedClosureDagCompletion = {
  readonly type: "certified-closure";
  readonly completion: "success" | "error";
};
export type NeutralDagCompletion = StreamDagCompletion | CertifiedClosureDagCompletion;
type CompletionFor<C extends DagOperationContext> = C extends CertifiedClosureDagOperationContext
  ? CertifiedClosureDagCompletion
  : StreamDagCompletion;
export interface DagMetricOperation<C extends NeutralDagCompletion = NeutralDagCompletion> {
  readonly observations: DagOperationObservationHooks;
  complete(completion: C): void;
}
export interface DagMetricRecorder {
  startOperation<C extends DagOperationContext>(context: C): DagMetricOperation<CompletionFor<C>>;
}

/** Binds neutral DAG evidence to the Git-owned span and metric signals. */
export function bindDagObservation(
  span: Span,
  operation: DagMetricOperation,
  context: DagOperationContext,
): DagOperationObservation {
  let fallbackRecorded = false;
  const attrs = (
    id: Parameters<typeof getTelemetryAttributeMetadata>[0],
    value: string | boolean,
  ) => span.setAttribute(key(id), value);
  return {
    recordStepProcessed: (count) => operation.observations.recordStepProcessed(count),
    recordStepStale: (count) => operation.observations.recordStepStale(count),
    recordSuccessorExpansion: (role, count) =>
      operation.observations.recordSuccessorExpansion(role, count),
    recordNodeYielded: (count) => operation.observations.recordNodeYielded(count),
    recordNodeExcluded: (count) => operation.observations.recordNodeExcluded(count),
    markFallback(reason) {
      operation.observations.markFallback(reason);
      if (!fallbackRecorded) {
        fallbackRecorded = true;
        span.addEvent("gitlode.dag.fallback", {
          [key("dag_fallback_reason")]: fallbackMap[reason],
        });
      }
    },
    recordFallbackNodeRemoved: (count) => operation.observations.recordFallbackNodeRemoved(count),
    complete(completion) {
      if (context.operation === "difference") {
        attrs("dag_operation", context.operation);
        attrs("dag_strategy", context.strategy);
        attrs("dag_has_exclusion", context.hasExclusion);
      } else {
        attrs("dag_operation", context.operation);
      }
      const normalized =
        context.operation === "certified-closure"
          ? normalizeDagCompletion({
              type: "certified-closure",
              completion: completion === "success" ? "success" : "error",
            })
          : normalizeDagCompletion({
              type: "stream",
              completion:
                completion === "success"
                  ? "exhausted"
                  : (completion as StreamDagCompletion["completion"]),
            });
      attrs("dag_operation_completion", normalized);
      operation.complete(
        context.operation === "certified-closure"
          ? {
              type: "certified-closure",
              completion: completion === "success" ? "success" : "error",
            }
          : {
              type: "stream",
              completion:
                completion === "success"
                  ? "exhausted"
                  : (completion as StreamDagCompletion["completion"]),
            },
      );
    },
  };
}

const noopHooks = Object.freeze<DagOperationObservationHooks>({
  recordStepProcessed() {},
  recordStepStale() {},
  recordSuccessorExpansion() {},
  recordNodeYielded() {},
  recordNodeExcluded() {},
  markFallback() {},
  recordFallbackNodeRemoved() {},
});
const noopOperation = Object.freeze<DagMetricOperation>({ observations: noopHooks, complete() {} });
export const NOOP_DAG_METRIC_RECORDER = Object.freeze<DagMetricRecorder>({
  startOperation: () => noopOperation as never,
});
export function normalizeDagCompletion(
  c: NeutralDagCompletion,
): TelemetryAttributeValue<"dag_operation_completion"> {
  return c.type === "certified-closure"
    ? c.completion
    : c.completion === "exhausted"
      ? "success"
      : c.completion === "handled_throw"
        ? "handled-throw"
        : c.completion;
}
const fallbackMap: Record<DagFallbackReason, TelemetryAttributeValue<"dag_fallback_reason">> = {
  open_include_path: "open-include-path",
  exclude_path_split: "exclude-path-split",
  no_stop_points: "no-stop-points",
  uncertified_stop_point: "uncertified-stop-point",
};
const key = (id: Parameters<typeof getTelemetryAttributeMetadata>[0]) =>
  getTelemetryAttributeMetadata(id).key;
export function createDagMetricRecorder(meter: Meter): DagMetricRecorder {
  const make = (id: Parameters<typeof getTelemetryMetricMetadata>[0]) => {
    const m = getTelemetryMetricMetadata(id);
    return meter.createCounter(m.name, { description: m.description, unit: m.unit });
  };
  const completionMetric = make("dag_operation_completion"),
    processedMetric = make("dag_step_processed"),
    staleMetric = make("dag_step_stale"),
    expansionMetric = make("dag_successor_expansion"),
    yieldedMetric = make("dag_node_yielded"),
    excludedMetric = make("dag_node_excluded"),
    fallbackMetric = make("dag_fallback"),
    removedMetric = make("dag_fallback_node_removed");
  return {
    startOperation<C extends DagOperationContext>(context: C) {
      let completed = false,
        processed = 0,
        stale = 0,
        yielded = 0,
        excluded = 0,
        removed = 0,
        fallback: DagFallbackReason | undefined;
      const acceptsFallback =
        context.operation === "difference" && context.strategy === "certified-lazy";
      const expansion: Record<DagTraversalRole, number> = { main: 0, exclude: 0 };
      const add = (current: number, requested?: number) => {
        const count = requested ?? 1;
        return Number.isFinite(count) &&
          Number.isInteger(count) &&
          count > 0 &&
          Number.isFinite(current + count)
          ? current + count
          : current;
      };
      const observations: DagOperationObservationHooks = {
        recordStepProcessed(c) {
          processed = add(processed, c);
        },
        recordStepStale(c) {
          stale = add(stale, c);
        },
        recordSuccessorExpansion(r, c) {
          expansion[r] = add(expansion[r], c);
        },
        recordNodeYielded(c) {
          yielded = add(yielded, c);
        },
        recordNodeExcluded(c) {
          excluded = add(excluded, c);
        },
        markFallback(r) {
          if (acceptsFallback) fallback ??= r;
        },
        recordFallbackNodeRemoved(c) {
          if (fallback) removed = add(removed, c);
        },
      };
      return {
        observations,
        complete(c) {
          if (completed) return;
          completed = true;
          const attrs: Record<string, string | boolean> = {
            [key("dag_operation")]: context.operation,
          };
          if (context.operation === "difference") {
            attrs[key("dag_strategy")] = context.strategy;
            attrs[key("dag_has_exclusion")] = context.hasExclusion;
          }
          completionMetric.add(1, {
            ...attrs,
            [key("dag_operation_completion")]: normalizeDagCompletion(c),
          });
          const record = (instrument: Counter, value: number, a = attrs) => {
            if (value > 0 && Number.isFinite(value)) instrument.add(value, a);
          };
          record(processedMetric, processed);
          record(staleMetric, stale);
          for (const role of ["main", "exclude"] as const)
            record(expansionMetric, expansion[role], { ...attrs, [key("dag_role")]: role });
          if (context.operation !== "certified-closure") record(yieldedMetric, yielded);
          if (context.operation === "difference" && context.hasExclusion)
            record(excludedMetric, excluded, attrs);
          if (fallback) {
            const fattrs = {
              [key("dag_strategy")]: "certified-lazy",
              [key("dag_fallback_reason")]: fallbackMap[fallback],
            };
            fallbackMetric.add(1, fattrs);
            record(removedMetric, removed, fattrs);
          }
        },
      } as DagMetricOperation<CompletionFor<C>>;
    },
  };
}
