import type { ProfileReport } from "@gitlode/internal-contracts/telemetry";
import chalk, { supportsColorStderr } from "chalk";

import { formatDiagnosticLines } from "../src/presentation/diagnostics.js";
import { formatActiveLine, formatDoneLine } from "../src/presentation/progress/formatters.js";
import type { PhaseSnapshot } from "../src/presentation/progress/types.js";
import {
  formatProfileLines,
  formatSummaryLines,
} from "../src/presentation/reporting/formatters.js";
import { createStyling, type Styling } from "../src/presentation/styling.js";

const mode = process.argv.slice(2);
if (
  (mode.length !== 1 && mode.length !== 2) ||
  (mode[0] !== "--terminal" && mode[0] !== "--plain") ||
  (mode.length === 2 && mode[1] !== "--compare-headings")
) {
  console.error(
    "Usage: npx tsx packages/gitlode/scripts/preview-terminal-styling.ts --terminal|--plain [--compare-headings]",
  );
  process.exit(1);
}
const terminal = mode[0] === "--terminal";
if (terminal && (!process.stdout.isTTY || !process.stderr.isTTY)) {
  console.error("--terminal requires direct TTY stdout and stderr; do not pipe or redirect.");
  process.exit(1);
}

const styling = createStyling(terminal && process.stderr.isTTY === true);
const snapshot: PhaseSnapshot = {
  phase: "extracting",
  startMs: 0,
  nowMs: 1250,
  refIndex: 0,
  refCount: 2,
  commitsTraversed: 1542,
  recordsWritten: 3108,
  bytesWritten: 1250000,
};
const scope = { name: "synthetic.styling", version: "1.0.0" };
const report: ProfileReport = {
  schemaVersion: 2,
  signalStatus: { spans: "complete", counters: "partial", histograms: "complete" },
  spans: [
    {
      scope,
      name: "sample.git.walk",
      callCount: 12,
      errorCount: 0,
      totalDurationSeconds: 0.024,
      maxDurationSeconds: 0.005,
      durationContributionCount: 12,
      unavailableFields: [],
      attributes: [],
    },
  ],
  counters: [
    {
      scope,
      name: "sample.git.objects",
      value: 670,
      unit: "{object}",
      unavailableFields: [],
      attributes: [
        { key: "sample.git.adapter", value: "isomorphic-git" },
        { key: "sample.git.outcome", value: "error" },
        { key: "sample.git.ready", value: true },
      ],
    },
  ],
  histograms: [
    {
      scope,
      name: "sample.git.duration",
      unit: "s",
      count: 2,
      sum: 0.003,
      minimum: null,
      maximum: null,
      explicitBounds: [],
      bucketCounts: [],
      unavailableFields: [],
      attributes: [],
    },
  ],
  diagnostics: [
    {
      code: "invalid_aggregation",
      severity: "warning",
      stage: "report_build",
      target: { type: "observation", scope, kind: "counter", name: "sample.git.missing" },
      signalCoverage: ["counter"],
      effects: ["missing_observations"],
      extent: "entire_target",
      attributeKey: { type: "not_applicable" },
      affectedFields: [],
      detailLoss: {
        pointAttributes: false,
        observationIdentity: false,
        scopeIdentity: false,
        attributeKey: false,
        affectedFields: false,
      },
      lossQuantity: null,
      wholeResultUnavailable: true,
      count: 1,
      countSaturated: false,
      message: null,
      reportDelivery: null,
    },
  ],
};

console.error("SYNTHETIC styling sample: fixed data, no extraction or actual failure.");
console.error(
  mode[1] === "--compare-headings"
    ? "Both candidates below use the real Profile renderer with fixed synthetic data."
    : "Active/done lines below are static samples, not a live progress demonstration.",
);
console.error(
  `Mode: ${terminal ? "terminal" : "plain"}; width: ${process.stderr.columns ?? "unknown"}; ` +
    `Chalk color level: ${chalk.level}; stderr color support: ${supportsColorStderr ? supportsColorStderr.level : "unavailable"}`,
);
if (terminal && chalk.level === 0)
  console.error("Color is unavailable; this run provides plain readability evidence only.");

