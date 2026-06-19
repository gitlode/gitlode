import type {
  PluginFactory,
  PluginInitResult,
  PluginProjectionResult,
  PluginProjectionValue,
  PluginRuntimeContext,
  ProjectionContext,
  ProjectorPlugin,
} from "gitlode/plugin-api";

import { classifyPath } from "./classifier.js";
import type { Classification } from "./classifier.js";
import { parseConfig } from "./config.js";
import type { PreparedConfig } from "./config.js";

const factory: PluginFactory = async (rawConfig: unknown) => {
  let runtime: PluginRuntimeContext | undefined;
  let config: PreparedConfig | undefined;

  return {
    async init(runtimeContext: PluginRuntimeContext): Promise<PluginInitResult> {
      runtime = runtimeContext;
      const parsedConfig = parseConfig(rawConfig);
      if (!parsedConfig.ok) {
        runtimeContext.error(parsedConfig.message);
        return { type: "fatal" };
      }

      config = parsedConfig.value;
      return { type: "ready" };
    },

    async project(context: ProjectionContext): Promise<PluginProjectionResult> {
      if (!config) {
        runtime?.error("Plugin used before successful initialization.");
        return { type: "fatal" };
      }

      if (context.fact.type !== "file-change") {
        // fact types other than file-change are not supported
        return { type: "skip" };
      }

      const classification = classifyPath(context.fact.file.path, config);
      if (classification.source === "unknown" && config.unknownPolicy === "skip") {
        if (config.debug) {
          runtime?.warn(`File type could not be determined for path: ${context.fact.file.path}`);
        }
        return { type: "skip" };
      }

      return {
        type: "success",
        data: buildProjection(classification, config.debug),
      };
    },
  } satisfies ProjectorPlugin;
};

export default factory;

function buildProjection(classification: Classification, debug: boolean): PluginProjectionValue {
  if (!debug) {
    return { name: classification.name };
  }

  return {
    name: classification.name,
    _debug: {
      source: classification.source,
      matched: classification.matched,
    },
  };
}
