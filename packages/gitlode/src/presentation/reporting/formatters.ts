import {
  compareCodeUnits,
  compareProfileScopes,
  deriveCounterNumericAvailability,
  deriveHistogramNumericAvailability,
  deriveSpanNumericAvailability,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttributeValue,
  ProfileCounterPoint,
  ProfileDiagnostic,
  ProfileDiagnosticSummary,
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileLossQuantity,
  ProfileReport,
  ProfileSpanAggregate,
  ProfileTarget,
} from "@gitlode/internal-contracts/telemetry";

import { formatCount, formatElapsed, humanizeBytes } from "../format-utils.js";
import { plainStyling, type Styling } from "../styling.js";
import {
  compareAttributeSets,
  compareProfileIdentity,
  PROFILE_VIEW_DIAGNOSTIC_LABELS,
} from "./profile-view.js";
import type { SummaryData } from "./types.js";

type ProfileMeasurement =
  | { kind: "span"; value: ProfileSpanAggregate }
  | { kind: "counter"; value: ProfileCounterPoint }
  | { kind: "histogram"; value: ProfileHistogramPoint };

interface NamespaceNode {
  readonly segment: string;
  readonly absoluteName: string;
  readonly rows: ProfileMeasurement[];
  readonly children: Map<string, NamespaceNode>;
}

const UNAVAILABLE = "—";
const TOKEN = /^[A-Za-z0-9_.@-]+$/u;

export function formatSummaryLines(data: SummaryData, styling: Styling = plainStyling): string[] {
  const bytes = humanizeBytes(data.bytesWritten);
  const elapsed = formatElapsed(data.elapsedMs);
  const fields: Array<[string, string]> = [
    ["Records written", styling.primaryValue(formatCount(data.recordsWritten))],
    ["Commits traversed", styling.primaryValue(formatCount(data.commitsTraversed))],
    ["Files created", styling.primaryValue(formatCount(data.filesCreated))],
    ["Bytes written", styling.primaryValue(bytes.value) + styling.unitSuffix(bytes.unit)],
    ["Elapsed time", styling.primaryValue(elapsed.value) + styling.unitSuffix(elapsed.unit)],
    ["Refs", styling.refsValue(data.refs.join(", ") || "(none)")],
  ];
  return [
    styling.summaryHeader("Extraction complete"),
    ...fields.map(
      ([label, value]) =>
        `  ${styling.fieldKey(label.padEnd(18))}${styling.separator(":")} ${value}`,
    ),
  ];
}

export function formatProfileLines(
  report: ProfileReport,
  styling: Styling = plainStyling,
): string[] {
  const measurements: ProfileMeasurement[] = [
    ...report.spans.map((value) => ({ kind: "span" as const, value })),
    ...report.counters.map((value) => ({ kind: "counter" as const, value })),
    ...report.histograms.map((value) => ({ kind: "histogram" as const, value })),
  ].sort(compareMeasurements);
  if (measurements.length === 0 && report.diagnostics.length === 0) return [];

  const lines = [styling.sectionHeading("Profile")];
  appendProfileDiagnostics(lines, report.diagnostics, styling);
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
  const scopeEntries = [...byScope.values()].flatMap((byVersion) => [...byVersion.values()]);
  for (const { scope, rows } of scopeEntries.sort((left, right) =>
    compareProfileScopes(left.scope, right.scope),
  )) {
    lines.push(`  ${styling.sectionHeading(`Scope: ${formatScope(scope)}`)}`);
    const diagnostics = report.diagnostics.filter(
      (diagnostic): diagnostic is ProfileDiagnostic =>
        diagnostic.code !== "diagnostic_overflow" &&
        diagnostic.target.type !== "report" &&
        compareProfileScopes(diagnostic.target.scope, scope) === 0,
    );
    for (const diagnostic of diagnostics
      .filter((item) => item.target.type === "scope")
      .sort(compareDiagnostics))
      appendNotice(lines, diagnostic, 2, styling);
    renderScope(lines, rows, diagnostics, styling);
  }
  return lines;
}

