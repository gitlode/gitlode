export { GitCliAdapter } from "./git-cli-adapter.js";
export { IsomorphicGitAdapter } from "./isomorphic-git-adapter.js";
export type { IsomorphicGitAdapterDependencies } from "./isomorphic-git-adapter.js";
export {
  EXPERIMENTAL_COMMIT_TRAVERSAL_ENV,
  createCommitTraversalStrategy,
  resolveCommitTraversalStrategyName,
} from "./commit-traversal/index.js";
