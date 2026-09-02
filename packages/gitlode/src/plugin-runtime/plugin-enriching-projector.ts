import type { DiagnosticReporter } from "@gitlode/internal-contracts/diagnostics";
import type {
  Fact,
  FactProjector,
  ProjectedExtensions,
  ProjectedFileChange,
  ProjectedRecord,
} from "@gitlode/internal-contracts/extraction";
import {
  getTelemetryAttributeMetadata,
  STREAM_COMPLETION_ATTRIBUTE,
} from "@gitlode/internal-contracts/telemetry";
import {
  createAsyncIterableInstrumenter,
  recordSpanError,
} from "@gitlode/internal-foundation/otel-support";
import { assertNever } from "@gitlode/internal-foundation/support";
import { SpanStatusCode, type Context, type Span, type Tracer } from "@opentelemetry/api";

import type { PluginProjectionResult, ProjectionContext } from "../plugin-api/index.js";
import type { PluginRuntimeEntry } from "./types.js";

class PluginProjectionAbort extends Error {
  readonly failureSource: "returned" | "thrown";
  readonly originalThrown: unknown;
  constructor(message: string, failureSource: "returned" | "thrown", originalThrown?: unknown) {
    super(message);
    this.failureSource = failureSource;
    this.originalThrown = originalThrown;
  }
}

function recordProjectionError(span: Span, error: unknown): void {
  if (!(error instanceof PluginProjectionAbort)) return recordSpanError(span, error);
  if (error.failureSource === "thrown") return recordSpanError(span, error.originalThrown);
  span.setStatus({ code: SpanStatusCode.ERROR });
}

const instrumentPluginProjection = createAsyncIterableInstrumenter(
  (span, completion) => span.setAttribute(STREAM_COMPLETION_ATTRIBUTE, completion),
  recordProjectionError,
);

async function* trackFacts(
  facts: AsyncIterable<Fact>,
  pendingFacts: Map<number, Fact>,
  nextSequence: { value: number },
): AsyncIterable<Fact> {
  for await (const fact of facts) {
    pendingFacts.set(nextSequence.value++, fact);
    yield fact;
  }
}

function isProjectedFileChange(record: ProjectedRecord): record is ProjectedFileChange {
  return "file" in record;
}

export class EnrichingFactProjector implements FactProjector {
  private readonly baseProjector: FactProjector;
  private readonly pluginEntries: readonly PluginRuntimeEntry[];
  private readonly diagnosticReporter: DiagnosticReporter;
  private readonly tracer: Tracer;

  constructor(
    baseProjector: FactProjector,
    pluginEntries: readonly PluginRuntimeEntry[],
    diagnosticReporter: DiagnosticReporter,
    tracer: Tracer,
  ) {
    this.baseProjector = baseProjector;
    this.pluginEntries = pluginEntries;
    this.diagnosticReporter = diagnosticReporter;
    this.tracer = tracer;
  }

  project(facts: AsyncIterable<Fact>, parentContext?: Context): AsyncIterable<ProjectedRecord> {
    return instrumentPluginProjection(
      this.tracer,
      "gitlode.projection",
      (span) => {
        span.setAttribute(getTelemetryAttributeMetadata("projection_mode").key, "plugin_enriched");
        return this.projectRecords(facts);
      },
      undefined,
      parentContext,
    );
  }

  private async *projectRecords(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
    const pendingFacts = new Map<number, Fact>();
    const nextProducedSequence = { value: 0 };
    let nextRecordSequence = 0;
    const baseRecords = this.baseProjector.project(
      trackFacts(facts, pendingFacts, nextProducedSequence),
    );

    for await (const baseRecord of baseRecords) {
      const fact = pendingFacts.get(nextRecordSequence);
      if (fact === undefined) {
        throw new Error("Base projector produced a record without a corresponding fact");
      }
      pendingFacts.delete(nextRecordSequence++);
      yield await this.enrichRecord(fact, Object.freeze(baseRecord));
    }

    if (pendingFacts.size > 0) {
      throw new Error("Base projector did not produce a record for every fact");
    }
  }

  private factId(fact: Fact): string {
    switch (fact.type) {
      case "commit":
        return fact.oid;
      case "file-change":
        return `${fact.commit.oid}/${fact.file.path}`;
      default:
        assertNever(fact);
    }
  }

  private async enrichRecord(fact: Fact, baseRecord: ProjectedRecord): Promise<ProjectedRecord> {
    switch (fact.type) {
      case "commit": {
        if (isProjectedFileChange(baseRecord)) {
          throw new Error("Base projector paired a commit fact with a file-change record");
        }
        const context: ProjectionContext = { fact, baseRecord };
        return { ...baseRecord, extensions: await this.runPlugins(fact, context) };
      }
      case "file-change": {
        if (!isProjectedFileChange(baseRecord)) {
          throw new Error("Base projector paired a file-change fact with a commit record");
        }
        const context: ProjectionContext = { fact, baseRecord };
        return { ...baseRecord, extensions: await this.runPlugins(fact, context) };
      }
      default:
        assertNever(fact);
    }
  }

  private async runPlugins(fact: Fact, context: ProjectionContext): Promise<ProjectedExtensions> {
    const extensions: ProjectedExtensions = {};

    for (const entry of this.pluginEntries) {
      const { namespace, plugin, failurePolicy, projectionMetricRecorder } = entry;
      let result: PluginProjectionResult;
      let callbackCompletionRecorded = false;
      let failureSource: "returned" | "thrown" = "returned";
      let originalThrown: unknown;
      const token = projectionMetricRecorder.startProjection();

      try {
        result = await plugin.project(context);
      } catch (error) {
        failureSource = "thrown";
        originalThrown = error;
        projectionMetricRecorder.completeProjection(
          token,
          fact.type,
          failurePolicy === "fatal" ? "failure_aborted" : "failure_continued",
        );
        callbackCompletionRecorded = true;
        this.diagnosticReporter.report({
          severity: "warn",
          message: `Plugin "${namespace}" threw an error on fact ${this.factId(fact)}: ${error instanceof Error ? error.message : String(error)}`,
        });
        result = { type: "fatal" };
      }

      switch (result.type) {
        case "success":
          projectionMetricRecorder.completeProjection(token, fact.type, "success");
          extensions[namespace] = result.data;
          break;
        case "skip":
          projectionMetricRecorder.completeProjection(token, fact.type, "skip");
          extensions[namespace] = null;
          break;
        case "fatal":
          if (!callbackCompletionRecorded) {
            projectionMetricRecorder.completeProjection(
              token,
              fact.type,
              failurePolicy === "fatal" ? "failure_aborted" : "failure_continued",
            );
          }
          if (failurePolicy === "fatal") {
            throw new PluginProjectionAbort(
              `Plugin "${namespace}" fatal error on fact ${this.factId(fact)}`,
              failureSource,
              originalThrown,
            );
          }
          extensions[namespace] = null;
          this.diagnosticReporter.report({
            severity: "warn",
            message: `Plugin "${namespace}" skipped fact ${this.factId(fact)}`,
          });
          break;
      }
    }

    return extensions;
  }
}
