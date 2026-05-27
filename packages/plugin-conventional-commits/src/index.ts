import { CommitParser } from "conventional-commits-parser";
import type { PluginFactory, ProjectionContext } from "gitlode/plugin-api";

const factory: PluginFactory = async () => {
  let parser: CommitParser | undefined;
  return {
    async init() {
      parser = new CommitParser();
      return { type: "ready" };
    },
    async project(context: ProjectionContext) {
      const { fact } = context;
      const commit = fact.type === "commit" ? fact : fact.commit;
      const parsedCommit = parser!.parse(commit.message);

      return { type: "success", data: parsedCommit };
    },
  };
};

export default factory;
