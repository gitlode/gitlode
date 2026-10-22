import { compareCodeUnits } from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttributeValue,
  ProfileDiagnostic,
  ProfileDiagnosticSummary,
  ProfileReport,
} from "@gitlode/internal-contracts/telemetry";

import type { TerminalSink } from "../progress/types.js";
import { plainStyling, type Styling } from "../styling.js";
import {
  buildScopeTree,
  compareMeasurements,
  compareDiagnostics,
  prepareObservationGroup,
  groupObservations,
  groupProfileScopes,
  isEntireResultUnavailable,
  type ScopeContext,
  type NamespaceNode,
  type IssueOnlyTarget,
  type ProfileMeasurement,
} from "./profile-data.js";
import { profileLayout } from "./profile-layout.js";
import {
  diagnosticText,
  formatAttributeKey,
  formatAttributeValue,
  formatMeasurementFields,
  formatScopeIdentity,
  formatSpanAttribute,
  formatToken,
  quote,
} from "./profile-values.js";
import { compareAttributeSets } from "./profile-view.js";

type ProfileSink = Pick<TerminalSink, "writeLine">;
interface RenderOptions {
  readonly depth: number;
  readonly attributeBase?: string;
}
interface NamedRowOptions extends RenderOptions {
  readonly displayName: string;
}
interface MeasurementContext {
  readonly row: ProfileMeasurement;
  readonly diagnostics: readonly ProfileDiagnostic[];
}
interface NamespaceContext {
  readonly node: NamespaceNode;
}

/** Heading decoration depends only on display depth, never on the entry kind. */
function headingStyle(styling: Styling, depth: number): (text: string) => string {
  return [styling.h1, styling.h2, styling.h3, styling.h4][depth] ?? ((text: string) => text);
}

/** Emit synchronously; a rendering/sink failure propagates without replaying already written lines. */
export function renderProfile(
  sink: ProfileSink,
  report: ProfileReport,
  styling: Styling = plainStyling,
  options: Readonly<typeof profileLayout> = profileLayout,
): void {
  if (
    report.spans.length +
      report.counters.length +
      report.histograms.length +
      report.diagnostics.length ===
    0
  )
    return;
  const scopes = groupProfileScopes(report);
  sink.writeLine(styling.h1("Profile"));
  renderProfileDiagnostics(sink, report.diagnostics, styling, { depth: 1 });
  for (const scope of scopes)
    renderScope(sink, scope, styling, { depth: 1, namespaceDepth: options.namespaceDepth });
}

function renderScope(
  sink: ProfileSink,
  context: ScopeContext,
  styling: Styling,
  options: RenderOptions & { readonly namespaceDepth: number },
): void {
  const { scope, diagnostics } = context;
  const { depth } = options;
  sink.writeLine("  ".repeat(depth) + styling.h2("Scope: " + formatScopeIdentity(scope)));
  for (const diagnostic of diagnostics
    .filter((item) => item.target.type === "scope")
    .sort(compareDiagnostics))
    renderNotice(sink, diagnostic, styling, { depth: depth + 1 });
  const { roots, ungrouped } = buildScopeTree(context, options.namespaceDepth);
  renderUngroupedObservations(sink, ungrouped, styling, {
    depth: depth + 1,
  });
  for (const node of roots) renderNamespace(sink, { node }, styling, { depth: depth + 1 });
}

