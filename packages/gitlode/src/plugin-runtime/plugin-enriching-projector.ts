import type {
  Fact,
  FactProjector,
  ProjectedExtensions,
  ProjectedFileChange,
  ProjectedRecord,
} from "../extraction-api/index.js";
import type { PluginProjectionResult, ProjectionContext } from "../plugin-api/index.js";
import type { ProgressReporter } from "../progress/index.js";
import { assertNever } from "../support/index.js";
import type { PluginEntry } from "./types.js";

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
  private readonly pluginEntries: readonly PluginEntry[];
  private readonly reporter: ProgressReporter;

  constructor(
    baseProjector: FactProjector,
    pluginEntries: readonly PluginEntry[],
    reporter: ProgressReporter,
  ) {
    this.baseProjector = baseProjector;
    this.pluginEntries = pluginEntries;
    this.reporter = reporter;
  }

  async *project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
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
      const { namespace, plugin, failurePolicy } = entry;
      let result: PluginProjectionResult;

      try {
        result = await plugin.project(context);
      } catch (error) {
        this.reporter.emit({
          type: "warning",
          message: `Plugin "${namespace}" threw an error on fact ${this.factId(fact)}: ${error instanceof Error ? error.message : String(error)}`,
        });
        result = { type: "fatal" };
      }

      switch (result.type) {
        case "success":
          extensions[namespace] = result.data;
          break;
        case "skip":
          extensions[namespace] = null;
          break;
        case "fatal":
          if (failurePolicy === "fatal") {
            throw new Error(`Plugin "${namespace}" fatal error on fact ${this.factId(fact)}`);
          }
          extensions[namespace] = null;
          this.reporter.emit({
            type: "warning",
            message: `Plugin "${namespace}" skipped fact ${this.factId(fact)}`,
          });
          break;
      }
    }

    return extensions;
  }
}
