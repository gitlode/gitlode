import type {
  PluginFactory,
  PluginInitResult,
  PluginProjectionResult,
  PluginRuntimeContext,
  ProjectionContext,
  ProjectorPlugin,
} from "gitlode/plugin-api";

import { computeChurn, computeDelta, computeMax } from "./assay-metrics.js";

const factory: PluginFactory = async (_rawConfig: unknown) => {
  return {
    async init(_runtimeContext: PluginRuntimeContext): Promise<PluginInitResult> {
      return { type: "ready" };
    },
    async project(context: ProjectionContext): Promise<PluginProjectionResult> {
      if (context.fact.type !== "file-change") {
        // fact types other than file-change are not supported
        return { type: "skip" };
      }

      const fact = context.fact;

      const delta = computeDelta(fact.file);
      const churn = computeChurn(fact.file);
      const max = computeMax(fact.file);

      return {
        type: "success",
        data: {
          delta,
          churn,
          max,
        },
      };
    },
  } satisfies ProjectorPlugin;
};

export default factory;