function renderUngroupedObservations(
  sink: ProfileSink,
  context: {
    readonly rows: readonly ProfileMeasurement[];
    readonly diagnostics: readonly ProfileDiagnostic[];
  },
  styling: Styling,
  options: RenderOptions,
): void {
  const { rows, diagnostics } = context;
  const { depth } = options;
  for (const group of groupObservations(rows, diagnostics)) {
    const observationName = group.observationName;
    const forceQuote = observationName.split(".").some((segment) => segment.length === 0);
    const absoluteName = "/" + (forceQuote ? quote(observationName) : formatToken(observationName));
    if (group.sharedDiagnostics.length > 0) {
      sink.writeLine(`${"  ".repeat(depth)}${headingStyle(styling, depth)(absoluteName)}`);
      for (const diagnostic of group.sharedDiagnostics)
        renderNotice(sink, diagnostic, styling, { depth: depth + 1 });
    }
    for (const entry of group.entries) {
      if (entry.type === "issue")
        renderIssueOnlyRow(sink, entry.issue, styling, {
          displayName: absoluteName,
          depth: depth,
          attributeBase: undefined,
        });
      else
        renderAbsoluteRow(
          sink,
          {
            row: entry.row,
            diagnostics: group.measurementDiagnostics,
          },
          styling,
          { depth: depth, attributeBase: undefined, forceQuote },
        );
    }
  }
}

function renderProfileDiagnostics(
  sink: ProfileSink,
  context: readonly (ProfileDiagnostic | ProfileDiagnosticSummary)[],
  styling: Styling,
  options: RenderOptions,
): void {
  const diagnostics = context;
  const { depth } = options;
  const indent = "  ".repeat(depth);
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
    sink.writeLine(
      `${indent}${styling.warning("!")} Profile report construction failed; ${result}.`,
    );
    if (delivery.reportDelivery.priorIssueDetail === "unavailable")
      sink.writeLine(
        `${indent}${styling.warning("!")} Earlier collection issue details are unavailable.`,
      );
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
    const marker = warning ? styling.warning("!") : "!";
    sink.writeLine(`${indent}${marker} ${headline}`);
  }
  for (const diagnostic of detailed
    .filter((item) => item.target.type === "report" && item !== delivery)
    .sort(compareDiagnostics))
    renderNotice(sink, diagnostic, styling, { depth: depth });
  for (const summary of summaries) renderSummaryNotice(sink, summary, styling, { depth });
}

function renderSummaryNotice(
  sink: ProfileSink,
  summary: ProfileDiagnosticSummary,
  styling: Styling,
  options: RenderOptions,
): void {
  const indent = "  ".repeat(options.depth);
  const marker = summary.maximumSeverity === "warning" ? styling.warning("!") : "!";
  const count =
    summary.omittedOccurrences === null
      ? "the number of omitted occurrences is unknown"
      : `${summary.omittedOccurrences} occurrence${summary.omittedOccurrences === 1 ? "" : "s"} omitted`;
  const provenance =
    summary.priorIssueDetail === "unavailable" ? "; prior issue detail unavailable" : "";
  sink.writeLine(
    `${indent}${marker} Additional diagnostic detail omitted (${count}${provenance}).`,
  );
}

function renderMeasurementDiagnostics(
  sink: ProfileSink,
  context: MeasurementContext,
  styling: Styling,
  options: RenderOptions,
): void {
  const { row, diagnostics } = context;
  const { depth } = options;
  for (const diagnostic of diagnostics) {
    if (diagnostic.target.type === "point") {
      if (row.kind === "span" || diagnostic.target.kind !== row.kind) continue;
      if (compareAttributeSets(diagnostic.target.attributes, row.value.attributes) !== 0) continue;
    } else if (diagnostic.target.type === "observation" && diagnostic.target.kind !== row.kind)
      continue;
    renderNotice(sink, diagnostic, styling, { depth: depth, row: row });
  }
}

function renderIssueOnlyRow(
  sink: ProfileSink,
  issue: IssueOnlyTarget,
  styling: Styling,
  options: NamedRowOptions,
): void {
  const { displayName, depth, attributeBase } = options;
  const unavailable = issue.diagnostics.some(isEntireResultUnavailable);
  sink.writeLine(
    `${"  ".repeat(depth)}${headingStyle(styling, depth)(displayName)}${unavailable ? `${styling.separator(" : ")}unavailable` : ""}`,
  );
  if (issue.target.type === "point")
    renderPointAttributes(sink, issue.target.attributes, styling, {
      attributeBase: attributeBase,
      depth: depth + 1,
    });
  for (const diagnostic of issue.diagnostics)
    renderNotice(sink, diagnostic, styling, { depth: depth + 1 });
}

