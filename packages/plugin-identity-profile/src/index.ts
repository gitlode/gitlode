import type { PluginFactory, PluginRuntimeContext } from "gitlode/plugin-api";

const factory: PluginFactory = async () => {
  return {
    async init(runtime: PluginRuntimeContext) {
      runtime.error(
        "Plugin implementation is not available yet. The package scaffold is present, but the identity-profile runtime has not been implemented.",
      );
      return {
        type: "fatal",
        message: "Plugin implementation is not available yet.",
      };
    },
    async project() {
      return {
        type: "success",
        data: {},
      };
    },
  };
};

export default factory;
