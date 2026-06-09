import type {
  PluginFactory,
  PluginProjectionValue,
  PluginRuntimeContext,
  ProjectionContext,
} from "gitlode/plugin-api";

import { classifyPath } from "./classifier.js";
import type { Classification } from "./classifier.js";
import { parseConfig } from "./config.js";
import type { PreparedConfig } from "./config.js";

const factory: PluginFactory = async (rawConfig: unknown) => {
  let runtime: PluginRuntimeContext | undefined;
  let config: PreparedConfig | undefined;

  return {
    async init(runtimeContext: PluginRuntimeContext) {
      runtime = runtimeContext;
      const parsedConfig = parseConfig(rawConfig);
      if (!parsedConfig.ok) {
        runtimeContext.error(parsedConfig.message);
        return { type: "fatal", message: "Plugin configuration is invalid." };
      }

      config = parsedConfig.value;
      return { type: "ready" };
    },

    async project(context: ProjectionContext) {
      if (!config) {
        runtime?.error("Plugin used before successful initialization.");
        return { type: "fatal", message: "Plugin has not been initialized." };
      }

      if (context.fact.type !== "file-change") {
        return { type: "skip", message: "commit facts are not supported" };
      }

      const classification = classifyPath(context.fact.file.path, config);
      if (classification.source === "unknown" && config.unknownPolicy === "skip") {
        return { type: "skip", message: "file type could not be determined" };
      }

      return {
        type: "success",
        data: buildProjection(classification, config.debug),
      };
    },
  };
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
