import { projectCommit, projectFileChange } from "./fact-projector.js";
import type {
  Fact,
  FactProjector,
  PluginEntry,
  ProgressReporter,
  ProjectedExtensions,
  ProjectedRecord,
  ProjectionContext,
} from "./types.js";
import { assertNever } from "./types.js";

export class EnrichingFactProjector implements FactProjector {
  private readonly pluginEntries: readonly PluginEntry[];
  private readonly reporter: ProgressReporter;
  private readonly repoName: string;
  private readonly repoUrl: string | null;

  constructor(
    pluginEntries: readonly PluginEntry[],
    reporter: ProgressReporter,
    repoName: string,
    repoUrl: string | null,
  ) {
    this.pluginEntries = pluginEntries;
    this.reporter = reporter;
    this.repoName = repoName;
    this.repoUrl = repoUrl;
  }

  async *project(facts: AsyncIterable<Fact>): AsyncIterable<ProjectedRecord> {
    for await (const fact of facts) {
      yield await this.projectOneFact(fact);
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

  private async projectOneFact(fact: Fact): Promise<ProjectedRecord> {
    // Dispatch on the discriminant inline so each arm produces a concrete
    // (fact, baseRecord) pair that matches a single arm of ProjectionContext
    // without any type assertions.
    switch (fact.type) {
      case "commit": {
        const baseRecord = Object.freeze(projectCommit(fact, this.repoName, this.repoUrl));
        const ctx: ProjectionContext = { fact, baseRecord };
        const extensions = await this.runPlugins(fact, ctx);
        return { ...baseRecord, extensions };
      }
      case "file-change": {
        const baseRecord = Object.freeze(projectFileChange(fact, this.repoName, this.repoUrl));
        const ctx: ProjectionContext = { fact, baseRecord };
        const extensions = await this.runPlugins(fact, ctx);
        return { ...baseRecord, extensions };
      }
      default:
        assertNever(fact);
    }
  }

  private async runPlugins(fact: Fact, ctx: ProjectionContext): Promise<ProjectedExtensions> {
    const extensions: ProjectedExtensions = {};

    for (const entry of this.pluginEntries) {
      const { namespace, plugin, failurePolicy } = entry;
      let result;

      try {
        result = await plugin.project(ctx);
      } catch (err) {
        result = {
          type: "fatal" as const,
          message: err instanceof Error ? err.message : String(err),
        };
      }

      switch (result.type) {
        case "success":
          extensions[namespace] = result.data;
          break;
        case "skip":
          extensions[namespace] = null;
          this.reporter.emit({
            type: "warning",
            message: `Plugin "${namespace}" skipped fact ${this.factId(fact)}: ${result.message}`,
          });
          break;
        case "fatal":
          if (failurePolicy === "fatal") {
            throw new Error(
              `Plugin "${namespace}" fatal error on fact ${this.factId(fact)}: ${result.message}`,
            );
          }
          extensions[namespace] = null;
          this.reporter.emit({
            type: "warning",
            message: `Plugin "${namespace}" skipped fact ${this.factId(fact)}: ${result.message}`,
          });
          break;
      }
    }

    return extensions;
  }
}
