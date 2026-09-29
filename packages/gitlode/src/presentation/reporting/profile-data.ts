import { compareCodeUnits, compareProfileScopes } from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileCounterPoint,
  ProfileDiagnostic,
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileLossQuantity,
  ProfileReport,
  ProfileSpanAggregate,
  ProfileTarget,
} from "@gitlode/internal-contracts/telemetry";

import { compareAttributeSets, compareProfileIdentity } from "./profile-view.js";

export type ProfileMeasurement =
  | { kind: "span"; value: ProfileSpanAggregate }
  | { kind: "counter"; value: ProfileCounterPoint }
  | { kind: "histogram"; value: ProfileHistogramPoint };

export interface NamespaceNode {
  readonly segment: string;
  readonly absoluteName: string;
  readonly rows: ProfileMeasurement[];
  readonly diagnostics: ProfileDiagnostic[];
  readonly children: Map<string, NamespaceNode>;
}

type NamedProfileTarget = Extract<ProfileTarget, { type: "observation" | "point" }>;

export interface IssueOnlyTarget {
  readonly target: NamedProfileTarget;
  readonly diagnostics: ProfileDiagnostic[];
}

type NamedProfileEntry =
  | { readonly type: "measurement"; readonly row: ProfileMeasurement }
  | { readonly type: "issue"; readonly issue: IssueOnlyTarget };

export interface ScopeContext {
  readonly scope: ProfileInstrumentationScope;
  readonly rows: ProfileMeasurement[];
  readonly diagnostics: readonly ProfileDiagnostic[];
}

export function groupProfileScopes(report: ProfileReport): ScopeContext[] {
  const measurements: ProfileMeasurement[] = [
    ...report.spans.map((value) => ({ kind: "span" as const, value })),
    ...report.counters.map((value) => ({ kind: "counter" as const, value })),
    ...report.histograms.map((value) => ({ kind: "histogram" as const, value })),
  ].sort(compareMeasurements);
  const byScope = new Map<
    string,
    Map<string | null, { scope: ProfileInstrumentationScope; rows: ProfileMeasurement[] }>
  >();
  const scopeEntry = (scope: ProfileInstrumentationScope) => {
    const byVersion = byScope.get(scope.name) ?? new Map();
    byScope.set(scope.name, byVersion);
    const entry = byVersion.get(scope.version) ?? { scope, rows: [] };
    byVersion.set(scope.version, entry);
    return entry;
  };
  for (const measurement of measurements) {
    const scope = measurement.value.scope;
    scopeEntry(scope).rows.push(measurement);
  }
  for (const diagnostic of report.diagnostics) {
    if (diagnostic.code === "diagnostic_overflow" || diagnostic.target.type === "report") continue;
    scopeEntry(diagnostic.target.scope);
  }

  return [...byScope.values()]
    .flatMap((byVersion) => [...byVersion.values()])
    .sort((left, right) => compareProfileScopes(left.scope, right.scope))
    .map(({ scope, rows }) => ({
      scope,
      rows,
      diagnostics: report.diagnostics.filter(
        (diagnostic): diagnostic is ProfileDiagnostic =>
          diagnostic.code !== "diagnostic_overflow" &&
          diagnostic.target.type !== "report" &&
          compareProfileScopes(diagnostic.target.scope, scope) === 0,
      ),
    }));
}

