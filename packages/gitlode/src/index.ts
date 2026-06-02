#!/usr/bin/env node
import nodeFs from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { ParsedArgs } from "./cli/args.js";
import type { ConfigExtensionsSection } from "./cli/config/index.js";
import { loadConfigFile } from "./cli/config/index.js";
import { createBootstrapRenderer, parseArgs } from "./cli/index.js";
import {
  checkPluginCompatibility,
  initializePlugins,
  resolvePluginEntries,
} from "./cli/plugins.js";
import { createStyling } from "./cli/progress/index.js";
import type { RunSuccessPayload } from "./cli/runtime/index.js";
import { createProgressRuntime, renderSuccessReport } from "./cli/runtime/index.js";
import {
  NodeStateStore,
  assertSupportedRepositoryObjectFormat,
  deriveRepoName,
  loadPriorState,
} from "./cli/runtime/index.js";
import { stderrSink } from "./cli/runtime/progress-runtime.js";
import {
  DefaultCommitTraversalExtractor,
  DefaultExtractionCoordinator,
  type FactProjector,
  DefaultFactProjector,
  DefaultFileChangeExpander,
  DefaultTraversalPlanner,
  EnrichingFactProjector,
} from "./core/index.js";
import { DefaultStageProfiler } from "./core/profile/index.js";
import { GitAdapterError, IsomorphicGitAdapter, JsDiffAdapter } from "./git/index.js";
import { OutputWriter, OutputWriterSink, formatSessionTimestamp } from "./output/index.js";

function formatPluginInitializationFailure(entry: {
  entry: { namespace: string };
  result: { type: "fatal"; message: string };
}): string {
  return `Plugin "${entry.entry.namespace}" init failed: ${entry.result.message}`;
}

function hasEffectiveExtensionsConfig(
  extensions: ConfigExtensionsSection | undefined,
): extensions is ConfigExtensionsSection {
  return extensions !== undefined && Object.keys(extensions).length > 0;
}