if (mode[1] === "--compare-headings") {
  // Preview-only candidates reuse the production factory and renderer.
  // Pad before decoration so styled/plain output contains identical text.
  const padded: Styling = {
    ...styling,
    h1: (text) => styling.h1(` ${text} `),
    h2: (text) => styling.h2(` ${text} `),
    h3: (text) => styling.h3(` ${text} `),
    h4: (text) => styling.h4(` ${text} `),
  };
  const candidates: readonly [string, Styling][] = [
    ["A: same namespace style (black on cyan at both depths)", { ...padded, h4: padded.h3 }],
    [
      "C: related namespace styles (black on cyan / bright cyan)",
      {
        ...padded,
        h4: (text) => (terminal ? chalk.black.bgCyanBright(` ${text} `) : ` ${text} `),
      },
    ],
  ];
  const comparisonReport: ProfileReport = {
    ...report,
    counters: [
      ...report.counters,
      {
        scope,
        name: "sample.output.records",
        value: 3108,
        unit: "{record}",
        unavailableFields: [],
        attributes: [],
      },
    ],
  };
  console.error(
    "\nA/C heading comparison: same synthetic data, order and one-space heading padding.",
  );
  console.error("Only the second namespace level's style differs; product styling is unchanged.");
  for (const [label, candidate] of candidates) {
    console.error(`\n${label}`);
    for (const line of formatProfileLines(comparisonReport, candidate)) console.error(line);
  }
} else {
  // Compare Chalk primitives directly, independently of gitlode's semantic roles.
  const chalkSamples: readonly [string, (text: string) => string][] = [
    ["no style", (text) => text],
    ["chalk.bold", chalk.bold],
    ["chalk.dim", chalk.dim],
    ["chalk.bold.dim", chalk.bold.dim],
    ["chalk.italic", chalk.italic],
    ["chalk.underline", chalk.underline],
    ["chalk.inverse", chalk.inverse],
    ["chalk.cyan", chalk.cyan],
    ["chalk.cyan.bold", chalk.cyan.bold],
    ["chalk.cyanBright", chalk.cyanBright],
    ["chalk.white", chalk.white],
    ["chalk.white.bold", chalk.white.bold],
    ["chalk.whiteBright", chalk.whiteBright],
    ["chalk.black.bgYellow", chalk.black.bgYellow],
  ];
  const sampleText = "ABC abc Il1 0123456789 calls=12 total=24 ms";
  console.error("\nChalk primitives (identical text; labels are unstyled):");
  console.error("Compare stroke weight and color/brightness separately.");
  console.error("Record the font and Windows Terminal intenseTextStyle with your observations.");
  console.error("In --plain mode every sample intentionally has no styling.");
  for (const [label, decorate] of chalkSamples)
    console.error(`  ${label.padEnd(20)} | ${terminal ? decorate(sampleText) : sampleText}`);
  console.error("\nHeading padding comparison (preview only; product spacing is unchanged):");
  for (const role of ["h1", "h2", "h3", "h4"] as const) {
    console.error(`  ${role} no padding | ${styling[role]("Heading")}`);
    console.error(`  ${role} one space  | ${styling[role](" Heading ")}`);
  }
  console.error("\ngitlode semantic roles (synthetic renderer output):");

  const lines = [
    "",
    formatActiveLine(snapshot, "⠋", styling),
    formatDoneLine({ ...snapshot, refIndex: 1 }, styling),
    "",
    ...formatSummaryLines(
      {
        recordsWritten: snapshot.recordsWritten,
        commitsTraversed: snapshot.commitsTraversed,
        filesCreated: 2,
        bytesWritten: snapshot.bytesWritten,
        elapsedMs: snapshot.nowMs,
        refs: ["main", "release"],
      },
      styling,
    ),
    "",
    ...formatDiagnosticLines("warn", "Synthetic warning; no extraction was attempted.", styling),
    ...formatDiagnosticLines("error", "Synthetic error; no application failure occurred.", styling),
    "",
    ...formatProfileLines(report, styling),
  ];
  for (const line of lines) console.error(line);
}
