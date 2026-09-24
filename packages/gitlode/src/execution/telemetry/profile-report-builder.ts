import {
  compareCodeUnits,
  compareProfileAttributeValues,
  compareProfileScopes,
  normalizeProfileCounterPoint,
  normalizeProfileHistogramPoint,
  normalizeProfileSpanAggregate,
  PROFILE_REPORT_SCHEMA_VERSION,
} from "@gitlode/internal-contracts/telemetry";
import type {
  ProfileAttribute,
  ProfileCounterPoint,
  ProfileHistogramPoint,
  ProfileInstrumentationScope,
  ProfileObservationKind,
  ProfileReport,
  ProfileSignalStatus,
  ProfileSpanAggregate,
} from "@gitlode/internal-contracts/telemetry";

import type { BoundedDiagnosticAccumulator } from "./diagnostic-accumulator.js";
import { deriveProfileSignalStatus } from "./profile-report-primitives.js";

export interface ProfileSignalInput<Value> {
  readonly status: ProfileSignalStatus;
  readonly values: readonly Value[];
}
export interface ProfileReportBuildInput {
  readonly spans: ProfileSignalInput<ProfileSpanAggregate>;
  readonly counters: ProfileSignalInput<ProfileCounterPoint>;
  readonly histograms: ProfileSignalInput<ProfileHistogramPoint>;
}

function compareAttributes(left: readonly ProfileAttribute[], right: readonly ProfileAttribute[]) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftAttribute = left[index];
    const rightAttribute = right[index];
    if (!leftAttribute || !rightAttribute) break;
    const byKey = compareCodeUnits(leftAttribute.key, rightAttribute.key);
    if (byKey !== 0) return byKey;
    const byValue = compareProfileAttributeValues(leftAttribute.value, rightAttribute.value);
    if (byValue !== 0) return byValue;
  }
  return left.length - right.length;
}

function compareObservations(
  left: {
    scope: ProfileInstrumentationScope;
    name: string;
    attributes?: readonly ProfileAttribute[];
  },
  right: {
    scope: ProfileInstrumentationScope;
    name: string;
    attributes?: readonly ProfileAttribute[];
  },
) {
  const byScope = compareProfileScopes(left.scope, right.scope);
  if (byScope !== 0) return byScope;
  const byName = compareCodeUnits(left.name, right.name);
  return byName !== 0 ? byName : compareAttributes(left.attributes ?? [], right.attributes ?? []);
}

export class ProfileReportBuilder {
  readonly #diagnostics: BoundedDiagnosticAccumulator;
  readonly #beforeBodyCompletion?: () => void;
  readonly #beforeDiagnosticSnapshot?: () => void;

  constructor(
    diagnostics: BoundedDiagnosticAccumulator,
    hooks: { beforeBodyCompletion?: () => void; beforeDiagnosticSnapshot?: () => void } = {},
  ) {
    this.#diagnostics = diagnostics;
    this.#beforeBodyCompletion = hooks.beforeBodyCompletion;
    this.#beforeDiagnosticSnapshot = hooks.beforeDiagnosticSnapshot;
  }

  build(input: ProfileReportBuildInput): ProfileReport {
    const spans = this.#buildSignal(input.spans, "span", normalizeProfileSpanAggregate);
    const counters = this.#buildSignal(input.counters, "counter", normalizeProfileCounterPoint);
    const histograms = this.#buildSignal(
      input.histograms,
      "histogram",
      normalizeProfileHistogramPoint,
    );
    spans.values.sort((left, right) => {
      const byScope = compareProfileScopes(left.scope, right.scope);
      return byScope !== 0 ? byScope : compareCodeUnits(left.name, right.name);
    });
    counters.values.sort(compareObservations);
    histograms.values.sort(compareObservations);

    const evidence = {
      spans: spans.status,
      counters: counters.status,
      histograms: histograms.status,
    };
    const counts = {
      spans: spans.values.length,
      counters: counters.values.length,
      histograms: histograms.values.length,
    };
    this.#beforeBodyCompletion?.();
    this.#beforeDiagnosticSnapshot?.();
    let snapshot = this.#diagnostics.snapshot();
    let signalStatus: ProfileReport["signalStatus"];
    try {
      signalStatus = deriveProfileSignalStatus(evidence, counts, snapshot);
    } catch {
      for (const [kind, signal] of [
        ["span", "spans"],
        ["counter", "counters"],
        ["histogram", "histograms"],
      ] as const) {
        if (evidence[signal] !== "unavailable" || counts[signal] === 0) continue;
        evidence[signal] = "partial";
        this.#diagnostics.add({
          code: "invalid_aggregation",
          stage: "report_build",
          target: { type: "report" },
          signalCoverage: [kind],
          effects: ["unknown_collection_coverage"],
          extent: "unidentified_subset",
        });
      }
      this.#beforeDiagnosticSnapshot?.();
      snapshot = this.#diagnostics.snapshot();
      signalStatus = deriveProfileSignalStatus(evidence, counts, snapshot);
    }

    return {
      schemaVersion: PROFILE_REPORT_SCHEMA_VERSION,
      signalStatus,
      spans: spans.values,
      counters: counters.values,
      histograms: histograms.values,
      diagnostics: snapshot.summary
        ? [...snapshot.diagnostics, snapshot.summary]
        : snapshot.diagnostics,
    };
  }

  #buildSignal<Value>(
    input: ProfileSignalInput<Value>,
    kind: ProfileObservationKind,
    normalize: (value: unknown) => Value | null,
  ): { status: ProfileSignalStatus; values: Value[] } {
    const values: Value[] = [];
    let status = input.status;
    try {
      for (const value of input.values) {
        const normalized = normalize(value);
        if (normalized) values.push(normalized);
        else {
          status = "partial";
          this.#addValidationIssue(kind);
        }
      }
    } catch {
      status = "partial";
      this.#addValidationIssue(kind);
    }
    return { status, values };
  }

  #addValidationIssue(kind: ProfileObservationKind): void {
    this.#diagnostics.add({
      code: "invalid_aggregation",
      stage: "report_build",
      target: { type: "report" },
      signalCoverage: [kind],
      effects: ["missing_observations"],
      extent: "unidentified_subset",
      lossQuantity: {
        descriptor: "observation_results",
        unit: "results",
        value: 1,
        relationship: "disjoint",
      },
    });
  }
}
