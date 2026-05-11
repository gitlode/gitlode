#!/usr/bin/env node
import { rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { defineCommand, runMain } from "citty";

import { cmdDefinition, parseArgs } from "./cli/index.js";
import { Extractor } from "./core/index.js";
import type { Reporter, CheckpointStore, ExtractionCheckpoint } from "./core/index.js";
import { GitAdapterError } from "./git/index.js";
import { IsomorphicGitAdapter } from "./git/index.js";

const stderrReporter: Reporter & { lastDisplayed: number } = {
  lastDisplayed: 0,
  warn(message: string): void {
    process.stderr.write(message + "\n");
  },
  progress(recordsWritten: number): void {
    if (recordsWritten - this.lastDisplayed >= 100) {
      this.lastDisplayed = recordsWritten;
      process.stderr.write(`\rProcessed ${recordsWritten} records...`);
    }
  },
  done(recordsWritten: number): void {
    if (recordsWritten > 0 && recordsWritten !== this.lastDisplayed) {
      process.stderr.write(`\rProcessed ${recordsWritten} records...\n`);
    } else if (this.lastDisplayed >= 100) {
      process.stderr.write("\n");
    }
  },
};

const noopReporter: Reporter = {
  warn(_message: string): void {},
  progress(_recordsWritten: number): void {},
  done(_recordsWritten: number): void {},
};

class NodeCheckpointStore implements CheckpointStore {
  private readonly stateFilePath: string;
  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
  }

  async read(): Promise<ExtractionCheckpoint | null> {
    const { readFile } = await import("node:fs/promises");
    try {
      const raw = await readFile(this.stateFilePath, "utf8");
      return JSON.parse(raw) as ExtractionCheckpoint;
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return null;
      }
      throw err;
    }
  }

  async write(state: ExtractionCheckpoint): Promise<void> {
    const tmpPath = `${this.stateFilePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, this.stateFilePath);
  }
}

const main = defineCommand({
  ...cmdDefinition,
  async run() {
    const adapter = new IsomorphicGitAdapter();
    let parsed;
    try {
      parsed = await parseArgs(adapter);
    } catch (e) {
      // parseArgs calls process.exit for user errors; if it throws, it's a runtime error
      if (e instanceof GitAdapterError) {
        process.stderr.write(e.message + "\n");
        process.exit(1);
      }
      process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
      process.exit(2);
    }
    try {
      const { quiet, profile } = parsed;
      const reporter = quiet ? noopReporter : stderrReporter;
      const stateStore = parsed.stateFilePath
        ? new NodeCheckpointStore(parsed.stateFilePath)
        : undefined;
      const extractor = new Extractor(
        { ...parsed, enableProfiling: profile },
        adapter,
        reporter,
        () => new Date(),
        () => performance.now(),
        stateStore,
      );
      const result = await extractor.run();
      if (!quiet) {
        const elapsedMs = result.profilingEntries[0]?.wallMs ?? 0;
        const elapsed = (elapsedMs / 1000).toFixed(1);
        process.stderr.write(`\nExtraction complete\n`);
        process.stderr.write(`  Records written : ${result.recordsWritten}\n`);
        process.stderr.write(`  Files created   : ${result.filesCreated}\n`);
        process.stderr.write(`  Bytes written   : ${result.bytesWritten}\n`);
        process.stderr.write(`  Elapsed time    : ${elapsed}s\n`);
        process.stderr.write(
          `  Branches        : ${result.branches.length > 0 ? result.branches.join(", ") : "(none)"}\n`,
        );
        if (profile) {
          const nameWidth = Math.max(...result.profilingEntries.map((e) => e.name.length));
          const wallWidth = Math.max(
            ...result.profilingEntries.map((e) => e.wallMs.toFixed(2).length),
          );
          const workWidth = Math.max(
            ...result.profilingEntries.map((e) => e.workMs.toFixed(2).length),
          );
          process.stderr.write(`\nProfile\n`);
          for (const entry of result.profilingEntries) {
            const label = entry.name.padEnd(nameWidth);
            const wall = `${entry.wallMs.toFixed(2)}ms`.padStart(wallWidth + 2);
            const work = `${entry.workMs.toFixed(2)}ms`.padStart(workWidth + 2);
            process.stderr.write(`  ${label} : wall= ${wall}  work= ${work}\n`);
          }
        }
      }
    } catch (e) {
      if (e instanceof GitAdapterError) {
        process.stderr.write(e.message + "\n");
        process.exit(1);
      }
      process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
      process.exit(2);
    }
  },
});

runMain(main);
