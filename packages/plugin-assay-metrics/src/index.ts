import type { PluginFactory, PluginRuntimeContext, ProjectionContext } from "gitlode/plugin-api";

import { computeChurn, computeDelta, computeMax } from "./assay-metrics.js";

const factory: PluginFactory = async (_rawConfig: unknown) => {
  return {
    async init(_runtime: PluginRuntimeContext) {
      return { type: "ready" };
    },
    async project(context: ProjectionContext) {
      if (context.fact.type !== "file-change") {
        return { type: "skip", message: "commit facts are not supported" };
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
  };
};

export default factory;