function compareMeasurements(left: ProfileMeasurement, right: ProfileMeasurement): number {
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

function appendProfileDiagnostics(
  lines: string[],
  diagnostics: readonly (ProfileDiagnostic | ProfileDiagnosticSummary)[],
  styling: Styling,
): void {
  if (diagnostics.length === 0) return;
  const detailed = diagnostics.filter(
    (diagnostic): diagnostic is ProfileDiagnostic => diagnostic.code !== "diagnostic_overflow",
  );
  const summaries = diagnostics.filter(
    (diagnostic): diagnostic is ProfileDiagnosticSummary =>
      diagnostic.code === "diagnostic_overflow",
  );
  const delivery = detailed.find((diagnostic) => diagnostic.reportDelivery !== null);
  if (delivery?.reportDelivery) {
    const result =
      delivery.reportDelivery.measurementResults === "trusted_snapshot"
        ? "validated measurement results are shown below"
        : "measurement results could not be provided";
    lines.push(`  ${styling.warnBadge("!")} Profile report construction failed; ${result}.`);
    if (delivery.reportDelivery.priorIssueDetail === "unavailable")
      lines.push(`  ${styling.warnBadge("!")} Earlier collection issue details are unavailable.`);
  } else {
    const hasCollection =
      detailed.some((diagnostic) =>
        diagnostic.effects.some((effect) => effect !== "lifecycle_notice"),
      ) ||
      summaries.some(
        (summary) =>
          summary.effectsByKind.some((item) =>
            item.effects.some((effect) => effect !== "lifecycle_notice"),
          ) || summary.reportEffects.some((effect) => effect !== "lifecycle_notice"),
      );
    const hasLifecycle =
      detailed.some((diagnostic) => diagnostic.effects.includes("lifecycle_notice")) ||
      summaries.some(
        (summary) =>
          summary.effectsByKind.some((item) => item.effects.includes("lifecycle_notice")) ||
          summary.reportEffects.includes("lifecycle_notice"),
      );
    const headline =
      hasCollection && hasLifecycle
        ? "Collection and telemetry lifecycle issues detected."
        : hasCollection
          ? "Collection issues detected."
          : hasLifecycle
            ? "Telemetry lifecycle issues detected."
            : "Collection or telemetry lifecycle issue details were omitted.";
    const warning =
      detailed.some((diagnostic) => diagnostic.severity === "warning") ||
      summaries.some((summary) => summary.maximumSeverity === "warning");
    const marker = warning ? styling.warnBadge("!") : "!";
    lines.push(`  ${marker} ${headline}`);
  }
  for (const diagnostic of detailed
    .filter((item) => item.target.type === "report" && item !== delivery)
    .sort(compareDiagnostics))
    appendNotice(lines, diagnostic, 1, styling);
  for (const summary of summaries) appendSummaryNotice(lines, summary, styling);
}

function appendSummaryNotice(
  lines: string[],
  summary: ProfileDiagnosticSummary,
  styling: Styling,
): void {
  const marker = summary.maximumSeverity === "warning" ? styling.warnBadge("!") : "!";
  const count =
    summary.omittedOccurrences === null
      ? "the number of omitted occurrences is unknown"
      : `${summary.omittedOccurrences} occurrence${summary.omittedOccurrences === 1 ? "" : "s"} omitted`;
  const provenance =
    summary.priorIssueDetail === "unavailable" ? "; prior issue detail unavailable" : "";
  lines.push(`  ${marker} Additional diagnostic detail omitted (${count}${provenance}).`);
}

function diagnosticsForName(
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

function compareDiagnostics(left: ProfileDiagnostic, right: ProfileDiagnostic): number {
  return (
    compareDiagnosticTargets(left.target, right.target) ||
    compareCodeUnits(left.code, right.code) ||
    compareCodeUnits(left.stage, right.stage) ||
    compareStringArrays(left.effects, right.effects) ||
    compareStringArrays(left.signalCoverage, right.signalCoverage) ||
    compareCodeUnits(left.extent, right.extent) ||
    compareAttributeKeySelectors(left.attributeKey, right.attributeKey) ||
    compareCodeUnits(JSON.stringify(left.affectedFields), JSON.stringify(right.affectedFields)) ||
    compareCodeUnits(JSON.stringify(left.detailLoss), JSON.stringify(right.detailLoss)) ||
    compareLossQuantities(left.lossQuantity, right.lossQuantity) ||
    Number(left.wholeResultUnavailable) - Number(right.wholeResultUnavailable)
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
    compareCodeUnits(left.descriptor, right.descriptor) || compareCodeUnits(left.unit, right.unit)
  );
}

function appendMeasurementDiagnostics(
  lines: string[],
  row: ProfileMeasurement,
  diagnostics: readonly ProfileDiagnostic[],
  depth: number,
  styling: Styling,
): void {
  for (const diagnostic of diagnostics) {
    if (diagnostic.target.type === "point") {
      if (row.kind === "span" || diagnostic.target.kind !== row.kind) continue;
      if (compareAttributeSets(diagnostic.target.attributes, row.value.attributes) !== 0) continue;
    } else if (diagnostic.target.type === "observation" && diagnostic.target.kind !== row.kind)
      continue;
    appendNotice(lines, diagnostic, depth, styling);
  }
}

function appendNotice(
  lines: string[],
  diagnostic: ProfileDiagnostic,
  depth: number,
  styling: Styling,
): void {
  const marker = diagnostic.severity === "warning" ? styling.warnBadge("!") : "!";
  lines.push(`${"  ".repeat(depth)}${marker} ${diagnosticText(diagnostic)}`);
}

function diagnosticText(diagnostic: ProfileDiagnostic): string {
  const attribute =
    diagnostic.attributeKey.type === "exact" ? `${formatToken(diagnostic.attributeKey.key)}: ` : "";
  let text: string;
  if (diagnostic.code === "metric_point_overflow")
    text = "Additional attribute combinations omitted: datapoint retention limit reached.";
  else if (diagnostic.code === "span_group_overflow")
    text = "Additional Span groups omitted: retention limit reached.";
  else if (diagnostic.code === "span_attribute_value_overflow")
    text = `${attribute}additional attribute values omitted; retention limit reached.`;
  else if (diagnostic.code === "attribute_reducer_conflict")
    text = `${attribute}conflicting Span attribute values were retained only as bounded summary detail.`;
  else if (diagnostic.code === "invalid_aggregation") {
    if (
      diagnostic.lossQuantity?.descriptor === "span_duration_contributions" &&
      diagnostic.lossQuantity.value !== null
    ) {
      const count = diagnostic.lossQuantity.value;
      text = `Duration summary excludes ${count}${diagnostic.lossQuantity.saturated ? "+" : ""} invalid duration${count === 1 ? "" : "s"}`;
      const fields = diagnostic.affectedFields
        .flatMap((item) => item.fields)
        .filter((field) => field === "avg" || field === "total" || field === "max");
      if (fields.length > 0) text += `; ${fields.join("/")} unavailable`;
      text += ".";
    } else if (isEntireResultUnavailable(diagnostic))
      text = "No valid result retained: invalid aggregation discarded.";
    else text = "Invalid aggregation detail was discarded.";
  } else if (diagnostic.code === "lifecycle_failure") {
    const stage: Readonly<Record<ProfileDiagnostic["stage"], string>> = {
      span_aggregation: "Span aggregation",
      trace_flush: "Trace flush",
      metric_collection: "Metric collection",
      report_build: "Profile report construction",
      telemetry_shutdown: "Telemetry shutdown",
    };
    text = `${stage[diagnostic.stage]} failed`;
    if (diagnostic.extent === "unidentified_subset" && diagnostic.target.type === "report")
      text += "; affected scopes and observation names are unknown";
    text += ".";
  } else text = `${PROFILE_VIEW_DIAGNOSTIC_LABELS[diagnostic.code] ?? diagnostic.code}.`;

  if (diagnostic.lossQuantity) {
    if (diagnostic.lossQuantity.value === null) text += " The amount of lost data is unknown.";
    else if (diagnostic.lossQuantity.descriptor !== "span_duration_contributions")
      text += ` ${formatKnownLoss(diagnostic.lossQuantity)}`;
  }
  if (diagnostic.detailLoss.attributeKey) text += " The affected attribute key is unknown.";
  if (diagnostic.detailLoss.affectedFields) text += " Affected field detail was omitted.";
  if (diagnostic.count > 1)
    text += ` Repeated ${diagnostic.count}${diagnostic.countSaturated ? "+" : ""} times.`;
  return text;
}

function formatKnownLoss(quantity: ProfileLossQuantity): string {
  const labels: Readonly<Record<ProfileLossQuantity["descriptor"], string>> = {
    span_groups: "Span groups",
    span_duration_contributions: "duration contributions",
    span_attribute_values: "Span attribute values",
    metric_points: "metric points",
    observation_results: "observation results",
  };
  return `Known loss: ${quantity.value}${quantity.saturated ? "+" : ""} ${labels[quantity.descriptor]}; unit=${formatToken(quantity.unit)}.`;
}

function isEntireResultUnavailable(diagnostic: ProfileDiagnostic): boolean {
  return (
    diagnostic.wholeResultUnavailable ||
    (diagnostic.extent === "entire_target" && diagnostic.effects.includes("missing_observations"))
  );
}

function renderScope(
  lines: string[],
  rows: ProfileMeasurement[],
  diagnostics: readonly ProfileDiagnostic[],
  styling: Styling,
): void {
  const roots = new Map<string, NamespaceNode>();
  const malformed: ProfileMeasurement[] = [];
  for (const row of rows) {
    const segments = row.value.name.split(".");
    if (segments.some((segment) => segment.length === 0)) {
      malformed.push(row);
      continue;
    }
    const path = segments.slice(0, 2);
    let nodes = roots;
    let absoluteName = "";
    let targetNode: NamespaceNode | null = null;
    for (const segment of path) {
      absoluteName = absoluteName ? `${absoluteName}.${segment}` : segment;
      const node: NamespaceNode = nodes.get(segment) ?? {
        segment,
        absoluteName,
        rows: [],
        children: new Map(),
      };
      nodes.set(segment, node);
      targetNode = node;
      nodes = node.children;
    }
    targetNode?.rows.push(row);
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.target.type !== "observation" && diagnostic.target.type !== "point") continue;
    const name = diagnostic.target.name;
    if (rows.some((row) => row.value.name === name)) continue;
    const segments = name.split(".");
    if (segments.some((segment) => segment.length === 0)) continue;
    const path = segments.slice(0, 2);
    let nodes = roots;
    let absoluteName = "";
    for (const segment of path) {
      absoluteName = absoluteName ? `${absoluteName}.${segment}` : segment;
      const node: NamespaceNode = nodes.get(segment) ?? {
        segment,
        absoluteName,
        rows: [],
        children: new Map(),
      };
      nodes.set(segment, node);
      nodes = node.children;
    }
  }
  const malformedNames = new Set([
    ...malformed.map((row) => row.value.name),
    ...diagnostics
      .filter(
        (diagnostic) =>
          (diagnostic.target.type === "observation" || diagnostic.target.type === "point") &&
          diagnostic.target.name.split(".").some((segment) => segment.length === 0),
      )
      .map((diagnostic) =>
        diagnostic.target.type === "observation" || diagnostic.target.type === "point"
          ? diagnostic.target.name
          : "",
      ),
  ]);
  for (const name of [...malformedNames].sort(compareCodeUnits)) {
    const namedRows = malformed.filter((row) => row.value.name === name).sort(compareMeasurements);
    const namedDiagnostics = diagnosticsForName(diagnostics, name);
    if (namedRows.length === 0) {
      const unavailable = namedDiagnostics.some(isEntireResultUnavailable);
      lines.push(
        `${"  ".repeat(2)}/${quote(name)}${unavailable ? `${styling.separator(" : ")}unavailable` : ""}`,
      );
      for (const diagnostic of namedDiagnostics) appendNotice(lines, diagnostic, 3, styling);
    } else {
      for (const row of namedRows)
        renderAbsoluteRow(lines, row, 2, styling, undefined, true, namedDiagnostics);
    }
  }
  for (const node of [...roots.values()].sort((a, b) => compareCodeUnits(a.segment, b.segment)))
    renderNode(lines, node, 2, styling, true, diagnostics);
}

function renderNode(
  lines: string[],
  node: NamespaceNode,
  depth: number,
  styling: Styling,
  root: boolean,
  diagnostics: readonly ProfileDiagnostic[],
): void {
  const indent = "  ".repeat(depth);
  const name = `${root ? "/" : ""}${formatToken(node.segment)}`;
  const rows = node.rows.sort(compareMeasurements);
  const ownRows = rows.filter((row) => row.value.name === node.absoluteName);
  const childRows = rows.filter((row) => row.value.name !== node.absoluteName);
  const ownDiagnostics = diagnosticsForName(diagnostics, node.absoluteName);
  const ownRow = ownRows.at(0);
  if (ownRows.length === 1 && ownRow) {
    lines.push(
      `${indent}${styling.sectionHeading(name)}${formatMeasurementFields(ownRow, styling)}`,
    );
    renderAttributes(lines, ownRow, node.absoluteName, depth + 1, styling);
    appendMeasurementDiagnostics(lines, ownRow, ownDiagnostics, depth + 1, styling);
  } else if (ownRows.length === 0 && ownDiagnostics.length > 0) {
    const unavailable = ownDiagnostics.some(isEntireResultUnavailable);
    lines.push(
      `${indent}${styling.sectionHeading(name)}${unavailable ? `${styling.separator(" : ")}unavailable` : ""}`,
    );
    for (const diagnostic of ownDiagnostics) appendNotice(lines, diagnostic, depth + 1, styling);
  } else {
    lines.push(`${indent}${styling.sectionHeading(name)}`);
    for (const diagnostic of ownDiagnostics.filter((item) => item.target.type !== "point"))
      appendNotice(lines, diagnostic, depth + 1, styling);
    for (const row of ownRows)
      renderAbsoluteRow(
        lines,
        row,
        depth + 1,
        styling,
        node.absoluteName,
        false,
        ownDiagnostics.filter((item) => item.target.type === "point"),
      );
  }
  const childNames = new Set([
    ...childRows.map((row) => row.value.name),
    ...diagnostics
      .filter(
        (diagnostic) =>
          (diagnostic.target.type === "observation" || diagnostic.target.type === "point") &&
          diagnostic.target.name.split(".").slice(0, 2).join(".") === node.absoluteName &&
          diagnostic.target.name.startsWith(`${node.absoluteName}.`),
      )
      .map((diagnostic) =>
        diagnostic.target.type === "observation" || diagnostic.target.type === "point"
          ? diagnostic.target.name
          : "",
      ),
  ]);
  for (const childName of [...childNames].sort(compareCodeUnits)) {
    const namedRows = childRows.filter((row) => row.value.name === childName);
    const namedDiagnostics = diagnosticsForName(diagnostics, childName);
    const relativeName = formatToken(childName.slice(node.absoluteName.length + 1));
    if (namedRows.length === 0) {
      const unavailable = namedDiagnostics.some(isEntireResultUnavailable);
      lines.push(
        `${"  ".repeat(depth + 1)}${relativeName}${unavailable ? `${styling.separator(" : ")}unavailable` : ""}`,
      );
      for (const diagnostic of namedDiagnostics)
        appendNotice(lines, diagnostic, depth + 2, styling);
      continue;
    }
    if (namedRows.length > 1 && namedDiagnostics.some((item) => item.target.type !== "point")) {
      lines.push(`${"  ".repeat(depth + 1)}${relativeName}`);
      for (const diagnostic of namedDiagnostics.filter((item) => item.target.type !== "point"))
        appendNotice(lines, diagnostic, depth + 2, styling);
    }
    for (const row of namedRows)
      renderNamedRow(
        lines,
        row,
        relativeName,
        depth + 1,
        node.absoluteName,
        styling,
        namedRows.length > 1
          ? namedDiagnostics.filter((item) => item.target.type === "point")
          : namedDiagnostics,
      );
  }
  for (const child of [...node.children.values()].sort((a, b) =>
    compareCodeUnits(a.segment, b.segment),
  ))
    renderNode(lines, child, depth + 1, styling, false, diagnostics);
}

function renderAbsoluteRow(
  lines: string[],
  row: ProfileMeasurement,
  depth: number,
  styling: Styling,
  attributeBase?: string,
  forceQuote = false,
  diagnostics: readonly ProfileDiagnostic[] = [],
): void {
  renderNamedRow(
    lines,
    row,
    `/` + (forceQuote ? quote(row.value.name) : formatToken(row.value.name)),
    depth,
    attributeBase,
    styling,
    diagnostics,
  );
}

function renderNamedRow(
  lines: string[],
  row: ProfileMeasurement,
  name: string,
  depth: number,
  attributeBase: string | undefined,
  styling: Styling,
  diagnostics: readonly ProfileDiagnostic[] = [],
): void {
  lines.push(`${"  ".repeat(depth)}${name}${formatMeasurementFields(row, styling)}`);
  renderAttributes(lines, row, attributeBase, depth + 1, styling);
  appendMeasurementDiagnostics(lines, row, diagnostics, depth + 1, styling);
}

function formatMeasurementFields(row: ProfileMeasurement, styling: Styling): string {
  const separator = styling.separator(" : ");
  if (row.kind === "span") {
    const span = row.value;
    const available = deriveSpanNumericAvailability(span);
    const avg = available.avg ? span.totalDurationSeconds / span.callCount : null;
    return `${separator}${fields(
      [
        ["calls", available.calls ? exact(span.callCount, styling) : UNAVAILABLE],
        ["total", available.total ? unit(span.totalDurationSeconds, "s", styling) : UNAVAILABLE],
        ["avg", avg === null ? UNAVAILABLE : unit(avg, "s", styling)],
        ["max", available.max ? unit(span.maxDurationSeconds, "s", styling) : UNAVAILABLE],
        ["errors", available.errors ? exact(span.errorCount, styling) : UNAVAILABLE],
      ],
      styling,
    )}`;
  }
  if (row.kind === "counter") {
    const available = deriveCounterNumericAvailability(row.value);
    return `${separator}${available.value ? unit(row.value.value, row.value.unit, styling) : UNAVAILABLE}`;
  }
  const point = row.value;
  const available = deriveHistogramNumericAvailability(point);
  const avg = available.avg ? point.sum / point.count : null;
  return `${separator}${fields(
    [
      ["samples", available.samples ? exact(point.count, styling) : UNAVAILABLE],
      ["total", available.total ? unit(point.sum, point.unit, styling) : UNAVAILABLE],
      ["avg", avg === null ? UNAVAILABLE : unit(avg, point.unit, styling)],
      [
        "min",
        available.min && point.minimum !== null
          ? unit(point.minimum, point.unit, styling)
          : UNAVAILABLE,
      ],
      [
        "max",
        available.max && point.maximum !== null
          ? unit(point.maximum, point.unit, styling)
          : UNAVAILABLE,
      ],
    ],
    styling,
  )}`;
}

function fields(entries: readonly (readonly [string, string])[], styling: Styling): string {
  return entries
    .map(([key, value]) => `${styling.fieldKey(key)}${styling.separator("=")}${value}`)
    .join(styling.separator(", "));
}

function renderAttributes(
  lines: string[],
  row: ProfileMeasurement,
  base: string | undefined,
  depth: number,
  styling: Styling,
): void {
  if (row.kind === "span") {
    for (const attribute of [...row.value.attributes].sort((a, b) =>
      compareCodeUnits(a.key, b.key),
    ))
      renderAttributeLine(
        lines,
        attribute.key,
        formatSpanAttribute(attribute, row.value.callCount, styling),
        base,
        depth,
        styling,
      );
    return;
  }
  for (const attribute of [...row.value.attributes].sort((a, b) => compareCodeUnits(a.key, b.key)))
    renderAttributeLine(
      lines,
      attribute.key,
      styling.primaryValue(formatAttributeValue(attribute.value)),
      base,
      depth,
      styling,
    );
}

function renderAttributeLine(
  lines: string[],
  key: string,
  value: string,
  base: string | undefined,
  depth: number,
  styling: Styling,
): void {
  lines.push(
    `${"  ".repeat(depth)}${styling.fieldKey(formatAttributeKey(key, base))} ${styling.separator("=")} ${value}`,
  );
}

function formatSpanAttribute(
  attribute: ProfileSpanAggregate["attributes"][number],
  callCount: number,
  styling: Styling,
): string {
  const observed = formatObservedCoverage(attribute.observedCount, callCount, styling);
  if (attribute.reducer === "single")
    return styling.primaryValue(formatAttributeValue(attribute.value)) + observed;
  if (attribute.reducer === "distinct")
    return (
      attribute.values
        .map(
          ({ value, count }) =>
            styling.primaryValue(formatAttributeValue(value)) +
            styling.separator("(") +
            styling.primaryValue(String(count)) +
            styling.separator(")"),
        )
        .join(styling.separator(", ")) + observed
    );
  return (
    styling.primaryValue(formatNumber(attribute.minimum)) +
    styling.separator("…") +
    styling.primaryValue(formatNumber(attribute.maximum)) +
    observed
  );
}

function formatObservedCoverage(
  observedCount: number,
  callCount: number,
  styling: Styling,
): string {
  return observedCount < callCount
    ? styling.separator(" (") +
        styling.fieldKey("observed") +
        " " +
        styling.primaryValue(String(observedCount)) +
        styling.separator(")")
    : "";
}

function formatAttributeKey(key: string, base: string | undefined): string {
  if (base && key.startsWith(`${base}.`) && key.length > base.length + 1)
    return formatToken(key.slice(base.length + 1));
  return `/` + formatToken(key);
}

function formatAttributeValue(value: ProfileAttributeValue): string {
  if (typeof value !== "string") return String(value);
  if (value === "true" || value === "false" || isFiniteNumberString(value)) return quote(value);
  return formatToken(value);
}

function isFiniteNumberString(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function formatScope(scope: ProfileInstrumentationScope): string {
  const name = formatScopeToken(scope.name);
  return scope.version === null ? name : `${name}@${formatScopeToken(scope.version)}`;
}

function formatScopeToken(value: string): string {
  return value.length === 0 ||
    /[\s"\\\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(value)
    ? quote(value)
    : value;
}

function formatToken(value: string): string {
  return TOKEN.test(value) && !value.startsWith("/") ? value : quote(value);
}

function quote(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function exact(value: number, styling: Styling): string {
  return styling.primaryValue(formatCount(value));
}

function unit(value: number, canonicalUnit: string, styling: Styling): string {
  const formatted = formatUnit(value, canonicalUnit);
  return styling.primaryValue(formatted.value) + styling.unitSuffix(` ${formatted.unit}`);
}

function formatUnit(value: number, canonicalUnit: string): { value: string; unit: string } {
  if (canonicalUnit === "s") return scaledUnit(value, ["ns", "µs", "ms", "s"], 1000, 1e9);
  if (canonicalUnit === "By") return scaledUnit(value, ["B", "KiB", "MiB", "GiB"], 1024, 1);
  const entityUnits: Readonly<Record<string, string>> = {
    "{commit}": "commits",
    "{record}": "records",
    "{file}": "files",
    "{object}": "objects",
    "{change}": "changes",
    "{node}": "nodes",
    "{step}": "steps",
    "{operation}": "operations",
    "{expansion}": "expansions",
    "{fallback}": "fallbacks",
  };
  return {
    value: Number.isSafeInteger(value) ? String(value) : formatNumber(value),
    unit: entityUnits[canonicalUnit] ?? canonicalUnit,
  };
}

function scaledUnit(
  value: number,
  units: readonly string[],
  threshold: number,
  initialScale: number,
): { value: string; unit: string } {
  if (value === 0)
    return { value: "0", unit: units[initialScale === 1 ? 0 : units.length - 1] ?? "" };
  let scaled = value * initialScale;
  let index = 0;
  while (Math.abs(scaled) >= threshold && index < units.length - 1) {
    scaled /= threshold;
    index += 1;
  }
  let rendered = formatNumber(scaled);
  if (Math.abs(Number(rendered)) >= threshold && index < units.length - 1) {
    scaled /= threshold;
    index += 1;
    rendered = formatNumber(scaled);
  }
  return { value: rendered, unit: units[index] ?? "" };
}

function formatNumber(value: number): string {
  if (value === 0) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1e-3 && absolute < 1e7) return Number(value.toPrecision(4)).toString();
  return value
    .toExponential(3)
    .replace(/\.0+(?=e)/u, "")
    .replace(/(\.\d*?[1-9])0+(?=e)/u, "$1");
}