export function buildScopeTree(
  { rows, diagnostics }: ScopeContext,
  namespaceDepth: number,
): {
  roots: NamespaceNode[];
  ungrouped: { rows: ProfileMeasurement[]; diagnostics: ProfileDiagnostic[] };
} {
  if (!Number.isSafeInteger(namespaceDepth) || namespaceDepth < 0)
    throw new RangeError("Namespace depth must be a nonnegative safe integer");
  const roots = new Map<string, NamespaceNode>();
  const ungrouped: { rows: ProfileMeasurement[]; diagnostics: ProfileDiagnostic[] } = {
    rows: [],
    diagnostics: [],
  };

  // Measurements and diagnostic-only identities use the same path construction.
  function nodeFor(name: string): NamespaceNode | undefined {
    const segments = name.split(".");
    if (segments.some((segment) => segment.length === 0)) return undefined;
    let nodes = roots;
    let absoluteName = "";
    let target: NamespaceNode | undefined;
    for (const segment of segments.slice(0, namespaceDepth)) {
      absoluteName = absoluteName ? absoluteName + "." + segment : segment;
      const node: NamespaceNode = nodes.get(segment) ?? {
        segment,
        absoluteName,
        rows: [],
        diagnostics: [],
        children: new Map(),
      };
      nodes.set(segment, node);
      target = node;
      nodes = node.children;
    }
    return target;
  }
  for (const row of rows) {
    const node = nodeFor(row.value.name);
    if (node) node.rows.push(row);
    else ungrouped.rows.push(row);
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.target.type !== "observation" && diagnostic.target.type !== "point") continue;
    const node = nodeFor(diagnostic.target.name);
    if (node) node.diagnostics.push(diagnostic);
    else ungrouped.diagnostics.push(diagnostic);
  }
  return {
    roots: [...roots.values()].sort((a, b) => compareCodeUnits(a.segment, b.segment)),
    ungrouped,
  };
}

export function compareMeasurements(left: ProfileMeasurement, right: ProfileMeasurement): number {
  return compareProfileIdentity(
    {
      scope: left.value.scope,
      name: left.value.name,
      kind: left.kind,
      attributes: left.kind === "span" ? [] : left.value.attributes,
    },
    {
      scope: right.value.scope,
      name: right.value.name,
      kind: right.kind,
      attributes: right.kind === "span" ? [] : right.value.attributes,
    },
  );
}

export function diagnosticsForName(
  diagnostics: readonly ProfileDiagnostic[],
  name: string,
): ProfileDiagnostic[] {
  return diagnostics
    .filter(
      (diagnostic) =>
        (diagnostic.target.type === "observation" || diagnostic.target.type === "point") &&
        diagnostic.target.name === name,
    )
    .sort(compareDiagnostics);
}

export function compareDiagnostics(left: ProfileDiagnostic, right: ProfileDiagnostic): number {
  return (
    compareDiagnosticTargets(left.target, right.target) ||
    compareCodeUnits(left.code, right.code) ||
    compareCodeUnits(left.stage, right.stage) ||
    compareStringArrays(left.effects, right.effects) ||
    compareStringArrays(left.signalCoverage, right.signalCoverage) ||
    compareCodeUnits(left.extent, right.extent) ||
    compareAttributeKeySelectors(left.attributeKey, right.attributeKey) ||
    compareAffectedFields(left.affectedFields, right.affectedFields) ||
    compareDetailLoss(left.detailLoss, right.detailLoss) ||
    compareLossQuantities(left.lossQuantity, right.lossQuantity) ||
    compareBooleans(left.wholeResultUnavailable, right.wholeResultUnavailable) ||
    left.count - right.count ||
    compareBooleans(left.countSaturated, right.countSaturated) ||
    compareCodeUnits(left.severity, right.severity)
  );
}

function compareDiagnosticTargets(left: ProfileTarget, right: ProfileTarget): number {
  const order: Readonly<Record<ProfileTarget["type"], number>> = {
    report: 0,
    scope: 1,
    observation: 2,
    point: 3,
  };
  const byType = order[left.type] - order[right.type];
  if (byType !== 0) return byType;
  if (left.type === "report" || right.type === "report") return 0;
  const byScope = compareProfileScopes(left.scope, right.scope);
  if (byScope !== 0 || left.type === "scope" || right.type === "scope") return byScope;
  return compareProfileIdentity(
    {
      scope: left.scope,
      name: left.name,
      kind: left.kind,
      attributes: left.type === "point" ? left.attributes : [],
    },
    {
      scope: right.scope,
      name: right.name,
      kind: right.kind,
      attributes: right.type === "point" ? right.attributes : [],
    },
  );
}

