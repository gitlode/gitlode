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
  diagnosticsForName,
  groupProfileScopes,
  isEntireResultUnavailable,
  namedEntries,
  partitionNameDiagnostics,
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
  readonly name: string;
}
interface MeasurementContext {
  readonly row: ProfileMeasurement;
  readonly diagnostics: readonly ProfileDiagnostic[];
}
interface NamespaceContext {
  readonly node: NamespaceNode;
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
  const { roots, malformed } = buildScopeTree(context, options.namespaceDepth);
  renderMalformedObservations(sink, { rows: malformed, diagnostics }, styling, {
    depth: depth + 1,
  });
  for (const node of roots)
    renderNamespace(sink, { node }, styling, { depth: depth + 1, namespaceLevel: 0 });
}

function renderMalformedObservations(
  sink: ProfileSink,
  context: {
    readonly rows: ProfileMeasurement[];
    readonly diagnostics: readonly ProfileDiagnostic[];
  },
  styling: Styling,
  options: RenderOptions,
): void {
  const { rows: malformed, diagnostics } = context;
  const { depth } = options;
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
    const { matched, unmatched } = partitionNameDiagnostics(namedRows, namedDiagnostics);
    const matchedObservations = matched.filter((item) => item.target.type === "observation");
    if (namedRows.length > 1 && matchedObservations.length > 0) {
      sink.writeLine(`${"  ".repeat(depth)}/${quote(name)}`);
      for (const diagnostic of matchedObservations)
        renderNotice(sink, diagnostic, styling, { depth: depth + 1 });
    }
    for (const entry of namedEntries(namedRows, unmatched)) {
      if (entry.type === "issue")
        renderIssueOnlyRow(sink, entry.issue, styling, {
          name: `/${quote(name)}`,
          depth: depth,
          attributeBase: undefined,
        });
      else
        renderAbsoluteRow(
          sink,
          {
            row: entry.row,
            diagnostics:
              namedRows.length > 1
                ? matched.filter((item) => item.target.type === "point")
                : matched,
          },
          styling,
          { depth: depth, attributeBase: undefined, forceQuote: true },
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
      `${indent}${styling.warnBadge("!")} Profile report construction failed; ${result}.`,
    );
    if (delivery.reportDelivery.priorIssueDetail === "unavailable")
      sink.writeLine(
        `${indent}${styling.warnBadge("!")} Earlier collection issue details are unavailable.`,
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
    const marker = warning ? styling.warnBadge("!") : "!";
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
  const marker = summary.maximumSeverity === "warning" ? styling.warnBadge("!") : "!";
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
  const { name, depth, attributeBase } = options;
  const unavailable = issue.diagnostics.some(isEntireResultUnavailable);
  sink.writeLine(
    `${"  ".repeat(depth)}${name}${unavailable ? `${styling.separator(" : ")}unavailable` : ""}`,
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
  const marker = diagnostic.severity === "warning" ? styling.warnBadge("!") : "!";
  sink.writeLine(`${"  ".repeat(depth)}${marker} ${diagnosticText(diagnostic, row)}`);
}

function renderNamespace(
  sink: ProfileSink,
  context: NamespaceContext,
  styling: Styling,
  options: RenderOptions & { readonly namespaceLevel: number },
): void {
  renderNamespaceHeading(sink, context, styling, options);
  renderNamespaceObservations(sink, context, styling, options);
  for (const child of [...context.node.children.values()].sort((a, b) =>
    compareCodeUnits(a.segment, b.segment),
  ))
    renderNamespace(sink, { node: child }, styling, {
      depth: options.depth + 1,
      namespaceLevel: options.namespaceLevel + 1,
    });
}

function renderNamespaceHeading(
  sink: ProfileSink,
  context: NamespaceContext,
  styling: Styling,
  options: RenderOptions & { readonly namespaceLevel: number },
): void {
  const { node } = context;
  const { diagnostics } = node;
  const { depth, namespaceLevel } = options;
  const indent = "  ".repeat(depth);
  const name = `${namespaceLevel === 0 ? "/" : ""}${formatToken(node.segment)}`;
  const heading = [styling.h3, styling.h4][namespaceLevel] ?? ((text: string) => text);
  const rows = [...node.rows].sort(compareMeasurements);
  const ownRows = rows.filter((row) => row.value.name === node.absoluteName);
  const ownDiagnostics = diagnosticsForName(diagnostics, node.absoluteName);
  const ownPartition = partitionNameDiagnostics(ownRows, ownDiagnostics);
  const ownEntries = namedEntries(ownRows, ownPartition.unmatched);
  const ownEntry = ownEntries.at(0);
  if (ownEntries.length === 1 && ownEntry?.type === "measurement") {
    const ownRow = ownEntry.row;
    sink.writeLine(`${indent}${heading(name)}${formatMeasurementFields(ownRow, styling)}`);
    renderAttributes(sink, ownRow, styling, { attributeBase: node.absoluteName, depth: depth + 1 });
    renderMeasurementDiagnostics(
      sink,
      { row: ownRow, diagnostics: ownPartition.matched },
      styling,
      { depth: depth + 1 },
    );
  } else if (ownEntries.length === 1 && ownEntry?.type === "issue") {
    renderIssueOnlyRow(sink, ownEntry.issue, styling, {
      name: heading(name),
      depth: depth,
      attributeBase: node.absoluteName,
    });
  } else {
    sink.writeLine(`${indent}${heading(name)}`);
    if (ownRows.length > 1) {
      for (const diagnostic of ownPartition.matched.filter(
        (item) => item.target.type === "observation",
      ))
        renderNotice(sink, diagnostic, styling, { depth: depth + 1 });
    }
    for (const entry of ownEntries) {
      if (entry.type === "issue")
        renderIssueOnlyRow(sink, entry.issue, styling, {
          name: `/${formatToken(node.absoluteName)}`,
          depth: depth + 1,
          attributeBase: node.absoluteName,
        });
      else
        renderAbsoluteRow(
          sink,
          {
            row: entry.row,
            diagnostics:
              ownRows.length > 1
                ? ownPartition.matched.filter((item) => item.target.type === "point")
                : ownPartition.matched,
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
  const childNames = new Set([
    ...childRows.map((row) => row.value.name),
    ...diagnostics
      .filter(
        (diagnostic) =>
          (diagnostic.target.type === "observation" || diagnostic.target.type === "point") &&
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
    const partition = partitionNameDiagnostics(namedRows, namedDiagnostics);
    if (
      namedRows.length > 1 &&
      partition.matched.some((item) => item.target.type === "observation")
    ) {
      sink.writeLine(`${"  ".repeat(depth + 1)}${relativeName}`);
      for (const diagnostic of partition.matched.filter(
        (item) => item.target.type === "observation",
      ))
        renderNotice(sink, diagnostic, styling, { depth: depth + 2 });
    }
    for (const entry of namedEntries(namedRows, partition.unmatched)) {
      if (entry.type === "issue")
        renderIssueOnlyRow(sink, entry.issue, styling, {
          name: relativeName,
          depth: depth + 1,
          attributeBase: node.absoluteName,
        });
      else
        renderObservation(
          sink,
          {
            row: entry.row,
            diagnostics:
              namedRows.length > 1
                ? partition.matched.filter((item) => item.target.type === "point")
                : partition.matched,
          },
          styling,
          { name: relativeName, depth: depth + 1, attributeBase: node.absoluteName },
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
    name: `/` + (forceQuote ? quote(row.value.name) : formatToken(row.value.name)),
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
  const { name, depth, attributeBase } = options;
  sink.writeLine(`${"  ".repeat(depth)}${name}${formatMeasurementFields(row, styling)}`);
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
      { key: attribute.key, value: styling.primaryValue(formatAttributeValue(attribute.value)) },
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
      { key: attribute.key, value: styling.primaryValue(formatAttributeValue(attribute.value)) },
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
  const { key, value } = context;
  const { depth, attributeBase: base } = options;
  sink.writeLine(
    `${"  ".repeat(depth)}${styling.fieldKey(formatAttributeKey(key, base))} ${styling.separator("=")} ${value}`,
  );
}
