import {
  deriveCounterNumericAvailability,
  deriveHistogramNumericAvailability,
  deriveSpanNumericAvailability,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttributeValue,
  ProfileDiagnostic,
  ProfileInstrumentationScope,
  ProfileLossQuantity,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";

import { formatCount } from "../format-utils.js";
import type { Styling } from "../styling.js";
import { isEntireResultUnavailable, type ProfileMeasurement } from "./profile-data.js";
import { PROFILE_VIEW_DIAGNOSTIC_LABELS } from "./profile-view.js";

const UNAVAILABLE = "—";
const TOKEN = /^[A-Za-z0-9_.@-]+$/u;

export function diagnosticText(diagnostic: ProfileDiagnostic, row?: ProfileMeasurement): string {
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
        .filter((item) => item.kind === "span")
        .flatMap((item) => item.fields)
        .filter((field) => field === "avg" || field === "total" || field === "max");
      const availability = row?.kind === "span" ? deriveSpanNumericAvailability(row.value) : null;
      const unavailableFields =
        availability === null ? [] : fields.filter((field) => !availability[field]);
      const labels: Readonly<Record<(typeof fields)[number], string>> = {
        total: "total",
        avg: "average",
        max: "maximum",
      };
      if (unavailableFields.length > 0)
        text += `; ${unavailableFields.map((field) => labels[field]).join("/")} unavailable`;
      else if (fields.length > 0 && availability === null) text += "; duration summary incomplete";
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

export function formatMeasurementFields(row: ProfileMeasurement, styling: Styling): string {
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

export function formatSpanAttribute(
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

export function formatAttributeKey(key: string, base: string | undefined): string {
  if (base && key.startsWith(`${base}.`) && key.length > base.length + 1)
    return formatToken(key.slice(base.length + 1));
  return `/` + formatToken(key);
}

export function formatAttributeValue(value: ProfileAttributeValue): string {
  if (typeof value !== "string") return String(value);
  if (value === "true" || value === "false" || isFiniteNumberString(value)) return quote(value);
  return formatToken(value);
}

function isFiniteNumberString(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

export function formatScopeIdentity(scope: ProfileInstrumentationScope): string {
  const name = formatScopeToken(scope.name);
  return scope.version === null ? name : `${name}@${formatScopeToken(scope.version)}`;
}

function formatScopeToken(value: string): string {
  return value.length === 0 ||
    /[\s"\\\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(value)
    ? quote(value)
    : value;
}

export function formatToken(value: string): string {
  return TOKEN.test(value) && !value.startsWith("/") ? value : quote(value);
}

export function quote(value: string): string {
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