function renderNotice(
  sink: ProfileSink,
  diagnostic: ProfileDiagnostic,
  styling: Styling,
  options: RenderOptions & { readonly row?: ProfileMeasurement },
): void {
  const { depth, row } = options;
  const marker = diagnostic.severity === "warning" ? styling.warning("!") : "!";
  sink.writeLine(`${"  ".repeat(depth)}${marker} ${diagnosticText(diagnostic, row)}`);
}

function renderNamespace(
  sink: ProfileSink,
  context: NamespaceContext,
  styling: Styling,
  options: RenderOptions,
): void {
  renderNamespaceHeading(sink, context, styling, options);
  renderNamespaceObservations(sink, context, styling, options);
  for (const child of [...context.node.children.values()].sort((a, b) =>
    compareCodeUnits(a.segment, b.segment),
  ))
    renderNamespace(sink, { node: child }, styling, {
      depth: options.depth + 1,
    });
}

/** Render the heading and its own result, or separate absolute rows for colliding identities. */
function renderNamespaceHeading(
  sink: ProfileSink,
  context: NamespaceContext,
  styling: Styling,
  options: RenderOptions,
): void {
  const { node } = context;
  const { diagnostics } = node;
  const { depth } = options;
  const indent = "  ".repeat(depth);
  const name = `${depth === 2 ? "/" : ""}${formatToken(node.segment)}`;
  const heading = headingStyle(styling, depth);
  const group = prepareObservationGroup(node.absoluteName, node.rows, diagnostics);
  const ownEntries = group.entries;
  const ownEntry = ownEntries.at(0);
  if (ownEntries.length === 1 && ownEntry?.type === "measurement") {
    const ownRow = ownEntry.row;
    sink.writeLine(`${indent}${heading(name)}${formatMeasurementFields(ownRow, styling)}`);
    renderAttributes(sink, ownRow, styling, { attributeBase: node.absoluteName, depth: depth + 1 });
    renderMeasurementDiagnostics(
      sink,
      { row: ownRow, diagnostics: group.measurementDiagnostics },
      styling,
      { depth: depth + 1 },
    );
  } else if (ownEntries.length === 1 && ownEntry?.type === "issue") {
    renderIssueOnlyRow(sink, ownEntry.issue, styling, {
      displayName: name,
      depth: depth,
      attributeBase: node.absoluteName,
    });
  } else {
    sink.writeLine(`${indent}${heading(name)}`);
    for (const diagnostic of group.sharedDiagnostics)
      renderNotice(sink, diagnostic, styling, { depth: depth + 1 });
    for (const entry of ownEntries) {
      if (entry.type === "issue")
        renderIssueOnlyRow(sink, entry.issue, styling, {
          displayName: `/${formatToken(node.absoluteName)}`,
          depth: depth + 1,
          attributeBase: node.absoluteName,
        });
      else
        renderAbsoluteRow(
          sink,
          {
            row: entry.row,
            diagnostics: group.measurementDiagnostics,
          },
          styling,
          { depth: depth + 1, attributeBase: node.absoluteName, forceQuote: false },
        );
    }
  }
}