async function main(): Promise<void> {
  const bootstrapAdapter = new IsomorphicGitAdapter({
    fs: nodeFs,
    diffAdapter: new JsDiffAdapter(),
  });
  const isTTY = process.stderr.isTTY === true;
  const styling = createStyling(isTTY);
  const bootstrapRenderer = createBootstrapRenderer(stderrSink);

  let parsedArgs: ParsedArgs;
  try {
    const parseResult = await parseArgs(bootstrapAdapter);
    if (parseResult.kind === "termination") {
      bootstrapRenderer.renderTermination(parseResult.termination);
      process.exitCode = parseResult.termination.exitCode;
      return;
    }
    parsedArgs = parseResult.parsed;
  } catch (error) {
    if (error instanceof GitAdapterError) {
      bootstrapRenderer.renderUserError(error.message);
      process.exitCode = 1;
      return;
    }

    bootstrapRenderer.renderRuntimeError(error);
    process.exitCode = 2;
    return;
  }

  const progressRuntime = createProgressRuntime({
    sink: stderrSink,
    clock: { nowMs: () => performance.now() },
    scheduler: {
      setInterval(fn, ms) {
        const intervalId = setInterval(fn, ms);
        return () => clearInterval(intervalId);
      },
    },
    quiet: parsedArgs.quiet,
    isTTY,
    styling,
  });

  try {
    const repoPath = resolve(parsedArgs.repositoryPath);
    const rootProfiler = new DefaultStageProfiler("elapsed", () => performance.now());
    const startMs = performance.now();
    rootProfiler.start();
    try {
      const runAdapter = new IsomorphicGitAdapter({
        fs: nodeFs,
        diffAdapter: new JsDiffAdapter(),
        profiler: parsedArgs.profile ? rootProfiler.createScopedProfiler("git") : undefined,
      });

      const supportedObjectFormats = runAdapter.supportedObjectFormats();
      const repositoryObjectFormat = await runAdapter.getRepositoryObjectFormat(repoPath);
      assertSupportedRepositoryObjectFormat(repositoryObjectFormat, supportedObjectFormats);

      const remoteUrl = await runAdapter.getRemoteUrl(repoPath);
      const repoName = deriveRepoName(remoteUrl, repoPath);

      const stateStore = parsedArgs.stateFilePath
        ? new NodeStateStore(parsedArgs.stateFilePath)
        : undefined;
      const priorState = await loadPriorState(
        stateStore,
        parsedArgs,
        repoPath,
        repositoryObjectFormat,
        progressRuntime.reporter,
      );

      const sessionTimestamp = new Date();
      const tsStr = formatSessionTimestamp(sessionTimestamp);
      const sink = new OutputWriterSink(
        new OutputWriter(
          parsedArgs.outputDir,
          (seq) => `${parsedArgs.outputPrefix}-${tsStr}-${String(seq).padStart(6, "0")}.jsonl`,
          parsedArgs.rotation,
        ),
      );

      const planningProfiler = parsedArgs.profile
        ? rootProfiler.createScopedProfiler("planning")
        : undefined;
      const traversalProfiler = parsedArgs.profile
        ? rootProfiler.createScopedProfiler("traversal")
        : undefined;
      const projectionProfiler = parsedArgs.profile
        ? rootProfiler.createScopedProfiler("projection")
        : undefined;
      const writeProfiler = parsedArgs.profile
        ? rootProfiler.createScopedProfiler("write")
        : undefined;

      const traversalPlanner = new DefaultTraversalPlanner(runAdapter, planningProfiler);
      const traversalExtractor = new DefaultCommitTraversalExtractor(runAdapter, traversalProfiler);
      const fileChangeExpander = new DefaultFileChangeExpander(runAdapter, parsedArgs.maxDiffSize);

      let projector: FactProjector;
      let loadedConfig = parsedArgs.loadedConfig;
      if (parsedArgs.configPath && loadedConfig === undefined) {
        const loadedResult = await loadConfigFile(parsedArgs.configPath);
        if (loadedResult.kind === "termination") {
          progressRuntime.presenter.renderUserError(loadedResult.termination.message);
          process.exitCode = 1;
          return;
        }
        loadedConfig = loadedResult.loaded;
      }

      const extensionsConfig = loadedConfig?.config.extensions;
      if (parsedArgs.configPath && hasEffectiveExtensionsConfig(extensionsConfig)) {
        progressRuntime.reporter.emit({ type: "phase-start", phase: "initializing-plugins" });

        const pluginEntriesResult = await resolvePluginEntries(
          extensionsConfig,
          parsedArgs.configPath,
        );
        if (pluginEntriesResult.kind === "termination") {
          progressRuntime.presenter.renderUserError(pluginEntriesResult.termination.message);
          process.exitCode = 1;
          return;
        }

        const pluginEntries = pluginEntriesResult.entries;

        await checkPluginCompatibility(pluginEntries, extensionsConfig, parsedArgs.configPath, {
          warn(message) {
            progressRuntime.presenter.renderDiagnostic("warn", message);
          },
        });

        const pluginsProfiler = parsedArgs.profile
          ? projectionProfiler?.createScopedProfiler("plugins")
          : undefined;

        const pluginInitResults = await initializePlugins(pluginEntries, (entry) => ({
          warn(message) {
            progressRuntime.presenter.renderDiagnostic(
              "warn",
              `Plugin "${entry.namespace}": ${message}`,
            );
          },
          error(message) {
            progressRuntime.presenter.renderDiagnostic(
              "error",
              `Plugin "${entry.namespace}": ${message}`,
            );
          },
          profiler: pluginsProfiler?.createScopedProfiler(entry.namespace),
        }));

        const pluginInitFailures = pluginInitResults.filter(
          (entry): entry is typeof entry & { result: { type: "fatal"; message: string } } =>
            entry.result.type === "fatal",
        );
        if (pluginInitFailures.length > 0) {
          progressRuntime.presenter.renderUserError(
            pluginInitFailures.map((entry) => formatPluginInitializationFailure(entry)).join("\n"),
          );
          process.exitCode = 1;
          return;
        }

        progressRuntime.reporter.emit({ type: "phase-end", phase: "initializing-plugins" });

        projector = new EnrichingFactProjector(
          pluginEntries,
          progressRuntime.reporter,
          parsedArgs.repoName ?? repoName,
          parsedArgs.repoUrl !== undefined ? parsedArgs.repoUrl : remoteUrl,
        );
      } else {
        projector = new DefaultFactProjector(
          repoName,
          remoteUrl,
          projectionProfiler,
          parsedArgs.repoName,
          parsedArgs.repoUrl,
        );
      }

      const coordinator = new DefaultExtractionCoordinator({
        traversalPlanner,
        traversalExtractor,
        fileChangeExpander,
        projector,
        sink,
        stateStore,
        reporter: progressRuntime.reporter,
        profiler: writeProfiler,
      });

      const result = await coordinator.run({
        repositoryPath: repoPath,
        repoName,
        remoteUrl,
        refs: [...parsedArgs.refs],
        granularity: parsedArgs.perFile ? "file" : "commit",
        range: parsedArgs.range,
        priorState,
        sessionTimestamp,
      });

      const success: RunSuccessPayload = {
        recordsWritten: result.recordsWritten,
        commitsTraversed: result.commitsTraversed,
        filesCreated: sink.filesCreated,
        bytesWritten: sink.bytesWritten,
        elapsedMs: performance.now() - startMs,
        refs: result.refs,
        profileEntries: rootProfiler.entries(),
        skippedDiffs: result.skippedDiffs,
      };

      renderSuccessReport({
        presenter: progressRuntime.presenter,
        quiet: parsedArgs.quiet,
        profile: parsedArgs.profile,
        success,
      });
    } finally {
      rootProfiler.stop();
    }
  } catch (error) {
    if (error instanceof GitAdapterError) {
      progressRuntime.presenter.renderUserError(error.message);
      process.exitCode = 1;
      return;
    }

    progressRuntime.presenter.renderRuntimeError(error);
    process.exitCode = 2;
  }
}

function shouldRunAsCli(): boolean {
  const argvEntry = process.argv[1];
  if (!argvEntry) {
    return false;
  }
  return pathToFileURL(argvEntry).href === import.meta.url;
}

if (shouldRunAsCli()) {
  main().catch((error) => {
    process.stderr.write(
      (error instanceof Error ? (error.stack ?? error.message) : String(error)) + "\n",
    );
    process.exit(2);
  });
}
