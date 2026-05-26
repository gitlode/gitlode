type PluginInitResult = { type: "ready" } | { type: "fatal"; message: string };

type PluginProjectionResult =
  | { type: "success"; data: Record<string, unknown> }
  | { type: "skip"; message: string }
  | { type: "fatal"; message: string };

type ProjectorPlugin = {
  init?(): Promise<PluginInitResult>;
  project(): Promise<PluginProjectionResult>;
};

type PluginFactory = (config: unknown) => ProjectorPlugin | Promise<ProjectorPlugin>;

const factory: PluginFactory = async (_config: unknown) => {
  return {
    async init() {
      return { type: "ready" };
    },
    async project() {
      return { type: "success", data: {} };
    },
  };
};

export default factory;
