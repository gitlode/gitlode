import type {
  PluginFactory,
  PluginInitResult,
  PluginProjectionResult,
  PluginRuntimeContext,
  ProjectionContext,
  ProjectorPlugin,
} from "gitlode/plugin-api";

import { prepareConfig } from "./config.js";
import type { PreparedConfig } from "./config.js";
import { buildPersonOutput } from "./output.js";
import { resolveProfile } from "./resolver.js";

const factory: PluginFactory = async (rawConfig: unknown) => {
  let runtime: PluginRuntimeContext | undefined;
  let preparedConfig: PreparedConfig | undefined;

  return {
    async init(runtimeContext: PluginRuntimeContext): Promise<PluginInitResult> {
      runtime = runtimeContext;
      const parsed = prepareConfig(rawConfig, runtimeContext);
      if (!parsed.ok) {
        runtimeContext.error("Plugin configuration is invalid.");
        return { type: "fatal" };
      }

      preparedConfig = parsed.value;
      return { type: "ready" };
    },
    async project(context: ProjectionContext): Promise<PluginProjectionResult> {
      if (!preparedConfig) {
        runtime?.error?.("Plugin used before successful initialization.");
        return { type: "fatal" };
      }

      const { author, committer } = context.baseRecord;
      const authorMatch = resolveProfile(preparedConfig, author);
      const committerMatch = resolveProfile(preparedConfig, committer);

      return {
        type: "success",
        data: {
          author: buildPersonOutput(author, authorMatch, preparedConfig),
          committer: buildPersonOutput(committer, committerMatch, preparedConfig),
        },
      };
    },
  } satisfies ProjectorPlugin;
};

export default factory;
