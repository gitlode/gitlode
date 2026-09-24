import {
  compareCodeUnits,
  compareProfileAttributeValues,
  compareProfileScopes,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttribute,
  ProfileInstrumentationScope,
  ProfileObservationKind,
} from "@gitlode/internal-contracts/telemetry";

export const PROFILE_VIEW_DIAGNOSTIC_LABELS: Readonly<Record<string, string>> = {
  span_group_overflow: "Span groups truncated",
  span_attribute_value_overflow: "Span attribute values truncated",
  metric_point_overflow: "Metric datapoints truncated",
  attribute_reducer_conflict: "Span attribute invariant violated",
  invalid_aggregation: "Invalid aggregation discarded",
  lifecycle_failure: "Telemetry lifecycle stage failed",
  diagnostic_overflow: "Additional diagnostics omitted",
};

export const PROFILE_KIND_ORDER: Readonly<Record<ProfileObservationKind, number>> = {
  span: 0,
  counter: 1,
  histogram: 2,
};

export function compareProfileIdentity(
  left: {
    scope: ProfileInstrumentationScope;
    name: string;
    kind: ProfileObservationKind;
    attributes?: readonly ProfileAttribute[];
  },
  right: {
    scope: ProfileInstrumentationScope;
    name: string;
    kind: ProfileObservationKind;
    attributes?: readonly ProfileAttribute[];
  },
): number {
  return (
    compareProfileScopes(left.scope, right.scope) ||
    compareCodeUnits(left.name, right.name) ||
    PROFILE_KIND_ORDER[left.kind] - PROFILE_KIND_ORDER[right.kind] ||
    compareAttributeSets(left.attributes ?? [], right.attributes ?? [])
  );
}

export function compareAttributeSets(
  left: readonly ProfileAttribute[],
  right: readonly ProfileAttribute[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftAttribute = left.at(index);
    const rightAttribute = right.at(index);
    if (!leftAttribute || !rightAttribute) break;
    const comparison =
      compareCodeUnits(leftAttribute.key, rightAttribute.key) ||
      compareProfileAttributeValues(leftAttribute.value, rightAttribute.value);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}
