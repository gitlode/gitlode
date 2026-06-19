import { CommitParser } from "conventional-commits-parser";
import type {
  PluginFactory,
  PluginInitResult,
  PluginProjectionResult,
  PluginRuntimeContext,
  ProjectionContext,
  ProjectorPlugin,
} from "gitlode/plugin-api";

const factory: PluginFactory = async () => {
  let runtime: PluginRuntimeContext | undefined;
  let parser: CommitParser | undefined;
  return {
    async init(_runtimeContext: PluginRuntimeContext): Promise<PluginInitResult> {
      runtime = _runtimeContext;
      parser = new CommitParser();
      return { type: "ready" };
    },
    async project(context: ProjectionContext): Promise<PluginProjectionResult> {
      if (parser === undefined) {
        runtime?.error("Plugin used before successful initialization.");
        return { type: "fatal" };
      }
      const { fact } = context;
      const commit = fact.type === "commit" ? fact : fact.commit;
      const parsedCommit = parser.parse(commit.message);

      return { type: "success", data: parsedCommit };
    },
  } satisfies ProjectorPlugin;
};

export default factory;