function renderNamespaceObservations(
  sink: ProfileSink,
  context: NamespaceContext,
  styling: Styling,
  options: RenderOptions,
): void {
  const { node } = context;
  const { diagnostics } = node;
  const { depth } = options;
  const childRows = [...node.rows]
    .sort(compareMeasurements)
    .filter((row) => row.value.name !== node.absoluteName);
  const childDiagnostics = diagnostics.filter(
    (diagnostic) =>
      (diagnostic.target.type === "observation" || diagnostic.target.type === "point") &&
      diagnostic.target.name.startsWith(node.absoluteName + "."),
  );
  for (const group of groupObservations(childRows, childDiagnostics)) {
    const relativeName = formatToken(group.observationName.slice(node.absoluteName.length + 1));
    if (group.sharedDiagnostics.length > 0) {
      sink.writeLine(`${"  ".repeat(depth + 1)}${headingStyle(styling, depth + 1)(relativeName)}`);
      for (const diagnostic of group.sharedDiagnostics)
        renderNotice(sink, diagnostic, styling, { depth: depth + 2 });
    }
    for (const entry of group.entries) {
      if (entry.type === "issue")
        renderIssueOnlyRow(sink, entry.issue, styling, {
          displayName: relativeName,
          depth: depth + 1,
          attributeBase: node.absoluteName,
        });
      else
        renderObservation(
          sink,
          {
            row: entry.row,
            diagnostics: group.measurementDiagnostics,
          },
          styling,
          { displayName: relativeName, depth: depth + 1, attributeBase: node.absoluteName },
        );
    }
  }
}

function renderAbsoluteRow(
  sink: ProfileSink,
  context: MeasurementContext,
  styling: Styling,
  options: RenderOptions & { readonly forceQuote?: boolean },
): void {
  const { row, diagnostics } = context;
  const { depth, attributeBase, forceQuote = false } = options;
  renderObservation(sink, { row: row, diagnostics: diagnostics }, styling, {
    displayName: `/` + (forceQuote ? quote(row.value.name) : formatToken(row.value.name)),
    depth: depth,
    attributeBase: attributeBase,
  });
}

function renderObservation(
  sink: ProfileSink,
  context: MeasurementContext,
  styling: Styling,
  options: NamedRowOptions,
): void {
  const { row, diagnostics } = context;
  const { displayName, depth, attributeBase } = options;
  sink.writeLine(
    `${"  ".repeat(depth)}${headingStyle(styling, depth)(displayName)}${formatMeasurementFields(row, styling)}`,
  );
  renderAttributes(sink, row, styling, { attributeBase: attributeBase, depth: depth + 1 });
  renderMeasurementDiagnostics(sink, { row: row, diagnostics: diagnostics }, styling, {
    depth: depth + 1,
  });
}

function renderAttributes(
  sink: ProfileSink,
  row: ProfileMeasurement,
  styling: Styling,
  options: RenderOptions,
): void {
  const { depth, attributeBase: base } = options;
  if (row.kind === "span") {
    for (const attribute of [...row.value.attributes].sort((a, b) =>
      compareCodeUnits(a.key, b.key),
    ))
      renderAttribute(
        sink,
        { key: attribute.key, value: formatSpanAttribute(attribute, row.value.callCount, styling) },
        styling,
        { attributeBase: base, depth: depth },
      );
    return;
  }
  for (const attribute of [...row.value.attributes].sort((a, b) => compareCodeUnits(a.key, b.key)))
    renderAttribute(
      sink,
      { key: attribute.key, value: styling.value(formatAttributeValue(attribute.value)) },
      styling,
      { attributeBase: base, depth: depth },
    );
}

function renderPointAttributes(
  sink: ProfileSink,
  attributes: readonly { readonly key: string; readonly value: ProfileAttributeValue }[],
  styling: Styling,
  options: RenderOptions,
): void {
  const { depth, attributeBase: base } = options;
  for (const attribute of [...attributes].sort((a, b) => compareCodeUnits(a.key, b.key)))
    renderAttribute(
      sink,
      { key: attribute.key, value: styling.value(formatAttributeValue(attribute.value)) },
      styling,
      { attributeBase: base, depth: depth },
    );
}

function renderAttribute(
  sink: ProfileSink,
  context: { readonly key: string; readonly value: string },
  styling: Styling,
  options: RenderOptions,
): void {
  const { key: attributeName, value: formattedValue } = context;
  const { depth, attributeBase: base } = options;
  sink.writeLine(
    `${"  ".repeat(depth)}${styling.attributeName(formatAttributeKey(attributeName, base))} ${styling.separator("=")} ${formattedValue}`,
  );
}