function compareStringArrays(left: readonly string[], right: readonly string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = compareCodeUnits(left[index] ?? "", right[index] ?? "");
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function compareAttributeKeySelectors(
  left: ProfileDiagnostic["attributeKey"],
  right: ProfileDiagnostic["attributeKey"],
): number {
  const order = { not_applicable: 0, exact: 1, discarded: 2 } as const;
  const byType = order[left.type] - order[right.type];
  return (
    byType ||
    (left.type === "exact" && right.type === "exact" ? compareCodeUnits(left.key, right.key) : 0)
  );
}

function compareLossQuantities(
  left: ProfileLossQuantity | null,
  right: ProfileLossQuantity | null,
): number {
  if (left === null || right === null) return left === right ? 0 : left === null ? -1 : 1;
  return (
    compareCodeUnits(left.descriptor, right.descriptor) ||
    compareCodeUnits(left.unit, right.unit) ||
    compareNullableNumbers(left.value, right.value) ||
    compareBooleans(left.saturated, right.saturated)
  );
}

function compareAffectedFields(
  left: ProfileDiagnostic["affectedFields"],
  right: ProfileDiagnostic["affectedFields"],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (!leftItem || !rightItem) continue;
    const comparison =
      compareCodeUnits(leftItem.kind, rightItem.kind) ||
      compareStringArrays(leftItem.fields, rightItem.fields);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function compareDetailLoss(
  left: ProfileDiagnostic["detailLoss"],
  right: ProfileDiagnostic["detailLoss"],
): number {
  for (const field of [
    "pointAttributes",
    "observationIdentity",
    "scopeIdentity",
    "attributeKey",
    "affectedFields",
  ] as const) {
    const comparison = compareBooleans(left[field], right[field]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null || right === null) return left === right ? 0 : left === null ? -1 : 1;
  return left - right;
}

function compareBooleans(left: boolean, right: boolean): number {
  return Number(left) - Number(right);
}

function diagnosticMatchesMeasurement(
  diagnostic: ProfileDiagnostic,
  row: ProfileMeasurement,
): boolean {
  if (diagnostic.target.type === "observation") return diagnostic.target.kind === row.kind;
  if (diagnostic.target.type !== "point" || row.kind === "span") return false;
  return (
    diagnostic.target.kind === row.kind &&
    compareAttributeSets(diagnostic.target.attributes, row.value.attributes) === 0
  );
}

export function partitionNameDiagnostics(
  rows: readonly ProfileMeasurement[],
  diagnostics: readonly ProfileDiagnostic[],
): { matched: ProfileDiagnostic[]; unmatched: IssueOnlyTarget[] } {
  const matched = diagnostics.filter((diagnostic) =>
    rows.some((row) => diagnosticMatchesMeasurement(diagnostic, row)),
  );
  const unmatched: IssueOnlyTarget[] = [];
  for (const diagnostic of diagnostics) {
    if (matched.includes(diagnostic)) continue;
    if (diagnostic.target.type !== "observation" && diagnostic.target.type !== "point") continue;
    const existing = unmatched.find(
      (issue) => compareDiagnosticTargets(issue.target, diagnostic.target) === 0,
    );
    if (existing) existing.diagnostics.push(diagnostic);
    else unmatched.push({ target: diagnostic.target, diagnostics: [diagnostic] });
  }
  for (const issue of unmatched) issue.diagnostics.sort(compareDiagnostics);
  unmatched.sort((left, right) => compareDiagnosticTargets(left.target, right.target));
  return { matched, unmatched };
}

function namedEntryTarget(entry: NamedProfileEntry): NamedProfileTarget {
  if (entry.type === "issue") return entry.issue.target;
  const { row } = entry;
  return row.kind === "span"
    ? {
        type: "observation",
        scope: row.value.scope,
        kind: row.kind,
        name: row.value.name,
      }
    : {
        type: "point",
        scope: row.value.scope,
        kind: row.kind,
        name: row.value.name,
        attributes: row.value.attributes,
      };
}

export function namedEntries(
  rows: readonly ProfileMeasurement[],
  issues: readonly IssueOnlyTarget[],
): NamedProfileEntry[] {
  return [
    ...rows.map((row): NamedProfileEntry => ({ type: "measurement", row })),
    ...issues.map((issue): NamedProfileEntry => ({ type: "issue", issue })),
  ].sort((left, right) =>
    compareDiagnosticTargets(namedEntryTarget(left), namedEntryTarget(right)),
  );
}

export function isEntireResultUnavailable(diagnostic: ProfileDiagnostic): boolean {
  return (
    diagnostic.wholeResultUnavailable ||
    (diagnostic.extent === "entire_target" && diagnostic.effects.includes("missing_observations"))
  );
}
